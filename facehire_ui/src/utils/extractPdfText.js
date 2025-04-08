// src/utils/extractPdfText.js

// Import the legacy build of pdf.js
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// Set the worker source using a CDN that matches your installed version.
// You might want to confirm the version from your package.json or use the version string directly.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js`;

/**
 * Extracts text from a PDF file given its URL.
 * Returns a Promise that resolves with the extracted text.
 */
export async function extractPdfText(url) {
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      // Join all text items on this page.
      const pageText = content.items.map(item => item.str).join(' ');
      extractedText += pageText + '\n';
    }
    return extractedText;
  } catch (error) {
    throw error;
  }
}
