import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { validURL } from "../lib/validUrl";
import { fetchLinkPreview } from "../lib/fetchPreview";
import { normalizeUrl } from "../lib/normalizeUrl";
import { cacheMiddleware } from "../lib/cache";
import {
  DEFAULT_TIMEOUT,
  MAX_TIMEOUT,
  MIN_TIMEOUT,
} from "../constants";
import { env } from "./env";

const querySchema = z.object({
  url: z
    .string({ error: "Missing 'url' query parameter" })
    .refine(validURL, { message: "Invalid 'url' query parameter" }),
  timeout: z.coerce
    .number()
    .min(MIN_TIMEOUT)
    .max(MAX_TIMEOUT)
    .default(DEFAULT_TIMEOUT)
    .optional(),
  noCache: z.string().optional(),
});

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => {
  return c.json({ status: 200 });
});

// Temporary debug endpoint
app.get("/debug/redis", async (c) => {
  const { Redis } = await import("@upstash/redis");
  const key = c.req.query("key");
  const action = c.req.query("action") || "read";
  try {
    const redis = new Redis({
      url: env.KV_REST_API_URL!,
      token: env.KV_REST_API_TOKEN!,
    });
    if (key && action === "read") {
      const result = await redis.get(key);
      return c.json({ key, result, type: typeof result, isNull: result === null });
    }
    if (key && action === "write") {
      await redis.set(key, { test: "data" }, { ex: 60 });
      const result = await redis.get(key);
      return c.json({ key, writeOk: true, readResult: result });
    }
    // Default: write + read test
    await redis.set("test:debug", { hello: "world" }, { ex: 60 });
    const result = await redis.get("test:debug");
    return c.json({ writeOk: true, readResult: result, readType: typeof result });
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});

app.get(
  "/get",
  cacheMiddleware(),
  zValidator("query", querySchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid query parameters";
      return c.json({ error: message }, 400);
    }
  }),
  async (c) => {
    const { url, timeout } = c.req.valid("query");

    try {
      const finalUrl = normalizeUrl(url);
      const preview = await fetchLinkPreview(finalUrl, timeout ?? DEFAULT_TIMEOUT);
      return c.json({ status: 200, ...preview });
    } catch (error) {
      console.error("Error fetching link preview:", error);
      return c.json({ error: "Failed to fetch link preview" }, 500);
    }
  }
);

export { app };

export default app;
