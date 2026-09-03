import pdfParse from "pdf-parse";

export async function extractTextFromUpload(buffer: Buffer, fileType: string) {
  if (fileType === "pdf") {
    const parsed = await pdfParse(buffer);
    return parsed.text.trim();
  }

  throw new Error("Image uploads are accepted for storage, but MVP extraction currently supports digital PDFs.");
}

export function detectFileType(buffer: Buffer) {
  if (buffer.subarray(0, 4).toString("hex") === "25504446") return "pdf";
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "png";
  if (buffer.subarray(0, 3).toString("hex") === "ffd8ff") return "jpg";
  return null;
}
