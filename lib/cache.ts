import { createMiddleware } from "hono/factory";
import { createClient } from "@vercel/kv";
import {
  CACHE_TTL_SECONDS,
  CACHE_SWR_SECONDS,
  CACHE_KEY_PREFIX,
} from "../constants";

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  );
}

function getKv() {
  return createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
    cache: "no-store",
  });
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

    const key = await cacheKey(url);
    const kvClient = getKv();

    // Try KV read
    try {
      const cached = await kvClient.get<Record<string, unknown>>(key);
      if (cached) {
        c.header("X-Cache", "HIT");
        c.header(
          "Cache-Control",
          `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_SWR_SECONDS}`
        );
        return c.json(cached);
      }
    } catch (err) {
      console.warn("KV read failed, falling through:", err);
    }

    c.header("X-Cache", "MISS");
    await next();

    // Post-handler: cache successful responses
    if (c.res.status === 200) {
      c.header(
        "Cache-Control",
        `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_SWR_SECONDS}`
      );

      try {
        const body = await c.res.clone().json();
        await kvClient.set(key, body, { ex: CACHE_TTL_SECONDS });
      } catch (err) {
        console.warn("KV write failed:", err);
      }
    }
  });
}
