const webpack = require('webpack');
const path = require('path');
function resolve(dir) {
  return path.join(__dirname, dir);
}

module.exports = {
  // 生产环境打包不输出 map
  productionSourceMap: false,
  devServer: {
    allowedHosts: 'all',
    port: process.env.DEV_SERVER_PORT || 8080,
    proxy: {
      '^/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        pathRewrite: {
          '^/api': '/',
        },
      },
      '^/unm': {
        target: 'https://music-api.gdstudio.xyz',
        changeOrigin: true,
        pathRewrite: {
          '^/unm': '/',
        },
      },
    },
  },
  pwa: {
    name: 'YesPlayMusic',
    iconPaths: {
      favicon32: 'img/icons/favicon-32x32.png',
    },
    themeColor: '#ffffff00',
    manifestOptions: {
      background_color: '#335eea',
    },
    // workboxOptions: {
    //   swSrc: "dev/sw.js",
    // },
  },
  pages: {
    index: {
      entry: 'src/main.js',
      template: 'public/index.html',
      filename: 'index.html',
      title: 'YesPlayMusic',
      chunks: ['main', 'chunk-vendors', 'chunk-common', 'index'],
    },
  },
  chainWebpack(config) {
    // webpack 5 / css-loader 6 会把绝对路径 url() 当模块解析，
    // 过滤掉以 / 开头的 url，保持 webpack 4 行为（运行时从 public/ 取）
    config.module.rules.values().forEach(rule => {
      rule.oneOfs.values().forEach(oneOf => {
        if (oneOf.uses.has('css-loader')) {
          oneOf.use('css-loader').tap(options => ({
            ...options,
            url: {
              filter: url => !url.startsWith('/'),
            },
          }));
        }
      });
    });

    // webpack 5 不再自动注入 node polyfill，
    // 静态替换 process.env.IS_ELECTRON / process.platform，避免浏览器端 process is not defined
    config.plugin('define-electron-flag').use(webpack.DefinePlugin, [
      {
        'process.env.IS_ELECTRON': false,
        'process.platform': "''",
      },
    ]);

    config.module.rules.delete('svg');
    config.module.rule('svg').exclude.add(resolve('src/assets/icons')).end();
    config.module
      .rule('icons')
      .test(/\.svg$/)
      .include.add(resolve('src/assets/icons'))
      .end()
      .use('svg-sprite-loader')
      .loader('svg-sprite-loader')
      .options({
        symbolId: 'icon-[name]',
      })
      .end();

    config.module
      .rule('webpack4_es_fallback')
      .test(/\.js$/)
      .include.add(/node_modules/)
      .end()
      .use('esbuild-loader')
      .loader('esbuild-loader')
      .options({ target: 'es2015', format: 'cjs' })
      .end();

    // LimitChunkCountPlugin 可以通过合并块来对 chunk 进行后期处理。用以解决 chunk 包太多的问题
    config.plugin('chunkPlugin').use(webpack.optimize.LimitChunkCountPlugin, [
      {
        maxChunks: 3,
      },
    ]);
  },
};
