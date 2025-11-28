const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages - prioritize local node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Force single React instance - resolve react/react-native from mobile's node_modules only
config.resolver.extraNodeModules = {
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

// 4. Block resolution of react from root node_modules
config.resolver.blockList = [
  new RegExp(`^${path.resolve(monorepoRoot, 'node_modules/react')}/.*$`),
  new RegExp(`^${path.resolve(monorepoRoot, 'node_modules/react-native')}/.*$`),
];

module.exports = config;
