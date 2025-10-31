import path from 'path';
import webpack from 'webpack';
import { fileURLToPath } from 'url';
import TerserPlugin from 'terser-webpack-plugin';
import pkg from './package.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: webpack.Configuration = {
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
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }) as any,
    ],
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new webpack.DefinePlugin({
      'process.env.PACKAGE_VERSION': JSON.stringify(pkg.version),
    }),
  ],
};

export default config;
