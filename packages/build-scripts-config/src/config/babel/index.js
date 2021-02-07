const getBabelPreset = require('@ice-builder/babel-preset-ice').default;

module.exports = () => {
  return getBabelPreset({
    vue: true,
    env: {
      modules: false,
      targets: {
        browsers: ["> 1%", "last 2 versions", "not ie <= 8"]
      }
    }
  });
};
