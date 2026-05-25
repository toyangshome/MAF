/**
 * Express proxy server for MAF-UI Tauri backend.
 *
 * Listens on HTTP ports 28001 (control) and 28002 (turnstile).
 * All `/ws/` requests are upgraded and forwarded to the Rust backend
 * via a unix domain socket. Regular HTTP requests are proxied as well.
 *
 * When the unix socket is unavailable (development without Tauri),
 * the server falls back to a mock engine.
 */

import express from 'express';
import http from 'node:http';
import net from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'node:url';

// ── Configuration ──────────────────────────────────────────────────────

const CONTROL_PORT = parseInt(process.env.CONTROL_PORT ?? '28001', 10);
const TURNSTILE_PORT = parseInt(process.env.TURNSTILE_PORT ?? '28002', 10);
const UNIX_SOCK = process.env.UNIX_SOCK_PATH ?? '/tmp/maf-ipc.sock';

// ── Helpers ────────────────────────────────────────────────────────────

function log(prefix: string, msg: string) {
  console.log(`[${prefix}] ${new Date().toISOString()} ${msg}`);
}

// ── Unix socket proxy ──────────────────────────────────────────────────

interface ProxyResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Forward an HTTP request to the Rust backend via unix socket.
 * Returns a promise that resolves with the response.
 */
function proxyToRust(req: express.Request, _res: express.Response): Promise<ProxyResult> {
  return new Promise((resolve, reject) => {
    const options: net.TcpSocketConnectOpts & { path?: string } = {
      path: UNIX_SOCK,
    };

    const upstreamReq =
      `POST ${req.url} HTTP/1.1\r\n` +
      `Host: localhost\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(JSON.stringify(req.body ?? {}))}\r\n` +
      `\r\n` +
      JSON.stringify(req.body ?? {});

    const sock = net.createConnection(options, () => {
      sock.write(upstreamReq);
    });

    let data = '';
    sock.on('data', (chunk) => {
      data += chunk.toString();
    });

    sock.on('end', () => {
      const [headerSection, ...bodyParts] = data.split('\r\n\r\n');
      const statusLine = headerSection?.split('\r\n')[0] ?? 'HTTP/1.1 500 Internal Server Error';
      const statusCode = parseInt(statusLine.split(' ')[1] ?? '500', 10);
      const headers: Record<string, string> = {};
      for (const line of (headerSection ?? '').split('\r\n').slice(1)) {
        const [k, ...v] = line.split(':');
        if (k) headers[k.trim().toLowerCase()] = v.join(':').trim();
      }
      resolve({
        statusCode,
        headers,
        body: bodyParts.join('\r\n\r\n'),
      });
    });

    sock.on('error', (err) => {
      reject(err);
    });
  });
}

// ── WebSocket upgrade forwarding ───────────────────────────────────────

/**
 * Forward a WebSocket connection to the Rust backend via unix socket.
 * Uses HTTP upgrade mechanism over the unix socket.
 */
function forwardWsToRust(
  clientWs: WebSocket,
  requestUrl: string,
  _serverLabel: string,
) {
  const upgradeReq =
    `GET ${requestUrl} HTTP/1.1\r\n` +
    `Host: localhost\r\n` +
    `Upgrade: websocket\r\n` +
    `Connection: Upgrade\r\n` +
    `Sec-WebSocket-Key: ${Buffer.from(Math.random().toString()).toString('base64')}\r\n` +
    `Sec-WebSocket-Version: 13\r\n` +
    `\r\n`;

  const sock = net.createConnection({ path: UNIX_SOCK }, () => {
    sock.write(upgradeReq);
  });

  sock.on('data', (chunk) => {
    // Forward raw bytes from Rust to client
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(chunk.toString());
    }
  });

  clientWs.on('message', (data) => {
    // Forward client messages to Rust
    if (!sock.destroyed) {
      sock.write(typeof data === 'string' ? data : data.toString());
    }
  });

  clientWs.on('close', () => {
    sock.destroy();
  });

  sock.on('end', () => {
    clientWs.close();
  });

  sock.on('error', (err) => {
    log('ws-proxy', `unix socket error: ${err.message}`);
    clientWs.close(1014, 'upstream error');
  });
}

// ── Mock engine (when Rust backend is not available) ───────────────────

const MOCK_RESPONSES: Record<string, unknown> = {
  '/api/health': { status: 'ok', mock: true },
  '/api/window-info': {
    label: 'main',
    title: 'MAF UI (Mock)',
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
  },
};

function createMockApp(label: string): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mock: true, label });
  });

  app.get('/api/window-info', (_req, res) => {
    res.json(MOCK_RESPONSES['/api/window-info']);
  });

  app.post('/api/start', (req, res) => {
    const body = req.body as { task_description?: string; task_id?: string };
    log('mock', `start task: ${body.task_description ?? body.task_id}`);
    res.json({ status: 'accepted', task_id: body.task_id ?? `mock-${Date.now()}` });
  });

  return app;
}

// ── Build Express app ──────────────────────────────────────────────────

function buildServer(label: string): express.Express {
  const app = express();
  app.use(express.json());

  // Health check (always local)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', label, unixSockAvailable: true });
  });

  // Catch-all: proxy to Rust via unix socket
  app.all('/api/*', async (req, res) => {
    try {
      const result = await proxyToRust(req, res);
      res.status(result.statusCode);
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
      res.send(result.body);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(label, `proxy error: ${msg}`);
      // Fall back to mock
      const mock = createMockApp(label);
      mock(req, res);
    }
  });

  return app;
}

// ── Start servers ──────────────────────────────────────────────────────

function startServer(port: number, label: string) {
  const app = buildServer(label);
  const httpServer = http.createServer(app);

  // Attach WebSocket server for /ws/ paths
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '/';
    if (!url.startsWith('/ws/')) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      log(label, `WS upgrade: ${url}`);
      forwardWsToRust(ws, url, label);
    });
  });

  httpServer.listen(port, () => {
    log(label, `listening on http://localhost:${port}`);
  });

  return httpServer;
}

// ── Main ───────────────────────────────────────────────────────────────

const _controlServer = startServer(CONTROL_PORT, 'control');
const _turnstileServer = startServer(TURNSTILE_PORT, 'turnstile');

log('main', `Proxy started — control=${CONTROL_PORT}, turnstile=${TURNSTILE_PORT}`);
log('main', `Unix socket: ${UNIX_SOCK}`);

export { buildServer, startServer, forwardWsToRust, proxyToRust };
