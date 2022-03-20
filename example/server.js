const { createServer } = require('..' /* esbuild-server */);
const server = createServer(
  {
    bundle: true,
    entryPoints: ['src/app.ts'],
  },
  {
    static: 'public',
    proxy: {
      '/info.0.json': 'https://xkcd.com',
    },
    onProxyRewrite: (proxyRes, localUrl, proxyUrl) => {
      console.log(`Proxying ${localUrl} to ${proxyUrl}`);
      return proxyRes;
    },
    open: true,
  }
);

const buildStart = Date.now();
server.start().then((buildResult) => {
  if (buildResult.errors.length === 0) {
    console.log(`Build completed in ${Date.now() - buildStart}ms`);
  } else {
    console.error('Build failed');
  }
});
console.log(`Development server running at ${server.url}`);
