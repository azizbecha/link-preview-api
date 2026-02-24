import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    PORT: z.coerce.number().default(3000),
    KV_REST_API_URL: z.url().optional(),
    KV_REST_API_TOKEN: z.string().optional(),
  },
  runtimeEnv: process.env,
});
