// Local-only helper: wraps worker/index.js's fetch handler in a plain Node
// http server, so the exact deployable Worker code can be exercised over
// real HTTP during development without needing wrangler installed.
// NOT part of the deployment — wrangler dev / wrangler deploy replace this
// entirely once you're working directly against Cloudflare's runtime.
import http from 'http';
import worker from './index.js';

const server = http.createServer(async (nodeReq, nodeRes) => {
  const chunks = [];
  for await (const chunk of nodeReq) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const request = new Request(`http://localhost:8787${nodeReq.url}`, {
    method: nodeReq.method,
    headers: nodeReq.headers,
    body: ['GET', 'HEAD'].includes(nodeReq.method) ? undefined : body,
  });

  const response = await worker.fetch(request);
  nodeRes.writeHead(response.status, Object.fromEntries(response.headers));
  nodeRes.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(8787, () => console.log('Local Worker simulation on http://localhost:8787 (use wrangler dev for the real thing)'));
