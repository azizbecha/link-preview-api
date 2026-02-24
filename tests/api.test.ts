import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../src/index";

const MOCK_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Example Page</title>
  <meta property="og:title" content="OG Title" />
  <meta property="og:description" content="OG Description" />
  <meta property="og:image" content="https://example.com/image.png" />
  <meta property="og:site_name" content="Example" />
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
    expect(body.images).toContain("https://example.com/image.png");
    expect(body.siteName).toBe("Example");
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
