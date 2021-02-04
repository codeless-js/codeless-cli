const fs = require('fs');
const path = require('path');
const { upperFirst, camelCase } = require('lodash');
const WebpackPluginImport = require('webpack-plugin-import');
const CheckIceComponentsDepsPlugin = require('./webpackPlugins/checkIceComponentsDepPlugin');
const AppendStyleWebpackPlugin = require('./webpackPlugins/appendStyleWebpackPlugin');
const getThemeVars = require('./utils/getThemeVars');
const getThemeCode = require('./utils/getThemeCode');
const getCalcVars = require('./utils/getCalcVars');

function normalizeEntry(entry, preparedChunks) {
  const preparedName = preparedChunks
    .filter((module) => {
      return typeof module.name !== 'undefined';
    })
    .map((module) => module.name);

  return Object.keys(entry).concat(preparedName);
}
interface ComponentOptions {
  bizComponent: Array<string>;
  customPath:string;
  componentMap: object;

}
interface PlugionOptions {
  themePackage: string;
  themeConfig: string;
  nextLibDir: string;
  usePx2Vw: boolean;
  px2vwOptions: object;
  style: boolean;
  uniteNextLib: boolean;
  externalNext: string;
  importOptions: object;
  componentOptions: ComponentOptions;
  enableColorNames: Array<string>;
  uniteBaseComponent: string;
}
module.exports = async ({ onGetWebpackConfig, log, context, getAllTask }, plugionOptions:PlugionOptions) => {
  const {
    themePackage,
    themeConfig,
    nextLibDir = 'es',
    usePx2Vw = false,
    px2vwOptions = {},
    style = true,
    uniteNextLib,
    externalNext,
    importOptions = {},
    componentOptions,
    enableColorNames,
  } = plugionOptions;
  let { uniteBaseComponent } = plugionOptions;
  const { rootDir, pkg, userConfig, webpack } = context;

  const taskNames = getAllTask();
  // ignore externals rule and babel-plugin-import when compile dist
  const ignoreTasks = ['component-dist'];
  taskNames.forEach((taskName) => {
    onGetWebpackConfig(taskName, (config) => {
      // 1. 支持主题能力
      if (themePackage) {
        if (Array.isArray(themePackage)) {
          log.info('已启用 themePackage 多主题功能');
        } else {
          log.info('使用 Fusion 组件主题包：', themePackage);
        }
      }
      if (themeConfig) {
        log.info('自定义 Fusion 组件主题变量：', themeConfig);
      }
  
      let replaceVars = {};
      let defaultScssVars = {};
      let defaultTheme = '';
      if (Array.isArray(themePackage)) {
        const themesCssVars = {};
        let varsPath = path.join(rootDir, 'node_modules', '@alifd/next/variables.scss');
        if (!fs.existsSync(varsPath)) {
          varsPath = false;
        }
        // get scss variables and generate css variables
        themePackage.forEach(({ name, ...themeData }) => {
          const themePath = path.join(rootDir, 'node_modules', `${name}/variables.scss`);
          const configData = themeData.themeConfig || {};
          let themeVars = {scssVars: undefined,originTheme: undefined,cssVars:undefined};
          let calcVars = {};
          if (varsPath) {
            calcVars = getCalcVars(varsPath, themePath, configData);
          }
          try {
            themeVars = getThemeVars(themePath, Object.assign({}, calcVars, configData ), enableColorNames);
          } catch (err) {
            log.error('get theme variables err:', err);
          }
  
          replaceVars = themeVars.scssVars;
          defaultScssVars = themeVars.originTheme;
          themesCssVars[name] = themeVars.cssVars;
          if (themeData.default) {
            defaultTheme = name;
          }
        });
  
        defaultTheme = defaultTheme || (themePackage[0] && themePackage[0].name);
  
        try {
          const tempDir = path.join(rootDir, './node_modules');
          const jsPath = path.join(tempDir, 'change-theme.js');
          fs.writeFileSync(jsPath, getThemeCode(themesCssVars, defaultTheme));
  
          // add theme.js to entry
          const entryNames = Object.keys(config.entryPoints.entries());
          entryNames.forEach((name) => {
            config.entry(name).prepend(jsPath);
          });
        } catch (err) {
          log.error('fail to add theme.js to entry');
          log.error(err);
        }
      }
  
      const themeFile = typeof themePackage === 'string' && path.join(rootDir, 'node_modules', `${themePackage}/variables.scss`);
  
      if (usePx2Vw) {
        ['css', 'scss', 'scss-module'].forEach(rule => {
          config.module
            .rule(rule)
            .use('postcss-loader')
            .tap((options) => {
              const { plugins = [] } = options;
              return {
                ...options,
                plugins: [
                  ...plugins,
                  // eslint-disable-next-line
                  require('postcss-plugin-rpx2vw'),
                  // eslint-disable-next-line
                  require('./postcssPlugins/postcssPluginPx2vw')(px2vwOptions),
                ],
              };
            });
        });
      };
  
      ['scss', 'scss-module'].forEach((rule) => {
        config.module
          .rule(rule)
          .use('ice-skin-loader')
          .loader(require.resolve('ice-skin-loader'))
          .options({
            themeFile,
            themeConfig: Object.assign(
              {},
              defaultScssVars,
              replaceVars,
              themeConfig || {}
            ),
          });
      });
  
      // check icons.scss
      const iconPackage = defaultTheme || themePackage;
      const iconScssPath = iconPackage && path.join(rootDir, 'node_modules', `${iconPackage}/icons.scss`);
      if (iconScssPath && fs.existsSync(iconScssPath)) {
        const appendStylePluginOption = {
          type: 'sass',
          srcFile: iconScssPath,
          variableFile: path.join(rootDir, 'node_modules', `${iconPackage}/variables.scss`),
          compileThemeIcon: true,
          themeConfig: themeConfig || {},
          distMatch: (chunkName, compilerEntry, compilationPreparedChunks) => {
            const entriesAndPreparedChunkNames = normalizeEntry(
              compilerEntry,
              compilationPreparedChunks,
            );
            // 仅对 css 的 chunk 做 处理
            if (entriesAndPreparedChunkNames.length && /\.css$/.test(chunkName)) {
              // css/index.css -> index css/index.[hash].css -> index
              // css/_component_.usage.css -> _component_.usage
              const assetsBaseName = path.basename(chunkName, path.extname(chunkName));
              const assetsFromEntry = userConfig.hash
                ? assetsBaseName.substring(0, assetsBaseName.lastIndexOf('.'))
                : assetsBaseName;
              if (entriesAndPreparedChunkNames.indexOf(assetsFromEntry) !== -1) {
                return true;
              }
            }
            return false;
          },
        };
        config.plugin('AppendStyleWebpackPlugin').use(AppendStyleWebpackPlugin, [appendStylePluginOption]);
      }
  
      const crossendBabelLoader = [];
  
      if ('componentOptions' in plugionOptions) {
        const { bizComponent = [], customPath = '', componentMap = {} } = componentOptions;
        const mixBizCom = {};
  
        // bizComponent: ['@alifd/anchor', '@alifd/pro-components'],
  
        if (Array.isArray(bizComponent)) {
          bizComponent.forEach(com => {
            mixBizCom[com] = `${com}${customPath}`;
          });
        }
  
        // componentMap: {
        //  '@alifd/pro-components': '@alifd/pro-components/lib/mobile',
        //  '@alifd/pro-components-2': '@alifd/pro-components-2-mobile'
        // }
        const mapList = Object.keys(componentMap);
        if (mapList.length > 0) {
          mapList.forEach(orgName => {
            mixBizCom[orgName] = componentMap[orgName];
          });
        }
  
        crossendBabelLoader.push(require.resolve('babel-plugin-module-resolver'), {
          alias: mixBizCom
        });
      }
      // 2. 组件（包含业务组件）按需加载&样式自动引入
      // babel-plugin-import: 基础组件
      // remove babel-plugin-import if external next
      if (!externalNext && !ignoreTasks.includes(taskName)) {
        const importConfigs = [{
          libraryName: 'iview',
          style,
          // libraryDirectory: nextLibDir,
          // ...importOptions,
        }];
        ['jsx', 'tsx'].forEach((rule) => {
          config.module
            .rule(rule)
            .use('babel-loader')
            .tap((options) => {
              const plugins = options.plugins.concat(
                importConfigs.map((itemConfig) => {
                  return [require.resolve('babel-plugin-import'), itemConfig, itemConfig.libraryName];
                }),
              );
              if (crossendBabelLoader.length > 0) {
                plugins.push(crossendBabelLoader);
              }
              options.plugins = plugins;
              return options;
            });
        });
      }
  
      // 4. 检测组件版本
      config.plugin('CheckIceComponentsDepsPlugin')
        .use(CheckIceComponentsDepsPlugin, [{
          pkg,
          log,
        }]);
  
      // 转化 icon content
      config.module.rule('scss').use('unicode-loader').loader(require.resolve('./webpackLoaders/unicodeLoader')).before('sass-loader');
    });
  });
};
