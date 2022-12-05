const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const path = require('path');

// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const commonConfig = {
  mode: 'production',
  entry: './src/index.ts',
  devtool: 'source-map',
  output: {
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    plugins: [
      new TsconfigPathsPlugin({ baseUrl: path.resolve(__dirname, '.') }),
    ],
  },
  plugins: [
    new webpack.IgnorePlugin({
      resourceRegExp:
        /wordlists\/(french|spanish|italian|korean|chinese_simplified|chinese_traditional|japanese)\.json$/,
    }),
  ],
};

const webConfig = {
  ...commonConfig,
  target: 'web',
  output: {
    filename: 'bundle.js',
    libraryTarget: 'umd',
    library: 'cw-simulate',
  },
  resolve: {
    ...commonConfig.resolve,
    fallback: {
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      assert: require.resolve('assert'),
      'process/browser': require.resolve('process'),
      util: require.resolve('util'),
      crypto: require.resolve('crypto-browserify'),
      path: require.resolve('path-browserify'),
    },
  },
  plugins: [
    ...commonConfig.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
    // new BundleAnalyzerPlugin(),
  ],
  optimization: {
    minimize: true,
  },
};

const nodeConfig = {
  ...commonConfig,
  target: 'node',
  output: {
    libraryTarget: 'commonjs',
    filename: 'bundle.node.js',
  },
};

module.exports = [webConfig, nodeConfig];
