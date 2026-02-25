export interface OEmbedResponse {
  type: string;
  version?: string;
  title?: string;
  author_name?: string;
  author_url?: string;
  provider_name?: string;
  provider_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html?: string;
  width?: number;
  height?: number;
}

export interface PreviewImage {
  url: string;
  width?: number;
  height?: number;
}

export interface LinkPreviewResponse {
  title?: string;
  description?: string;
  url: string;
  images?: PreviewImage[];
  favicons?: string[];
  mediaType?: string;
  contentType?: string;
  siteName?: string;
  charset?: string;
  author?: string;
  canonical?: string;
  locale?: string;
  keywords?: string[];
  themeColor?: string;
  publisher?: string;
  twitterCard?: string;
  twitterSite?: string;
  video?: string;
  audio?: string;
}
