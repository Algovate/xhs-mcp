#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Webpack configuration for XHS MCP CLI
 * Optimized for Node.js environment with single CLI entry point
 */

const config = {
  // Target Node.js environment
  target: 'node18',
  
  // Entry point - only CLI
  entry: {
    'xhs-mcp': resolve(__dirname, '../src/cli/cli.ts'),
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
    // Use Node.js module resolution
    modules: ['node_modules'],
    // Handle TypeScript module resolution
    alias: {
      // Map .js imports to .ts files for TypeScript
      '@': resolve(__dirname, '../src'),
    },
    // Externalize Node.js built-ins
    fallback: {
      // Node.js built-ins should not be bundled
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
              // Use main tsconfig for webpack transpile-only
              configFile: resolve(__dirname, 'tsconfig.json'),
              // Transpile only, don't emit declarations (handled separately)
              transpileOnly: true,
              // Enable experimental decorators
              experimentalWatchApi: true,
              // Allow importing .js files as TypeScript
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
    // Define environment variables
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    }),
    
    // Ignore optional dependencies that might cause issues
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
    minimize: process.env.NODE_ENV === 'production',
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          // Preserve function names for debugging
          keep_fnames: true,
          keep_classnames: true,
          // Remove console logs in production (except error/warn)
          compress: {
            drop_console: process.env.NODE_ENV === 'production' ? ['log', 'info', 'debug'] : false,
            drop_debugger: true,
          },
          // Preserve comments for CLI help
          format: {
            comments: /@preserve|@license|@author/i,
          },
        },
        extractComments: false,
      }),
    ],
    
    // Split chunks for better caching (minimal for CLI)
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Keep CLI as single bundle
        default: {
          minChunks: 1,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  },

  // Development tools
  devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',

  // Performance hints
  performance: {
    // CLI tools can be larger
    maxAssetSize: 10000000, // 10MB
    maxEntrypointSize: 10000000, // 10MB
    hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
  },

  // Node.js specific options
  node: {
    // Disable Node.js polyfills (we're targeting Node.js directly)
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
  },
};

export default config;
