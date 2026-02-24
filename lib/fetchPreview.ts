import * as cheerio from "cheerio";
import { LinkPreviewResponse } from "../types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export async function fetchLinkPreview(
  url: string,
  timeout: number
): Promise<LinkPreviewResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";
    const html = await response.text();
    const $ = cheerio.load(html);

    const getMeta = (name: string): string | undefined => {
      return (
        $(`meta[property="${name}"]`).attr("content") ||
        $(`meta[name="${name}"]`).attr("content") ||
        undefined
      );
    };

    const title =
      getMeta("og:title") || getMeta("twitter:title") || $("title").text() || undefined;

    const description =
      getMeta("og:description") ||
      getMeta("twitter:description") ||
      getMeta("description") ||
      undefined;

    const siteName = getMeta("og:site_name") || undefined;

    const images: string[] = [];
    const ogImage = getMeta("og:image") || getMeta("twitter:image");
    if (ogImage) {
      images.push(ogImage);
    }

    const favicons: string[] = [];
    $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').each(
      (_, el) => {
        const href = $(el).attr("href");
        if (href) {
          // Resolve relative URLs
          try {
            favicons.push(new URL(href, url).href);
          } catch {
            favicons.push(href);
          }
        }
      }
    );

    const mediaType = getMeta("og:type") || "website";

    return {
      title,
      description,
      url,
      images,
      favicons,
      mediaType,
      contentType,
      siteName,
    };
  } finally {
    clearTimeout(timer);
  }
}
