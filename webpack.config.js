const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/apple-home-strategy.ts',
  output: {
    clean: true,
    filename: 'smart-home-dashboard.js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: [/node_modules/, /src\/backup/],
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  },
  plugins: [
    new (require('webpack')).optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ],
};
