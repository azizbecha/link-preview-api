const CF_PATTERNS = [
  "<title>Just a moment...</title>",
  "<title>Attention Required</title>",
  "cf_chl_opt",
  "cf-browser-verification",
];

export function isCloudflareChallenge(html: string): boolean {
  return CF_PATTERNS.some((pattern) => html.includes(pattern));
}
