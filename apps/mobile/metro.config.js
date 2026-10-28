// Metro config for an app that lives inside the monorepo but is NOT an npm workspace.
// @lp/shared is installed as a file: dependency (a symlink to ../../packages/shared), so Metro must
// watch that folder and resolve packages from this app's own node_modules first.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../../packages/shared');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...new Set([...(config.watchFolders || []), sharedRoot])];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
// Fallback in case the symlink is missing (e.g. a copied checkout): resolve the package by path.
config.resolver.extraNodeModules = { ...(config.resolver.extraNodeModules || {}), '@lp/shared': sharedRoot };

module.exports = config;
