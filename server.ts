// @ts-nocheck -- This file runs in Bun inside the production container.
const STATIC_ROOT = "/app/public";
const PORT = Number(Bun.env.PORT ?? 80);

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
} as const;

async function proxyBinance(request: Request, url: URL, prefix: keyof typeof UPSTREAMS) {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const path = url.pathname.slice(prefix.length);
  if (!path.startsWith("/api/v3/") && !path.startsWith("/fapi/v1/")) {
    return new Response("Unsupported Binance path", { status: 404 });
  }

  let lastStatus = 502;
  for (const upstream of UPSTREAMS[prefix]) {
    try {
      const response = await fetch(`${upstream}${path}${url.search}`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10_000),
      });
      lastStatus = response.status;
      if (!response.ok) continue;
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("content-type") ?? "application/json",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      // Try the next Binance market-data endpoint.
    }
  }
  return Response.json({ error: "Binance upstream unavailable" }, { status: lastStatus });
}

async function serveStatic(url: URL) {
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  if (pathname.includes("..") || pathname === "/server.ts" || pathname === "/Dockerfile") {
    return new Response("Not found", { status: 404 });
  }
  if (pathname === "/") pathname = "/index.html";
  const file = Bun.file(`${STATIC_ROOT}${pathname}`);
  if (await file.exists()) return new Response(file);
  const notFound = Bun.file(`${STATIC_ROOT}/404.html`);
  return new Response(notFound, { status: 404 });
}

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/binance-spot/")) {
      return proxyBinance(request, url, "/binance-spot");
    }
    if (url.pathname.startsWith("/binance-futures/")) {
      return proxyBinance(request, url, "/binance-futures");
    }
    return serveStatic(url);
  },
});

console.log(`Scanner server listening on port ${PORT}`);
