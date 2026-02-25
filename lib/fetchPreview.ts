import * as cheerio from "cheerio";
import type { LinkPreviewResponse } from "../types";
import { isCloudflareChallenge } from "./detectCloudflare";
import { fetchOEmbed, mapOEmbedToPreview } from "./oembed";

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
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";
    const html = await response.text();

    if (isCloudflareChallenge(html)) {
      const oembed = await fetchOEmbed(url, timeout);
      if (oembed) {
        return mapOEmbedToPreview(oembed, url);
      }
    }

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

    const author =
      getMeta("author") || getMeta("article:author") || undefined;

    const canonical =
      $('link[rel="canonical"]').attr("href") || getMeta("og:url") || undefined;

    const locale = getMeta("og:locale") || getMeta("language") || undefined;

    const keywordsRaw = getMeta("keywords");
    const keywords = keywordsRaw
      ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined;

    const themeColor = getMeta("theme-color") || undefined;

    const publisher =
      getMeta("og:site_name") || getMeta("publisher") || undefined;

    const twitterCard = getMeta("twitter:card") || undefined;
    const twitterSite = getMeta("twitter:site") || undefined;

    const video = getMeta("og:video") || getMeta("og:video:url") || undefined;
    const audio = getMeta("og:audio") || getMeta("og:audio:url") || undefined;

    const charsetMeta = $("meta[charset]").attr("charset");
    const charset =
      charsetMeta ||
      contentType.match(/charset=([^\s;]+)/i)?.[1] ||
      undefined;

    return {
      title,
      description,
      url,
      images,
      favicons,
      mediaType,
      contentType,
      siteName,
      charset,
      author,
      canonical,
      locale,
      keywords,
      themeColor,
      publisher,
      twitterCard,
      twitterSite,
      video,
      audio,
    };
  } finally {
    clearTimeout(timer);
  }
}
