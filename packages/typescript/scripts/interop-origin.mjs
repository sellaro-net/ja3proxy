import { createServer } from 'node:http';

// Runs in a separate process: blocking sync SDK calls must not starve this origin.
const bytes = Buffer.from(Array.from({ length: 196_613 }, (_, index) => index % 251));
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://origin.invalid').pathname;
  if (pathname === '/echo') {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 512 * 1024) { response.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    response.writeHead(200, { 'content-type': 'application/octet-stream' }).end(Buffer.concat(chunks));
  } else if (pathname === '/stream') {
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.write(bytes.subarray(0, 65_537));
    response.end(bytes.subarray(65_537));
  } else if (pathname === '/oversize') {
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.write(bytes.subarray(0, 64));
    const timer = setTimeout(() => response.end(bytes.subarray(64, 16_384)), 30);
    response.on('close', () => clearTimeout(timer));
  } else if (pathname === '/slow') {
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.write(Buffer.from([1]));
    const interval = setInterval(() => response.write(Buffer.from([2])), 100);
    const deadline = setTimeout(() => response.end(), 30_000);
    response.on('close', () => { clearInterval(interval); clearTimeout(deadline); });
  } else if (pathname === '/cookies/set') {
    response.writeHead(200, { 'set-cookie': ['smoke=server; Path=/; HttpOnly; SameSite=Lax'] }).end('set');
  } else if (pathname === '/cookies') {
    response.writeHead(200, { 'content-type': 'text/plain' }).end(request.headers.cookie ?? '');
  } else {
    response.writeHead(404).end();
  }
});
server.on('clientError', (_error, socket) => socket.destroy());
server.listen(Number(process.env.JA3_SMOKE_ORIGIN_PORT ?? 0), process.env.JA3_SMOKE_ORIGIN_BIND ?? '0.0.0.0', () => {
  process.send?.({ port: server.address().port });
});
function close() { server.closeAllConnections(); server.close(() => process.exit(0)); }
process.on('message', message => { if (message === 'close') close(); });
process.on('disconnect', close);
