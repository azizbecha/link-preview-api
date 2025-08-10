import express from "express";
import type { Request, Response } from "express";
import { validURL } from "../lib/validUrl";
import { getLinkPreview } from "link-preview-js";
import { LinkPreviewResponse } from "../types";
import cors from "cors";
import { normalizeUrl } from "../lib/normalizeUrl";
import {
  DEFAULT_PORT,
  DEFAULT_TIMEOUT,
  MAX_TIMEOUT,
  MIN_TIMEOUT,
} from "../constants";

const app = express();
const PORT = process.env.PORT || DEFAULT_PORT;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ status: 200 });
});

app.get("/get", async (req: Request, res: Response) => {
  const { url, timeout } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  if (typeof url !== "string" || !validURL(url)) {
    return res.status(400).json({ error: "Invalid 'url' query parameter" });
  }

  try {
    const finalUrl = normalizeUrl(url);
    const finalTimeout =
      typeof timeout === "string" && !isNaN(parseInt(timeout))
        ? Math.min(Math.max(parseInt(timeout), MIN_TIMEOUT), MAX_TIMEOUT)
        : DEFAULT_TIMEOUT;

    const data = await getLinkPreview(finalUrl, {
      followRedirects: "follow",
      timeout: finalTimeout,
    });

    const normalized: LinkPreviewResponse = {
      title: (data as any).title || (data as any).pageTitle,
      description: (data as any).description || (data as any).metaDescription,
      url: (data as any).url || url,
      images:
        (data as any).images ||
        ((data as any).image ? [(data as any).image] : []),
      favicons: (data as any).favicons || [],
      mediaType: (data as any).mediaType,
      contentType: (data as any).contentType,
      siteName: (data as any).siteName || (data as any).site,
    };

    res.status(200).json({ status: 200, ...normalized });
  } catch (error) {
    console.error("Error fetching link preview:", error);
    res.status(500).json({ error: "Failed to fetch link preview" });
  }
});

export default app;
