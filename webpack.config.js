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
    plugins: [new TsconfigPathsPlugin({ baseUrl: path.resolve(__dirname, '.') })],
  },
  plugins: [
    new webpack.IgnorePlugin({
      resourceRegExp:
        /wordlists\/(french|spanish|italian|korean|chinese_simplified|chinese_traditional|japanese)\.json$/,
    }),
  ],
};

module.exports = {
  ...commonConfig,
  target: 'node',
  externals: [require('webpack-node-externals')()],
  output: {
    libraryTarget: 'commonjs',
    filename: 'bundle.node.js',
  },
};
