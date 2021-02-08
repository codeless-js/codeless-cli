const Config = require('webpack-chain');
const setWebpackLoaders = require('./setWebpackLoaders');
const setWebpackPlugins = require('./setWebpackPlugins');

module.exports = (mode) => {
  const config = new Config();

  config.mode(mode);
  config.resolve.extensions
    .merge(['.js', '.jsx', '.ts', '.tsx', '.vue', '.json']);
  // webpack loaders
  setWebpackLoaders(config, mode);
  // webpack plugins
  setWebpackPlugins(config, mode);

  return config;
};
