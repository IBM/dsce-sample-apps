import {
  createPresentationBlob,
  createExecutiveBriefDocxBlob,
  createDemoScriptDocxBlob,
  createValidationMatrixDocxBlob
} from './boxOfficeGenerators';

export interface ExportableAsset {
  filename: string;
  title: string;
  category: string;
  format: 'pptx' | 'docx';
  getBlob: () => Promise<Blob>;
}

export const GENERATED_DELIVERABLES: ExportableAsset[] = [
  {
    filename: 'Acme_Corp_Presentation_Slide_Deck.pptx',
    title: 'Presentation Slide Deck (6 Slides)',
    category: 'Architectural Presentation',
    format: 'pptx',
    getBlob: createPresentationBlob
  },
  {
    filename: 'Acme_Corp_Executive_Meeting_Brief.docx',
    title: 'Executive Meeting Brief',
    category: 'Executive Summary',
    format: 'docx',
    getBlob: createExecutiveBriefDocxBlob
  },
  {
    filename: 'Acme_Corp_Customer_Demo_Script.docx',
    title: 'Customer Demo Script (5-7 Min)',
    category: 'Presentation Script',
    format: 'docx',
    getBlob: createDemoScriptDocxBlob
  },
  {
    filename: 'Acme_Corp_Technical_Validation_Matrix.docx',
    title: 'Technical Validation Checklist',
    category: 'Security & Compliance Matrix',
    format: 'docx',
    getBlob: createValidationMatrixDocxBlob
  }
];

export async function downloadAssetLocally(asset: ExportableAsset) {
  const blob = await asset.getBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = asset.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadAllAssetsLocally() {
  for (const asset of GENERATED_DELIVERABLES) {
    await downloadAssetLocally(asset);
    await new Promise(r => setTimeout(r, 250));
  }
}
