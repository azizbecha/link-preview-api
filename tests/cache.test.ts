import { describe, it, expect, vi, beforeEach } from "vitest";
import { cacheKey } from "../lib/cache";

vi.mock("../src/env", () => ({
  env: {
    KV_REST_API_URL: "https://fake-kv.upstash.io",
    KV_REST_API_TOKEN: "fake-token",
  },
}));

const KV_BASE = "https://fake-kv.upstash.io";

const MOCK_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <meta property="og:title" content="Test Title" />
  <meta property="og:description" content="Test Description" />
</head>
<body></body>
</html>
`;

/**
 * Creates a fetch mock that routes calls based on URL:
 * - KV GET requests  → configurable JSON response
 * - KV SET requests  → { result: "OK" }
 * - Everything else  → HTML preview response
 */
function createFetchMock(options: {
  kvGetResult?: unknown;
  kvGetError?: boolean;
  htmlError?: Error;
} = {}) {
  const calls = { kvGet: 0, kvSet: 0, html: 0 };

  const mock = vi.fn(async (url: string | URL | Request) => {
    const urlStr =
      typeof url === "string"
        ? url
        : url instanceof URL
          ? url.href
          : url.url;

    if (urlStr.startsWith(`${KV_BASE}/get/`)) {
      calls.kvGet++;
      if (options.kvGetError) {
        throw new Error("KV connection error");
      }
      return new Response(
        JSON.stringify({ result: options.kvGetResult ?? null }),
        { headers: { "content-type": "application/json" } }
      );
    }

    if (urlStr.startsWith(`${KV_BASE}/set/`)) {
      calls.kvSet++;
      return new Response(JSON.stringify({ result: "OK" }), {
        headers: { "content-type": "application/json" },
      });
    }

    // HTML preview fetch
    calls.html++;
    if (options.htmlError) {
      throw options.htmlError;
    }
    return new Response(MOCK_HTML, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  });

  return { mock, calls };
}

async function getApp() {
  const { app } = await import("../src/index");
  return app;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cacheKey", () => {
  it("returns deterministic keys for the same URL", async () => {
    const key1 = await cacheKey("https://example.com");
    const key2 = await cacheKey("https://example.com");
    expect(key1).toBe(key2);
  });

  it("returns different keys for different URLs", async () => {
    const key1 = await cacheKey("https://example.com");
    const key2 = await cacheKey("https://example.org");
    expect(key1).not.toBe(key2);
  });

  it("prefixes keys with lp:", async () => {
    const key = await cacheKey("https://example.com");
    expect(key.startsWith("lp:")).toBe(true);
  });
});

describe("cache middleware", () => {
  it("returns X-Cache: MISS on first request and caches to KV", async () => {
    const { mock, calls } = createFetchMock({ kvGetResult: null });
    vi.stubGlobal("fetch", mock);

    const app = await getApp();
    const res = await app.request("/get?url=https://example.com");

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(calls.kvGet).toBe(1);
    expect(calls.kvSet).toBe(1);
    expect(calls.html).toBe(1);
  });

  it("returns X-Cache: HIT when data is in KV", async () => {
    const cachedData = { status: 200, title: "Cached Title" };
    const { mock, calls } = createFetchMock({
      kvGetResult: JSON.stringify(cachedData),
    });
    vi.stubGlobal("fetch", mock);

    const app = await getApp();
    const res = await app.request("/get?url=https://example.com");

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("HIT");
    const body = await res.json();
    expect(body.title).toBe("Cached Title");
    // No HTML fetch — response came from cache
    expect(calls.html).toBe(0);
  });

  it("returns X-Cache: BYPASS when noCache=true", async () => {
    const { mock, calls } = createFetchMock();
    vi.stubGlobal("fetch", mock);

    const app = await getApp();
    const res = await app.request(
      "/get?url=https://example.com&noCache=true"
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("BYPASS");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(calls.kvGet).toBe(0);
  });

  it("falls through when KV read fails", async () => {
    const { mock } = createFetchMock({ kvGetError: true });
    vi.stubGlobal("fetch", mock);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const app = await getApp();
    const res = await app.request("/get?url=https://example.com");

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("does not cache error responses", async () => {
    const { mock, calls } = createFetchMock({
      kvGetResult: null,
      htmlError: new Error("Network error"),
    });
    vi.stubGlobal("fetch", mock);

    const app = await getApp();
    const res = await app.request("/get?url=https://example.com");

    expect(res.status).toBe(500);
    expect(calls.kvSet).toBe(0);
  });
});
