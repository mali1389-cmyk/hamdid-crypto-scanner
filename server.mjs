import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const STATIC_ROOT = "/app/public";
const PORT = Number(process.env.PORT ?? 80);
const UPSTREAMS = {
  "/binance-spot": [
    "https://data-api.binance.vision",
    "https://api1.binance.com",
    "https://api2.binance.com",
    "https://api3.binance.com",
    "https://api.binance.com",
  ],
  "/binance-futures": [
    "https://fapi.binance.com",
    "https://fapi1.binance.com",
    "https://fapi2.binance.com",
    "https://fapi3.binance.com",
    "https://fapi4.binance.com",
  ],
};
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function proxyBinance(request, response, url, prefix) {
  if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed" });
  const path = url.pathname.slice(prefix.length);
  if (!path.startsWith("/api/v3/") && !path.startsWith("/fapi/v1/")) {
    return sendJson(response, 404, { error: "Unsupported Binance path" });
  }

  let lastStatus = 502;
  for (const upstream of UPSTREAMS[prefix]) {
    try {
      const upstreamResponse = await fetch(`${upstream}${path}${url.search}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10_000),
      });
      lastStatus = upstreamResponse.status;
      if (!upstreamResponse.ok) continue;
      const body = Buffer.from(await upstreamResponse.arrayBuffer());
      response.writeHead(upstreamResponse.status, {
        "Content-Type": upstreamResponse.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      });
      return response.end(body);
    } catch {
      // Try the next market-data endpoint.
    }
  }
  return sendJson(response, lastStatus, { error: "Binance upstream unavailable" });
}

async function serveStatic(response, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end("Bad path");
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const relative = normalize(pathname).replace(/^[/\\]+/, "");
  if (relative.startsWith("..") || relative === "server.mjs" || relative === "Dockerfile") {
    response.writeHead(404).end("Not found");
    return;
  }
  let filePath = join(STATIC_ROOT, relative);
  try {
    if (!(await stat(filePath)).isFile()) throw new Error("Not a file");
  } catch {
    filePath = join(STATIC_ROOT, "404.html");
    response.statusCode = 404;
  }
  response.setHeader("Content-Type", MIME_TYPES[extname(filePath)] ?? "application/octet-stream");
  createReadStream(filePath).pipe(response);
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (url.pathname.startsWith("/binance-spot/")) {
      return await proxyBinance(request, response, url, "/binance-spot");
    }
    if (url.pathname.startsWith("/binance-futures/")) {
      return await proxyBinance(request, response, url, "/binance-futures");
    }
    return await serveStatic(response, url);
  } catch {
    return sendJson(response, 500, { error: "Internal server error" });
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Scanner server listening on port ${PORT}`);
});
