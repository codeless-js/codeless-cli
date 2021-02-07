const getBabelPreset = require('@ice-builder/babel-preset-ice').default;

module.exports = () => {
  return getBabelPreset({
    vue: true,
  });
};
