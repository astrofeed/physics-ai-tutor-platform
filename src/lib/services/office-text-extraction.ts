import JSZip from "jszip";

/**
 * Text extraction for Office Open XML files (PPTX, DOCX, XLSX). They are all
 * zips of XML, so the visible text can be pulled out without a native parser.
 */

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity] ?? entity);
}

function numberedPart(pattern: RegExp) {
  return (name: string) => parseInt(name.match(pattern)?.[1] ?? "0", 10);
}

function sortedParts(zip: JSZip, filter: RegExp, numberPattern: RegExp): string[] {
  const numberOf = numberedPart(numberPattern);
  return Object.keys(zip.files)
    .filter((name) => filter.test(name))
    .sort((a, b) => numberOf(a) - numberOf(b));
}

/** One line per slide paragraph; slides are numbered in deck order. */
export async function extractPptxText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = sortedParts(zip, /^ppt\/slides\/slide\d+\.xml$/, /slide(\d+)\.xml$/);
  const pages: string[] = [];
  for (let index = 0; index < slideNames.length; index++) {
    const xml = await zip.files[slideNames[index]].async("string");
    const paragraphs = Array.from(xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g), (m) =>
      Array.from(m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g), (t) => decodeXml(t[1])).join("")
    ).filter((line) => line.trim().length > 0);
    pages.push(`[slide ${index + 1}]\n${paragraphs.join("\n")}`);
  }
  return pages.join("\n\n");
}

/** Body paragraphs of a Word document, one per line. */
export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const document = zip.files["word/document.xml"];
  if (!document) throw new Error("DOCX has no word/document.xml");
  const xml = await document.async("string");
  return Array.from(xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g), (m) =>
    Array.from(m[1].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g), (t) =>
      t[0] === "<w:tab/>" ? "\t" : decodeXml(t[1])
    ).join("")
  ).join("\n");
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const part = zip.files["xl/sharedStrings.xml"];
  if (!part) return [];
  const xml = await part.async("string");
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g), (m) =>
    Array.from(m[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g), (t) => decodeXml(t[1])).join("")
  );
}

async function readSheetNames(zip: JSZip): Promise<string[]> {
  const workbook = zip.files["xl/workbook.xml"];
  if (!workbook) return [];
  const xml = await workbook.async("string");
  return Array.from(xml.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g), (m) => decodeXml(m[1]));
}

function cellValue(cell: string, sharedStrings: string[]): string {
  const type = cell.match(/\bt="([^"]*)"/)?.[1];
  if (type === "inlineStr") {
    return Array.from(cell.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g), (t) => decodeXml(t[1])).join("");
  }
  const value = cell.match(/<v>([^<]*)<\/v>/)?.[1];
  if (value === undefined) return "";
  if (type === "s") return sharedStrings[parseInt(value, 10)] ?? "";
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return decodeXml(value);
}

/** Each worksheet as tab-separated rows, prefixed by its sheet name. */
export async function extractXlsxText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const [sharedStrings, sheetNames] = await Promise.all([readSharedStrings(zip), readSheetNames(zip)]);
  const sheetParts = sortedParts(zip, /^xl\/worksheets\/sheet\d+\.xml$/, /sheet(\d+)\.xml$/);
  const sheets: string[] = [];
  for (let index = 0; index < sheetParts.length; index++) {
    const xml = await zip.files[sheetParts[index]].async("string");
    const rows = Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g), (row) =>
      Array.from(row[1].matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g), (c) => cellValue(c[0], sharedStrings)).join("\t")
    ).filter((line) => line.replace(/\t/g, "").length > 0);
    sheets.push(`[sheet ${index + 1}: ${sheetNames[index] ?? "Sheet"}]\n${rows.join("\n")}`);
  }
  return sheets.join("\n\n");
}
