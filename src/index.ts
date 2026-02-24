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
