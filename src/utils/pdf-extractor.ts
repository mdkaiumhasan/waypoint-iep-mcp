/**
 * pdf-extractor.ts
 *
 * Thin wrapper around pdf-parse to extract raw text from PDF files.
 * Handles the case where a PDF is image-only (scanned) by returning
 * an empty string with a clear error message rather than crashing.
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";

export async function extractTextFromPDF(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = await readFile(filePath);

  // Dynamically import pdf-parse to avoid ESM/CJS issues
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);

  const text = result.text?.trim() ?? "";

  if (text.length < 100) {
    throw new Error(
      `PDF appears to be image-only or contains very little text (${text.length} chars). ` +
      `Please provide a text-based PDF or pre-extracted text.`
    );
  }

  return text;
}

export async function extractTextFromString(text: string): Promise<string> {
  // Passthrough for when text is already extracted
  return text.trim();
}
