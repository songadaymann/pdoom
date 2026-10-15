const HTML_LIMIT = 5 * 1024 * 1024;
const PLATFORM_ORIGIN = "https://mann.cool";
const GAME_SHELL_URL = `${PLATFORM_ORIGIN}/platform/v1/game-shell.js?v=20260809-tip-attribution1`;
const PLATFORM_PROXY_PATHS = new Set([
  "/platform/config.json",
  "/api/v1/plays",
  "/api/v1/wallets",
  "/api/v1/guestbook",
  "/api/v1/leaderboard",
]);

function responseHeaders(headers) {
  const next = new Headers(headers);
  next.delete("content-length");
  next.set("x-content-type-options", "nosniff");
  next.set("referrer-policy", "strict-origin-when-cross-origin");
  next.set("x-mann-cool-delivery", "dedicated-worker");
  return next;
}

function attribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function shell(config) {
  const leaderboardUrl = config.leaderboardUrl ? ` data-leaderboard-url="${attribute(config.leaderboardUrl)}"` : "";
  const leaderboardVariant = config.leaderboardVariant ? ` data-leaderboard-variant="${attribute(config.leaderboardVariant)}"` : "";
  const leaderboardBoards = config.leaderboardBoards?.length
    ? ` data-leaderboard-boards="${attribute(JSON.stringify(config.leaderboardBoards))}"`
    : "";
  const shellTheme = config.shellTheme
    ? ` data-shell-theme="${attribute(JSON.stringify(config.shellTheme))}"`
    : "";
  return `<script src="${GAME_SHELL_URL}" data-slug="${attribute(config.slug)}" data-title="${attribute(config.title)}" data-player-identity="true" data-leaderboard="${config.leaderboard ? "true" : "false"}"${leaderboardUrl}${leaderboardVariant}${leaderboardBoards}${shellTheme} defer></script>`;
}

function inject(html, config) {
  let document = html;
  if (!/<meta[^>]+name=["']viewport["']/i.test(document)) {
    const viewport = '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
    document = /<head(?:\s[^>]*)?>/i.test(document)
      ? document.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${viewport}`)
      : `${viewport}${document}`;
  }
  if (document.includes("/platform/v1/game-shell.js")) return document;
  return /<\/head>/i.test(document)
    ? document.replace(/<\/head>/i, `${shell(config)}</head>`)
    : `${shell(config)}${document}`;
}

function r2Headers(object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=31536000, immutable");
  return responseHeaders(headers);
}

async function fetchR2(request, env, config, assetPath) {
  if (!env.GAME_ASSETS || !["GET", "HEAD"].includes(request.method)) return null;
  let decoded;
  try { decoded = decodeURIComponent(assetPath).replace(/^\/+/, ""); }
  catch { return new Response("Invalid asset path", { status: 400 }); }
  if (!decoded || decoded.split("/").includes("..")) return null;
  const key = `${config.slug}/${decoded}`;
  if (request.method === "HEAD") {
    const object = await env.GAME_ASSETS.head(key);
    if (!object) return null;
    const headers = r2Headers(object);
    headers.set("content-length", String(object.size));
    return new Response(null, { status: 200, headers });
  }
  const object = await env.GAME_ASSETS.get(key, request.headers.get("range") ? { range: request.headers } : undefined);
  if (!object) return null;
  const headers = r2Headers(object);
  if (object.range) {
    const offset = object.range.offset ?? Math.max(0, object.size - (object.range.suffix || 0));
    const length = object.range.length ?? object.size - offset;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}

async function previewPlatformProxy(request, url) {
  // Canonical game routes never own these root platform paths. If a dedicated
  // game Worker receives one, it is running on localhost/workers.dev or behind
  // an intentionally broader preview route and should forward to mann.cool.
  if (!PLATFORM_PROXY_PATHS.has(url.pathname) && !url.pathname.startsWith("/api/v1/player/")) return null;
  const upstream = new URL(`${url.pathname}${url.search}`, PLATFORM_ORIGIN);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");
  headers.delete("x-forwarded-for");
  return fetch(upstream, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });
}

export function createStaticGameWorker(config) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.hostname === "www.mann.cool") {
        url.hostname = "mann.cool";
        return Response.redirect(url, 308);
      }
      const platformResponse = await previewPlatformProxy(request, url);
      if (platformResponse) return platformResponse;
      const prefix = `/${config.slug}`;
      if (url.pathname === prefix) {
        url.pathname = `${prefix}/`;
        return Response.redirect(url, 308);
      }
      const assetPath = url.pathname.startsWith(prefix+"/") ? url.pathname.slice(prefix.length) : url.pathname;
      const assetUrl = new URL(request.url);
      assetUrl.pathname = assetPath;
      const response = await env.ASSETS.fetch(new Request(assetUrl, request));
      if (response.status === 404) {
        const large = await fetchR2(request, env, config, assetPath);
        if (large) return large;
      }
      const headers = responseHeaders(response.headers);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          const target = new URL(location, assetUrl);
          if (target.origin === assetUrl.origin) headers.set("location", `${prefix}${target.pathname}${target.search}${target.hash}`);
        }
        return new Response(null, { status: response.status, headers });
      }
      if (!(response.headers.get("content-type") || "").toLowerCase().includes("text/html")) {
        return new Response(response.body, { status: response.status, headers });
      }
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > HTML_LIMIT) return new Response("Game document is too large", { status: 502 });
      const html = await response.text();
      if (new TextEncoder().encode(html).byteLength > HTML_LIMIT) return new Response("Game document is too large", { status: 502 });
      headers.set("content-type", "text/html; charset=utf-8");
      return new Response(inject(html, config), { status: response.status, headers });
    },
  };
}
