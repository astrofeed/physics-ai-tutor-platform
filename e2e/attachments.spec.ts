import { test, expect } from "@playwright/test";
import { isPdfUrl } from "../src/lib/upload-constraints";

test.describe("telling a PDF attachment from a photo", () => {
  test("a blob or static URL is read from its extension", () => {
    expect(isPdfUrl("https://x.public.blob.vercel-storage.com/1-abc-work.pdf")).toBe(true);
    expect(isPdfUrl("https://x.public.blob.vercel-storage.com/1-abc-photo.JPG")).toBe(false);
    expect(isPdfUrl("/uploads/legacy-scan.PDF")).toBe(true);
  });

  test("an /api/files URL is read from the filename it carries", () => {
    expect(isPdfUrl("/api/files/abc123?name=midterm%20scan.pdf")).toBe(true);
    expect(isPdfUrl("/api/files/def456?name=answer.png")).toBe(false);
  });

  test("a URL stored before filenames were carried is not mistaken for a PDF", () => {
    expect(isPdfUrl("/api/files/abc123")).toBe(false);
  });
});
