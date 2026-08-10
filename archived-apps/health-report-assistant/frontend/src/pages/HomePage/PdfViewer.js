import React, { useState, useEffect } from 'react';
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

function PdfViewer({ pdfFile, onPdfContentReady }) {
  const [pdfContent, setPdfContent] = useState(null);

  useEffect(() => {
    if (pdfFile) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target.result;
        const pdfData = new Uint8Array(arrayBuffer);
        const pdf = await pdfjs.getDocument({ data: pdfData }).promise;

        const contentString = await extractPdfContent(pdf);
        setPdfContent(contentString);

        // Pass the PDF content back to the parent component
        onPdfContentReady(contentString);
      };
      reader.readAsArrayBuffer(pdfFile);
    }
  }, [pdfFile]);

  const extractPdfContent = async (pdfDocument) => {
    let contentString = '';

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      contentString += pageText + ' ';
    }

    console.log("CONTENTSTRING ----> ", contentString)

    return contentString;
  };

  return null;
}

export default PdfViewer;