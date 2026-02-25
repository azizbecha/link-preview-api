import type { LinkPreviewResponse, OEmbedResponse } from "../types";

const NOEMBED_ENDPOINT = "https://noembed.com/embed";

export async function fetchOEmbed(
  url: string,
  timeout: number
): Promise<OEmbedResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const oembedUrl = `${NOEMBED_ENDPOINT}?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as OEmbedResponse & { error?: string };
    if (data.error) return null;

    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function mapOEmbedType(type: string): string {
  switch (type) {
    case "rich":
      return "article";
    case "video":
      return "video";
    case "photo":
      return "image";
    default:
      return "website";
  }
}

export function mapOEmbedToPreview(
  oembed: OEmbedResponse,
  originalUrl: string
): LinkPreviewResponse {
  const images: string[] = [];
  if (oembed.thumbnail_url) {
    images.push(oembed.thumbnail_url);
  }

  return {
    title: oembed.title || undefined,
    url: originalUrl,
    images,
    mediaType: mapOEmbedType(oembed.type),
    siteName: oembed.provider_name || undefined,
    author: oembed.author_name || undefined,
    publisher: oembed.provider_name || undefined,
  };
}
