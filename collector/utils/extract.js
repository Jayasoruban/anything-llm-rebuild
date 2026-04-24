const fs = require("fs/promises");
const path = require("path");

// Extracts plain text from a file on disk.
// Dispatches by file extension. New formats = add a case here.
//
// Returns: { text, mimeType }
//   - text     : full document text as a single string
//   - mimeType : best-guess MIME for the original file
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".txt":
    case ".md": {
      const text = await fs.readFile(filePath, "utf-8");
      return { text, mimeType: ext === ".md" ? "text/markdown" : "text/plain" };
    }

    case ".pdf": {
      // pdf-parse@2.x exports a PDFParse class.
      const { PDFParse } = require("pdf-parse");
      const buf = await fs.readFile(filePath);
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      // result shape: { text: "...", pages: [...], ... }
      return { text: result.text ?? "", mimeType: "application/pdf" };
    }

    default:
      throw new Error(`unsupported file type: ${ext}`);
  }
}

module.exports = { extractText };
