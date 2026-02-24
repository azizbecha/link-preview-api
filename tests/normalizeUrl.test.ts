import { describe, it, expect } from "vitest";
import { normalizeUrl } from "../lib/normalizeUrl";

describe("normalizeUrl", () => {
  it("prepends https:// when no protocol is present", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  it("keeps https:// URLs unchanged", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("keeps http:// URLs unchanged", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("preserves path and query when adding protocol", () => {
    expect(normalizeUrl("example.com/page?q=1")).toBe(
      "https://example.com/page?q=1"
    );
  });
});
