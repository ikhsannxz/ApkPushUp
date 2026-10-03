const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add extra asset extensions required for ML models
config.resolver.assetExts.push('bin');

module.exports = config;
