import { describe, it, expect } from "vitest";
import { validURL } from "../lib/validUrl";

describe("validURL", () => {
  it("accepts a full https URL", () => {
    expect(validURL("https://example.com")).toBe(true);
  });

  it("accepts a full http URL", () => {
    expect(validURL("http://example.com")).toBe(true);
  });

  it("accepts a URL without protocol", () => {
    expect(validURL("example.com")).toBe(true);
  });

  it("accepts a URL with path", () => {
    expect(validURL("https://example.com/page")).toBe(true);
  });

  it("accepts a URL with query string", () => {
    expect(validURL("https://example.com?q=test")).toBe(true);
  });

  it("accepts a URL with port", () => {
    expect(validURL("https://example.com:8080")).toBe(true);
  });

  it("accepts an IP address", () => {
    expect(validURL("192.168.1.1")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(validURL("")).toBe(false);
  });

  it("rejects a random string", () => {
    expect(validURL("not a url")).toBe(false);
  });

  it("rejects a string with spaces", () => {
    expect(validURL("https://exam ple.com")).toBe(false);
  });
});
