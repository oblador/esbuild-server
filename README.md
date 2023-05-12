# esbuild-server

**⚡️ Fast, lightweight and powerful development server for esbuild ⚡️**

- Zero dependencies besides esbuild
- API proxy support
- Live reload
- SPA support through History API fallback
- Fully typed with TypeScript

## Installation

```bash
npm install --save-dev esbuild esbuild-server
```

## Usage

Create a new file for your dev server:

```js
// dev-server.js
require('esbuild-server')
  .createServer(
    {
      bundle: true,
      entryPoints: ['src/app.js'],
    },
    {
      static: 'public',
    }
  )
  .start();
```

Assuming you have an `index.html` file in the `public` folder you can now run the server with `node dev-server.js`.

See `example` folder for examples.

## API

### createServer(esbuildOptions, serverOptions)

#### `esbuildOptions`

Options passed to [esbuild Build API](https://esbuild.github.io/api/#build-api). If not specified `watch` defaults to `true` to enable continous build and live reload, and similarly if no type of output option is specified `outdir` is set to a temporary directory.

#### `serverOptions`

| Option                   | Description                                                                                                                                 | Default |
|--------------------------|---------------------------------------------------------------------------------------------------------------------------------------------| ------- |
| **`static`**             | Path to your static assets folder, should contain an `index.html` file.                                                                     | _None_  |
| **`port`**               | Port number to listen for requests on.                                                                                                      | `8080`  |
| **`historyApiFallback`** | For Single Page Apps using the HTML5 History API, the index.html page is served instead of 404 responses.                                   | `false` |
| **`injectLiveReload`**   | Inject snippet to automatically reload the page when file changes are detected.                                                             | `true`  |
| **`open`**               | Open the browser after server had been started. Set to a string to open a particular path.                                                  | `false` |
| **`proxy`**              | Proxy certain paths to a separate API backend when you want to serve API requests on the same domain. Pass a function for dynamic rewrites. | `{}`    |
| **`onProxyRewrite`**     | Callback function when a proxy rewrite happens, useful for logging or altering the response.                                                | _None_  |
| **`http`**               | http options.                                                                                                                               | _None_  |
| **`https`**              | https options.                                                                                                                              | _None_  |

## Proxying

### Static

```js
{
  proxy: {
    '/api': 'http://localhost:3000'
  }
}
```

A request to `/api/users` will now proxy the request to `http://localhost:3000/api/users`. If you want to rewrite the base use dynamic approach instead:

### Dynamic

```js
{
  proxy: (path) => {
    if (path.startsWith('/api')) {
      return path.replace(/^\/api/, 'http://localhost:3000');
    }
  };
}
```

A request to `/api/users` will now proxy the request to `http://localhost:3000/users`.

### Modifying the response

```js
{
  onProxyRewrite: (proxyRes, localUrl, proxyUrl) => {
    console.log(`Proxying ${localUrl} to ${proxyUrl}`);
    proxyRes.headers['x-my-custom-header'] = 'yep';
    return proxyRes;
  };
}
```

## Https

```js
{
    https: {
        key: fs.readFileSync('server.key'),
        cert: fs.readFileSync('server.crt'),
    }
}
```

## Live reload

If you want more control over where the live reload script is injected you can place it manually with:

```html
<script src="/esbuild-livereload.js" async></script>
```

## License

MIT © Joel Arvidsson 2022 – present
