import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../src/index";

const MOCK_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Example Page</title>
  <meta property="og:title" content="OG Title" />
  <meta property="og:description" content="OG Description" />
  <meta property="og:image" content="https://example.com/image.png" />
  <meta property="og:site_name" content="Example" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:video" content="https://example.com/video.mp4" />
  <meta name="author" content="John Doe" />
  <meta name="keywords" content="example, test, preview" />
  <meta name="theme-color" content="#ff6600" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@example" />
  <link rel="canonical" href="https://example.com" />
  <link rel="icon" href="/favicon.ico" />
</head>
<body></body>
</html>
`;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GET /", () => {
  it("returns 200 status", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 200 });
  });
});

describe("GET /get", () => {
  it("returns 400 when url is missing", async () => {
    const res = await app.request("/get");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for an invalid url", async () => {
    const res = await app.request("/get?url=not%20a%20url");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns 200 with preview data for a valid url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(MOCK_HTML, {
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      )
    );

    const res = await app.request("/get?url=https://example.com");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe(200);
    expect(body.title).toBe("OG Title");
    expect(body.description).toBe("OG Description");
    expect(body.images).toContainEqual(expect.objectContaining({ url: "https://example.com/image.png" }));
    expect(body.siteName).toBe("Example");
    expect(body.charset).toBe("utf-8");
    expect(body.author).toBe("John Doe");
    expect(body.canonical).toBe("https://example.com");
    expect(body.locale).toBe("en_US");
    expect(body.keywords).toEqual(["example", "test", "preview"]);
    expect(body.themeColor).toBe("#ff6600");
    expect(body.twitterCard).toBe("summary_large_image");
    expect(body.twitterSite).toBe("@example");
    expect(body.video).toBe("https://example.com/video.mp4");
  });

  it("returns 500 when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const res = await app.request("/get?url=https://example.com");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch link preview");
  });
});
