import {
  createPresentationBlob,
  createExecutiveBriefDocxBlob,
  createDemoScriptDocxBlob,
  createValidationMatrixDocxBlob,
  type ExportContent
} from './boxOfficeGenerators';
import { buildSlides, buildSlideContext } from '../components/slideDeckData';
import type { BoxDocument, Finding } from '../types';

/** Everything the export needs to build files for the current customer. */
export interface ExportInput extends ExportContent {
  documents: BoxDocument[];
  findings: Finding[];
}

export interface ExportableAsset {
  filename: string;
  title: string;
  category: string;
  format: 'pptx' | 'docx';
  getBlob: () => Promise<Blob>;
}

const fileSafe = (name: string) => name.trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Customer';

export function buildDeliverables(input: ExportInput): ExportableAsset[] {
  const customer = input.brief.customerName;
  const prefix = fileSafe(customer);
  return [
    {
      filename: `${prefix}_Presentation_Slide_Deck.pptx`,
      title: 'Presentation Slide Deck (6 Slides)',
      category: 'Architectural Presentation',
      format: 'pptx',
      getBlob: () => createPresentationBlob(
        buildSlides(buildSlideContext(input.documents, input.findings)),
        `${customer} Tailored Demo`
      )
    },
    {
      filename: `${prefix}_Executive_Meeting_Brief.docx`,
      title: 'Executive Meeting Brief',
      category: 'Executive Summary',
      format: 'docx',
      getBlob: () => createExecutiveBriefDocxBlob(input)
    },
    {
      filename: `${prefix}_Customer_Demo_Script.docx`,
      title: 'Customer Demo Script',
      category: 'Presentation Script',
      format: 'docx',
      getBlob: () => createDemoScriptDocxBlob(input)
    },
    {
      filename: `${prefix}_Technical_Validation_Matrix.docx`,
      title: 'Technical Validation Checklist',
      category: 'Security & Compliance Matrix',
      format: 'docx',
      getBlob: () => createValidationMatrixDocxBlob(input)
    }
  ];
}

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

export async function downloadAllAssetsLocally(assets: ExportableAsset[]) {
  for (const asset of assets) {
    await downloadAssetLocally(asset);
    await new Promise(r => setTimeout(r, 250));
  }
}
