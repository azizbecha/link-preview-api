import express from "express";
import type { Request, Response } from "express";
import { validURL } from "../lib/validUrl";
import { fetchLinkPreview } from "../lib/fetchPreview";
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
      typeof timeout === "string" && !Number.isNaN(parseInt(timeout, 10))
        ? Math.min(Math.max(parseInt(timeout, 10), MIN_TIMEOUT), MAX_TIMEOUT)
        : DEFAULT_TIMEOUT;

    const preview = await fetchLinkPreview(finalUrl, finalTimeout);

    res.status(200).json({ status: 200, ...preview });
  } catch (error) {
    console.error("Error fetching link preview:", error);
    res.status(500).json({ error: "Failed to fetch link preview" });
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
