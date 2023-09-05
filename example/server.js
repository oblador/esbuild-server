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
    onSendHtml: (html, status) => {
      console.log(`Modifying HTML response with status ${status}`);
      return html.replace('Hello World', 'Lorem Ipsum');
    },
    open: true,
  }
);

const buildStart = Date.now();
server
  .start()
  .then(() => {
    console.log(`Build completed in ${Date.now() - buildStart}ms`);
  })
  .catch(() => {
    console.error('Build failed');
  });
console.log(`Development server running at ${server.url}`);
