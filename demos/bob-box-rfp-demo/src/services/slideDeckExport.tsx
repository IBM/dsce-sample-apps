import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import domtoimage from 'dom-to-image-more';
import pptxgen from 'pptxgenjs';
import type { Slide } from '../components/slideDeckData';

// Render size gives the slide the same wide-viewport layout seen on the website.
const RENDER_WIDTH = 1280;
const RENDER_HEIGHT = 720;
const PIXEL_RATIO = 2;

function buildNotes(slide: Slide): string {
  const n = slide.notes;
  return [
    `OBJECTIVE:\n${n.objective}`,
    `TARGET AUDIENCE:\n${n.targetAudience}`,
    `TALKING POINTS:\n${n.talkingPoints.map(p => `• ${p}`).join('\n')}`,
    `DEMO CUE:\n${n.demoCue}`,
    `OBJECTION HANDLING:\n${n.objectionHandling}`,
    `SOURCE CITATION:\n${n.sourceCitation}`
  ].join('\n\n');
}

async function renderSlideToPng(slide: Slide, host: HTMLElement): Promise<string> {
  const container = document.createElement('div');
  container.style.width = `${RENDER_WIDTH}px`;
  container.style.height = `${RENDER_HEIGHT}px`;
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.style.background = '#ffffff';
  host.appendChild(container);

  const root = createRoot(container);
  try {
    flushSync(() => {
      root.render(<div className="w-full h-full">{slide.visual}</div>);
    });
    await document.fonts.ready;
    return await domtoimage.toPng(container, {
      width: RENDER_WIDTH,
      height: RENDER_HEIGHT,
      scale: PIXEL_RATIO,
      bgcolor: '#ffffff'
    });
  } finally {
    root.unmount();
    host.removeChild(container);
  }
}

/**
 * Builds a PPTX whose slides are pixel-faithful renders of the given slides
 * (the same React visuals shown in SlideDeckViewer), with speaker notes attached.
 */
export async function createDeckPptxBlob(slides: Slide[], title: string): Promise<Blob> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.pointerEvents = 'none';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'IBM Bob';
  pptx.company = 'IBM / Box';
  pptx.title = title;

  try {
    for (const slide of slides) {
      const png = await renderSlideToPng(slide, host);
      const pptxSlide = pptx.addSlide();
      pptxSlide.addImage({ data: png, x: 0, y: 0, w: '100%', h: '100%' });
      pptxSlide.addNotes(buildNotes(slide));
    }
  } finally {
    document.body.removeChild(host);
  }

  const arrayBuffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });
}
