import pptxgen from 'pptxgenjs'

export type DeckSlideInput = {
  title: string
  subtitle?: string
  bullets?: string[]
  speakerNotes?: string
  notes?: string
}

// LAYOUT_WIDE is 13.33" x 7.5" (16:9)
const W = 13.33
const H = 7.5
const MARGIN = 0.7
const CONTENT_W = W - MARGIN * 2
const FONT = 'Arial'
const BLUE = '0F62FE'
const INK = '161616'
const MUTED = '525252'

/**
 * Picks a font size from how much text there is. Box's previewer ignores PowerPoint's
 * shrink-to-fit, so sizes are chosen up front instead of relying on autofit.
 */
function bulletFontSize(bullets: string[]): number {
  const chars = bullets.reduce((n, b) => n + b.length, 0)
  let size = chars > 700 ? 14 : chars > 520 ? 16 : chars > 340 ? 18 : 20
  if (bullets.length > 6) size = Math.min(size, 16)
  return size
}

const titleFontSize = (title: string, base: number) => (title.length > 70 ? base - 6 : title.length > 48 ? base - 3 : base)

/** Builds a clean, consistently laid-out PPTX from plain slide data. The first slide is the cover. */
export async function createDeckPptxBlob(slides: DeckSlideInput[], deckTitle: string): Promise<Blob> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'IBM Bob'
  pptx.company = 'IBM / Box'
  pptx.title = deckTitle

  const total = slides.length

  slides.forEach((s, i) => {
    const slide = pptx.addSlide()
    const bullets = (s.bullets ?? []).filter(Boolean)
    const notes = s.speakerNotes || s.notes

    if (i === 0) {
      slide.background = { color: INK }
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: H, fill: { color: BLUE }, line: { color: BLUE } })
      slide.addText('RFP RESPONSE', {
        x: 1.0, y: 0.7, w: CONTENT_W, h: 0.4,
        fontFace: FONT, fontSize: 12, bold: true, color: BLUE, charSpacing: 3, margin: 0,
      })
      slide.addText(s.title || deckTitle, {
        x: 1.0, y: 1.9, w: 11.2, h: 1.9,
        fontFace: FONT, fontSize: titleFontSize(s.title || deckTitle, 40), bold: true, color: 'FFFFFF',
        valign: 'middle', margin: 0,
      })
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 1.0, y: 3.9, w: 11.2, h: 0.6,
          fontFace: FONT, fontSize: 18, color: 'C6C6C6', valign: 'top', margin: 0,
        })
      }
      if (bullets.length > 0) {
        slide.addText(
          bullets.map((b) => ({ text: b, options: { breakLine: true } })),
          {
            x: 1.0, y: s.subtitle ? 4.7 : 4.0, w: 11.2, h: 1.6,
            fontFace: FONT, fontSize: 14, color: 'A8A8A8', valign: 'top', paraSpaceAfter: 6, margin: 0,
          },
        )
      }
      slide.addText('Grounded by Box MCP', {
        x: 1.0, y: H - 0.7, w: 6, h: 0.3, fontFace: FONT, fontSize: 10, color: '8D8D8D', margin: 0,
      })
    } else {
      slide.background = { color: 'FFFFFF' }
      slide.addText(s.title || `Slide ${i + 1}`, {
        x: MARGIN, y: 0.45, w: CONTENT_W, h: 1.0,
        fontFace: FONT, fontSize: titleFontSize(s.title || '', 28), bold: true, color: INK,
        valign: 'middle', margin: 0,
      })
      const headerBottom = s.subtitle ? 1.95 : 1.6
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: MARGIN, y: 1.45, w: CONTENT_W, h: 0.4,
          fontFace: FONT, fontSize: 14, color: MUTED, valign: 'top', margin: 0,
        })
      }
      slide.addShape(pptx.ShapeType.line, {
        x: MARGIN, y: headerBottom, w: CONTENT_W, h: 0, line: { color: BLUE, width: 2 },
      })

      if (bullets.length > 0) {
        const size = bulletFontSize(bullets)
        slide.addText(
          bullets.map((b) => ({
            text: b,
            options: { bullet: { indent: 22 }, breakLine: true },
          })),
          {
            x: MARGIN, y: headerBottom + 0.3, w: CONTENT_W, h: H - headerBottom - 1.3,
            fontFace: FONT, fontSize: size, color: INK, valign: 'top',
            paraSpaceAfter: size >= 18 ? 12 : 8, margin: 0,
          },
        )
      }

      slide.addShape(pptx.ShapeType.line, {
        x: MARGIN, y: H - 0.65, w: CONTENT_W, h: 0, line: { color: 'E0E0E0', width: 0.75 },
      })
      slide.addText('IBM Bob · Grounded in Box Content Cloud', {
        x: MARGIN, y: H - 0.55, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: '8D8D8D', margin: 0,
      })
      slide.addText(`${i + 1} / ${total}`, {
        x: W - MARGIN - 2, y: H - 0.55, w: 2, h: 0.3,
        fontFace: FONT, fontSize: 10, color: '8D8D8D', align: 'right', margin: 0,
      })
    }

    if (notes) slide.addNotes(notes)
  })

  const buffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
}
