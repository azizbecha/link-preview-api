import { describe, it, expect, vi, beforeEach } from "vitest";
import { cacheKey } from "../lib/cache";

const mockKvGet = vi.fn();
const mockKvSet = vi.fn();

vi.mock("@vercel/kv", () => ({
  createClient: () => ({
    get: (...args: unknown[]) => mockKvGet(...args),
    set: (...args: unknown[]) => mockKvSet(...args),
  }),
}));

vi.stubEnv("KV_REST_API_URL", "https://fake-kv.vercel.app");
vi.stubEnv("KV_REST_API_TOKEN", "fake-token");

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

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(MOCK_HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    )
  );
}

// Dynamically import app after mocks are set up
async function getApp() {
  const { app } = await import("../src/index");
  return app;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mockKvGet.mockReset();
  mockKvSet.mockReset();
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
    stubFetch();
    mockKvGet.mockResolvedValue(null);
    mockKvSet.mockResolvedValue("OK");

    const app = await getApp();
    const res = await app.request("/get?url=https://example.com");

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(mockKvGet).toHaveBeenCalledOnce();
    expect(mockKvSet).toHaveBeenCalledOnce();
  });

  it("returns X-Cache: HIT when data is in KV", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const cachedData = { status: 200, title: "Cached Title" };
    mockKvGet.mockResolvedValue(cachedData);

    const app = await getApp();
    const res = await app.request("/get?url=https://example.com");

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("HIT");
    const body = await res.json();
    expect(body.title).toBe("Cached Title");
    // fetch should not have been called — response came from cache
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns X-Cache: BYPASS when noCache=true", async () => {
    stubFetch();

    const app = await getApp();
    const res = await app.request("/get?url=https://example.com&noCache=true");

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("BYPASS");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(mockKvGet).not.toHaveBeenCalled();
  });

  it("falls through when KV read fails", async () => {
    stubFetch();
    mockKvGet.mockRejectedValue(new Error("KV connection error"));
    mockKvSet.mockResolvedValue("OK");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const app = await getApp();
    const res = await app.request("/get?url=https://example.com");

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("does not cache error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );
    mockKvGet.mockResolvedValue(null);

    const app = await getApp();
    const res = await app.request("/get?url=https://example.com");

    expect(res.status).toBe(500);
    expect(mockKvSet).not.toHaveBeenCalled();
  });
});
