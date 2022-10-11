import os from 'os';
import fs from 'fs';
import path from 'path';
import http, { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'http';
import https from 'https';
import { URL } from 'url';
import { build, BuildOptions, BuildResult, Plugin } from 'esbuild';
import { getMimeType } from './mime';
import { openUrl } from './openUrl';

const LIVE_RELOAD_SCRIPT_PATH = path.join(__dirname, 'livereload.js');

const injectScript = (html: string, scriptSource: string) => {
  const bodyEndPosition = html.lastIndexOf('</body>');
  const injectPosition = bodyEndPosition === -1 ? html.length : bodyEndPosition;
  return (
    html.substring(0, injectPosition) +
    `<script>${scriptSource}</script>\n` +
    html.substring(injectPosition)
  );
};

export type ProxyRewriteFunction = (
  path: string
) => string | undefined | null | void;

export type ServerOptions = {
  static?: string;
  port?: number;
  historyApiFallback?: boolean;
  injectLiveReload?: boolean;
  open?: boolean | string;
  proxy?: ProxyRewriteFunction | Record<string, string>;
  onProxyRewrite?: (
    proxyRes: IncomingMessage,
    localUrl: string,
    proxyUrl: string
  ) => IncomingMessage;
};

function createProxyRewriter(
  proxy?: ProxyRewriteFunction | Record<string, string>
): ProxyRewriteFunction {
  if (typeof proxy === 'function') {
    return proxy;
  } else if (
    proxy !== null &&
    typeof proxy === 'object' &&
    Object.keys(proxy).length !== 0
  ) {
    const keys = Object.keys(proxy);
    return (path: string) => {
      for (const key of keys) {
        if (path.startsWith(key)) {
          return proxy[key] + path;
        }
      }
      return null;
    };
  }

  return () => null;
}

function createServerSentEventHandler() {
  const listeners = new Set<ServerResponse>();
  const setupConnection = (req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    listeners.add(res);
    req.on('close', () => {
      listeners.delete(res);
    });
  };

  const sendMessage = (data: any) => {
    listeners.forEach((res) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  };

  return { setupConnection, sendMessage };
}

export function createServer(
  buildOptions: BuildOptions = {},
  serverOptions: ServerOptions = {}
) {
  const {
    historyApiFallback = false,
    port = 8080,
    injectLiveReload = true,
    open = false,
    proxy,
    onProxyRewrite = (proxyRes) => proxyRes,
  } = serverOptions;
  const serverUrl = `http://localhost:${port}`;

  const buildDir = path.resolve(
    buildOptions.outfile
      ? path.dirname(buildOptions.outfile)
      : buildOptions.outdir ??
          fs.mkdtempSync(path.join(os.tmpdir(), 'esbuild-'))
  );
  const staticDirs = [buildDir];
  const staticDir = serverOptions.static && path.resolve(serverOptions.static);
  if (staticDir) {
    staticDirs.push(staticDir);
  }

  let buildStart = Date.now();
  let buildResolver = () => {};
  let buildPromise = Promise.resolve();

  const buildListeners = createServerSentEventHandler();
  const proxyRewrite = createProxyRewriter(proxy);

  const buildStatusPlugin: Plugin = {
    name: 'build-status',
    setup(build) {
      build.onStart(() => {
        buildStart = Date.now();
        buildPromise = new Promise((resolve) => {
          buildResolver = resolve;
        });
        buildListeners.sendMessage({ type: 'build-start' });
      });
      build.onEnd((result) => {
        const duration = Date.now() - buildStart;
        buildStart = -1;
        buildResolver();
        const success = result.errors.length === 0;
        buildListeners.sendMessage({ type: 'build-end', duration, success });
      });
    },
  };

  function sendHtml(res: ServerResponse, html: string, status = 200) {
    const body = injectLiveReload
      ? injectScript(
          html,
          fs.readFileSync(LIVE_RELOAD_SCRIPT_PATH, { encoding: 'utf8' })
        )
      : html;

    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store, must-revalidate',
    });
    return res.end(body);
  }

  async function sendFile(res: ServerResponse, filePath: string) {
    const file = await fs.promises.open(filePath, 'r');
    try {
      const stat = await file.stat();
      if (!stat.isFile()) {
        const err = new Error('Path is directory') as any;
        err.code = 'EISDIR';
        throw err;
      }
      const contentType = getMimeType(filePath);

      if (contentType === 'text/html') {
        // Treat html differently so we can inject livereload script
        const html = await file.readFile({ encoding: 'utf8' });
        file.close();
        return sendHtml(res, html);
      }

      const headers: OutgoingHttpHeaders = {
        'Content-Length': stat.size,
        'Cache-Control': 'no-store, must-revalidate',
      };
      if (contentType) {
        headers['Content-Type'] = contentType;
      }
      res.writeHead(200, headers);

      // @ts-ignore – for some reason the types doesn't include this one
      const readStream = file.createReadStream({ autoClose: true });
      readStream.pipe(res, { end: true });
      readStream.on('close', () => {
        file.close();
      });
    } catch (err) {
      file.close();
      throw err;
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(`${serverUrl}${req.url}`);

    switch (url.pathname) {
      case '/esbuild-livereload': {
        return buildListeners.setupConnection(req, res);
      }
      case '/esbuild-livereload.js': {
        return await sendFile(res, LIVE_RELOAD_SCRIPT_PATH);
      }
    }

    const rewrite = proxyRewrite(req.url!);
    if (rewrite) {
      const target = new URL(rewrite);
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        throw new Error(
          'Proxy rewrites must return an absolute http/https URL'
        );
      }
      const request =
        target.protocol === 'http:' ? http.request : https.request;
      return req.pipe(
        request(
          rewrite,
          {
            method: req.method,
            headers: { ...req.headers, host: target.host! },
          },
          (proxyRes) => {
            const finalRes = onProxyRewrite(proxyRes, req.url!, rewrite);
            res.writeHead(finalRes.statusCode!, finalRes.headers);
            finalRes.pipe(res, { end: true });
          }
        ),
        { end: true }
      );
    }

    // Stall request while rebuilding to not serve stale files
    if (buildStart !== -1) {
      await buildPromise;
    }

    // Attempt to serve file from build or static directory
    for (const dir of staticDirs) {
      const staticFilePath = path.normalize(
        path.join(dir, url.pathname === '/' ? 'index.html' : url.pathname)
      );
      if (staticFilePath.startsWith(dir)) {
        try {
          return await sendFile(res, staticFilePath);
        } catch (err: any) {
          if (err.code !== 'ENOENT' && err.code !== 'EISDIR') {
            throw err;
          }
        }
      }
    }

    if (historyApiFallback && staticDir && path.extname(url.pathname) === '') {
      try {
        return await sendFile(res, path.join(staticDir, 'index.html'));
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }

    sendHtml(res, '<h1>Not found</h1>', 404);
  });

  let stopped = false;
  let buildResult: BuildResult;
  const start = () => {
    server.listen(port);
    return build({
      watch: true,
      outdir:
        !buildOptions.outdir && !buildOptions.outfile ? buildDir : undefined,
      ...buildOptions,
      plugins: (buildOptions.plugins ?? []).concat(buildStatusPlugin),
    }).then((result) => {
      buildResult = result;
      if (stopped) {
        if (result.stop) {
          result.stop();
        }
      } else if (result.errors.length === 0 && open) {
        openUrl(`${serverUrl}${typeof open === 'string' ? open : '/'}`);
      }
      return result;
    });
  };

  const stop = () => {
    stopped = true;
    server.close();
    if (buildResult && buildResult.stop) {
      buildResult.stop();
    }
  };

  return { start, stop, url: serverUrl };
}

export default createServer;
