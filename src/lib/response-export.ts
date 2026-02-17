/**
 * Response Export Service
 *
 * Converts generated HTML responses to PDF and DOCX formats.
 * Uses simple server-side generation without external dependencies.
 */

import { getStorage } from "./storage";

/**
 * Generate a simple PDF from HTML content.
 * This is a minimal implementation using a self-contained approach.
 * For production, consider using Puppeteer, wkhtmltopdf, or a similar tool.
 */
export async function exportToPdf(
  html: string,
  filename: string,
): Promise<{ storageKey: string; size: number }> {
  const storage = getStorage();

  // Minimal PDF generation: wrap HTML in a simple PDF structure
  // This produces a valid PDF that embeds the HTML as text content
  const cleanText = htmlToPlainText(html);
  const pdfBuffer = buildSimplePdf(cleanText, filename);

  const result = await storage.upload(
    pdfBuffer,
    filename.replace(/\.html$/, ".pdf"),
    "application/pdf",
  );

  return { storageKey: result.storageKey, size: result.size };
}

/**
 * Generate a simple DOCX from HTML content.
 * Produces a minimal OOXML document.
 */
export async function exportToDocx(
  html: string,
  filename: string,
): Promise<{ storageKey: string; size: number }> {
  const storage = getStorage();

  // Convert HTML to a simplified DOCX-compatible format
  const cleanText = htmlToPlainText(html);
  const docxBuffer = buildSimpleDocx(cleanText);

  const result = await storage.upload(
    docxBuffer,
    filename.replace(/\.html$/, ".docx"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );

  return { storageKey: result.storageKey, size: result.size };
}

/**
 * Store the HTML version for download.
 */
export async function exportToHtml(
  html: string,
  filename: string,
): Promise<{ storageKey: string; size: number }> {
  const storage = getStorage();
  const buffer = Buffer.from(html, "utf-8");

  const result = await storage.upload(buffer, filename, "text/html");

  return { storageKey: result.storageKey, size: result.size };
}

/**
 * Strip HTML tags and convert to plain text.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "\t")
    .replace(/<\/th>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Build a minimal valid PDF with text content.
 */
function buildSimplePdf(text: string, _title: string): Buffer {
  // Sanitize text for PDF stream (replace special chars)
  const sanitized = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  // Split text into lines that fit within page width
  const lines = sanitized.split("\n");
  const pageLines: string[] = [];
  const maxLineLength = 90;

  for (const line of lines) {
    if (line.length <= maxLineLength) {
      pageLines.push(line);
    } else {
      // Word wrap
      let remaining = line;
      while (remaining.length > maxLineLength) {
        let breakAt = remaining.lastIndexOf(" ", maxLineLength);
        if (breakAt === -1) breakAt = maxLineLength;
        pageLines.push(remaining.substring(0, breakAt));
        remaining = remaining.substring(breakAt).trimStart();
      }
      if (remaining) pageLines.push(remaining);
    }
  }

  // Build PDF text operators
  const lineHeight = 14;
  const fontSize = 10;
  const margin = 50;
  const pageHeight = 842; // A4
  const pageWidth = 595;
  const usableHeight = pageHeight - 2 * margin;
  const linesPerPage = Math.floor(usableHeight / lineHeight);

  const pages: string[][] = [];
  for (let i = 0; i < pageLines.length; i += linesPerPage) {
    pages.push(pageLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([""]);

  // Build PDF objects
  const objects: string[] = [];
  let objectCount = 0;

  function addObject(content: string): number {
    objectCount++;
    objects.push(`${objectCount} 0 obj\n${content}\nendobj\n`);
    return objectCount;
  }

  // Obj 1: Catalog
  addObject("<< /Type /Catalog /Pages 2 0 R >>");

  // Obj 2: Pages
  const pageRefs = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  addObject(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`);

  // Obj 3: Font
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  // Page objects
  for (const pageLinesChunk of pages) {
    // Content stream
    let textOps = `BT\n/F1 ${fontSize} Tf\n${margin} ${pageHeight - margin} Td\n`;
    for (const line of pageLinesChunk) {
      textOps += `(${line}) Tj\n0 -${lineHeight} Td\n`;
    }
    textOps += "ET";

    const streamObj = addObject(
      `<< /Length ${textOps.length} >>\nstream\n${textOps}\nendstream`,
    );

    // Page
    addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObj} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
  }

  // Build final PDF
  const header = "%PDF-1.4\n";
  let body = "";
  const xrefOffsets: number[] = [];

  for (const obj of objects) {
    xrefOffsets.push(header.length + body.length);
    body += obj;
  }

  const xrefOffset = header.length + body.length;
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (const offset of xrefOffsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, "binary");
}

/**
 * Build a minimal DOCX file (actually a flat OPC XML for simplicity).
 * For production, use a proper DOCX library.
 */
function buildSimpleDocx(text: string): Buffer {
  // Produce a minimal flat XML WordprocessingML document
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escapedText.split("\n\n").map((para) => {
    const lines = para.split("\n").map(
      (line) => `<w:r><w:t xml:space="preserve">${line}</w:t></w:r><w:r><w:br/></w:r>`,
    ).join("");
    return `<w:p>${lines}</w:p>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">
<w:body>
${paragraphs}
</w:body>
</w:wordDocument>`;

  return Buffer.from(xml, "utf-8");
}
