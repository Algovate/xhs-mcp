#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Optimized Webpack configuration for XHS MCP CLI
 * Focused on minimal bundle size and performance
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
    clean: true,
  },

  // Module resolution
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    modules: ['node_modules'],
    alias: {
      '@': resolve(__dirname, 'src'),
    },
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
    // MCP SDK
    '@modelcontextprotocol/sdk',
    // Web frameworks
    'express',
    'cors',
    // Browser automation
    'puppeteer',
    // CLI framework
    'commander',
    // HTTP client
    'node-fetch',
    // Type definitions (dev only)
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
      'process.env.NODE_ENV': JSON.stringify('production'),
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

  // Optimization
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          // Aggressive optimization for production
          keep_fnames: false,
          keep_classnames: false,
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info', 'console.debug'],
            passes: 2,
          },
          mangle: {
            toplevel: true,
            properties: {
              regex: /^_/,
            },
          },
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
    
    // Single bundle for CLI
    splitChunks: false,
  },

  // Development tools
  devtool: false, // No source maps for optimized build

  // Performance hints
  performance: {
    maxAssetSize: 5000000, // 5MB
    maxEntrypointSize: 5000000, // 5MB
    hints: 'warning',
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
    assets: true,
    entrypoints: true,
    timings: true,
    warnings: false, // Hide warnings for cleaner output
  },
};

export default config;
