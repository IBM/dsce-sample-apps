import { z } from 'zod'

export const rfpInputSchema = z.object({
  rfpText: z.string().trim().min(50, 'Paste at least a few sentences of the RFP.').max(40000),
  companyName: z.string().trim().min(1, 'Company name is required.').max(200),
  companyProfile: z.string().trim().max(8000).default(''),
  tone: z.enum(['formal', 'confident', 'friendly']).default('confident'),
})

export type RfpInput = z.infer<typeof rfpInputSchema>

const rfpTableSchema = z.object({
  caption: z.string().optional().describe('Short label shown above the table, e.g. "Pricing"'),
  columns: z.array(z.string()).describe('Column headers'),
  rows: z.array(z.array(z.string())).describe('Table rows; each row has one string per column'),
})

export type RfpTable = z.infer<typeof rfpTableSchema>

export const rfpOutputSchema = z.object({
  title: z.string().describe('Title of the proposal response'),
  rfpReference: z.string().optional().describe('RFP solicitation reference number, e.g. RFP-2025-DOCAI-04'),
  clientName: z.string().describe('Name of the issuing organization, or "the client" if unknown'),
  submittedBy: z.string().optional().describe('Vendor name submitting the response'),
  submittedTo: z.string().optional().describe('Contact name and title at the client organization'),
  proposalNumber: z.string().optional().describe('Vendor proposal number shown on the cover page'),
  date: z.string().optional().describe('Proposal date shown on the cover page and in every page header'),
  contact: z
    .object({
      name: z.string(),
      title: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional()
    .describe('Vendor contact shown on the cover page and as the cover letter signatory'),
  confidentialityNotice: z.string().optional().describe('Confidentiality paragraph at the bottom of the cover page'),
  coverLetter: z
    .object({
      addressee: z.array(z.string()).describe('Address block lines, one per line'),
      subject: z.string().describe('Text after "Re:"'),
      salutation: z.string().describe('e.g. "Dear Ms. Vance,"'),
      paragraphs: z.array(z.string()).describe('Letter body paragraphs'),
    })
    .optional()
    .describe('One-page cover letter that precedes the numbered sections'),
  executiveSummary: z.string().describe('2-3 paragraph executive summary, paragraphs separated by blank lines'),
  exhibits: z.array(z.string()).optional().describe('Exhibit list, e.g. "A. Architecture and authentication sequence"'),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        body: z.string().describe('Section prose, paragraphs separated by blank lines'),
        subsections: z
          .array(
            z.object({
              number: z.string().optional().describe('RFP section number, e.g. "3.1"'),
              title: z.string(),
              requirement: z.string().optional().describe('The RFP requirement being answered, one line'),
              body: z.string(),
            }),
          )
          .optional()
          .describe('Numbered sub-answers shown after the section prose'),
        tables: z.array(rfpTableSchema).optional().describe('Tables shown after the subsections'),
        notes: z.array(z.string()).optional().describe('Short assumption lines shown after the tables'),
        bullets: z
          .array(z.string())
          .optional()
          .describe('Optional 3-6 supporting bullet points shown beneath the prose'),
        keyMetric: z
          .object({
            value: z.string().describe('The headline number or stat, e.g. "85%"'),
            label: z.string().describe('What it measures, e.g. "Faster commercial onboarding"'),
            source: z.string().optional().describe('Source document name'),
          })
          .optional()
          .describe('Optional single standout metric callout for this section'),
      }),
    )
    .describe(
      'Response sections mapping to RFP requirements: Understanding of Need, Technical Architecture, Security & Compliance, Case Study & Evidence, Implementation Plan, Pricing',
    ),
  complianceMatrix: z
    .array(
      z.object({
        requirement: z.string().describe('A requirement stated in the RFP'),
        rfpRef: z.string().optional().describe('RFP section reference, e.g. "Section 3.2"'),
        response: z.string().describe('One to two sentences on how the vendor meets it'),
        status: z.enum(['meets', 'partial', 'clarify']),
        sourceRef: z.string().optional().describe('Source document name that evidences this claim'),
      }),
    )
    .describe('Key RFP requirements and compliance status'),
  slides: z
    .array(
      z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        bullets: z.array(z.string()).describe('3-4 short bullets, under 12 words each'),
        speakerNotes: z.string(),
      }),
    )
    .describe('7-slide finalist presentation deck'),
})

export type RfpOutput = z.infer<typeof rfpOutputSchema>
