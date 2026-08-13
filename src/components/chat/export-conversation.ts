import type { Message } from "./types";

function buildMarkdown(title: string, messages: Message[]): string {
  const lines: string[] = [`# ${title}`, ""];
  for (const msg of messages) {
    lines.push(msg.role === "user" ? "## You" : "## AI Tutor");
    lines.push("");
    if (msg.imageUrls?.length) {
      for (const url of msg.imageUrls) {
        lines.push(`![attached image](${url})`);
      }
      lines.push("");
    }
    lines.push(msg.content);
    lines.push("");
  }
  return lines.join("\n");
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9\u4e00-\u9fff _-]/g, "").trim().slice(0, 60) || "conversation";
}

export function exportAsMarkdown(title: string, messages: Message[]): void {
  const markdown = buildMarkdown(title, messages);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(title)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Print only the chat transcript (see @media print rules in globals.css) via the browser's Save as PDF */
export function exportAsPdf(): void {
  window.print();
}
