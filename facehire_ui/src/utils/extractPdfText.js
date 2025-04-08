// src/utils/extractPdfText.js

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// Use the worker file located in the public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

/**
 * Extracts text from a PDF given its URL.
 * Returns a Promise that resolves with the extracted text.
 */
export async function extractPdfText(url) {
  try {
    const pdf = await pdfjsLib.getDocument(url).promise;
    let extractedText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      extractedText += pageText + '\n';
    }
    return extractedText;
  } catch (error) {
    throw error;
  }
}
