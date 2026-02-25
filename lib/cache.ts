import { createMiddleware } from "hono/factory";
import { env } from "../src/env";
import {
  CACHE_TTL_SECONDS,
  CACHE_KEY_PREFIX,
} from "../constants";
import { normalizeUrl } from "./normalizeUrl";

function isKvConfigured(): boolean {
  return Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
}

export async function cacheKey(url: string): Promise<string> {
  const data = new TextEncoder().encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${CACHE_KEY_PREFIX}${hashHex}`;
}

export function cacheMiddleware() {
  return createMiddleware(async (c, next) => {
    const noCache = c.req.query("noCache") === "true";

    if (noCache) {
      c.header("X-Cache", "BYPASS");
      await next();
      c.header("Cache-Control", "no-store");
      return;
    }

    const url = c.req.query("url");

    if (!url || !isKvConfigured()) {
      await next();
      return;
    }

    const normalizedUrl = normalizeUrl(url);
    const key = await cacheKey(normalizedUrl);

    // Use REST API directly to avoid SDK issues
    const kvUrl = `${env.KV_REST_API_URL}/get/${key}`;
    let cached = null;
    try {
      const response = await fetch(kvUrl, {
        headers: { Authorization: `Bearer ${env.KV_REST_API_TOKEN}` },
      });
      const rawText = await response.text();
      const data = JSON.parse(rawText) as { result?: unknown };
      if (data.result) {
        if (typeof data.result === "string") {
          cached = JSON.parse(data.result);
        } else if (typeof data.result === "object") {
          cached = data.result;
        }
      }
    } catch (err) {
      console.warn("KV read failed:", err);
    }

    if (cached) {
      c.header("X-Cache", "HIT");
      c.header(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
      );
      return c.json(cached);
    }

    c.header("X-Cache", "MISS");
    await next();

    // Post-handler: cache successful responses
    const status = c.res.status;

    if (status === 200) {
      c.header(
        "Cache-Control",
        "no-cache, no-store, must-revalidate"
      );

      try {
        const body = await c.res.clone().json();
        const setUrl = `${env.KV_REST_API_URL}/set/${key}/${encodeURIComponent(JSON.stringify(body))}?ex=${CACHE_TTL_SECONDS}`;
        await fetch(setUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.KV_REST_API_TOKEN}`,
          },
        });
      } catch (err) {
        console.warn("KV write failed:", err);
      }
    }
  });
}
