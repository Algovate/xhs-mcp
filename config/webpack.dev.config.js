#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Development Webpack configuration for XHS MCP CLI
 * Optimized for fast development builds
 */

const config = {
  // Target Node.js environment
  target: 'node18',

  // Entry point - only CLI
  entry: {
    'xhs-cli': resolve(__dirname, '../src/cli/cli.ts'),
  },

  // Output configuration
  output: {
    path: resolve(__dirname, '../dist'),
    filename: '[name].js',
    library: {
      type: 'commonjs2',
    },
    clean: false, // Don't clean in dev mode for faster builds
  },

  // Module resolution
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    modules: ['node_modules'],
    // Externalize Node.js built-ins
    fallback: {
      fs: false,
      path: false,
      os: false,
      crypto: false,
      stream: false,
      util: false,
      buffer: false,
      events: false,
      url: false,
      querystring: false,
      http: false,
      https: false,
      zlib: false,
      child_process: false,
      cluster: false,
      net: false,
      tls: false,
      dns: false,
      dgram: false,
    },
  },

  // External dependencies (not bundled)
  externals: [
    '@modelcontextprotocol/sdk',
    'express',
    'cors',
    'puppeteer',
    'commander',
    'node-fetch',
    /^@types\//,
  ],

  // Module rules
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: resolve(__dirname, 'tsconfig.webpack.json'),
              transpileOnly: true,
              experimentalWatchApi: true,
              allowTsInNodeModules: true,
            },
          },
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: { node: '18' },
                modules: 'commonjs',
              }],
            ],
          },
        },
      },
    ],
  },

  // Plugins
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),

    new webpack.IgnorePlugin({
      resourceRegExp: /^(canvas|sqlite3|node-gyp|node-pre-gyp)$/,
    }),

    // Add shebang for CLI executables
    new webpack.BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
      entryOnly: true,
    }),
  ],

  // Optimization for development
  optimization: {
    minimize: false, // No minification in dev
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false, // Single bundle for dev
  },

  // Development tools
  devtool: 'eval-source-map',

  // Performance hints
  performance: {
    hints: false, // Disable performance hints in dev
  },

  // Node.js specific options
  node: {
    __dirname: false,
    __filename: false,
  },

  // Statistics
  stats: {
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false,
    assets: false, // Hide assets in dev
    entrypoints: false,
    timings: true,
  },

  // Watch options for development
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300,
    poll: 1000,
  },
};

export default config;
