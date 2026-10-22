# Partner Solution Hub — Implementation Notes

## What was added

This implementation adds a **Partner Solutions** discovery experience to the existing Partner Solution Hub (Hugo static site). The existing demos catalog, Building Block filters and demo detail pages are unchanged.

### New files

| File | Purpose |
|---|---|
| `docs-src/data/partners.json` | Public partner + solution data (all 23 partners from Sancia's spreadsheet) |
| `docs-src/data/featured.json` | TechXchange featured-content slot configuration |
| `docs-src/content/partners/_index.md` | Hugo section index for partner catalog |
| `docs-src/content/partners/*.md` | One stub per partner slug (23 files) |
| `docs-src/layouts/partners/list.html` | Partner catalog template |
| `docs-src/layouts/partners/single.html` | Partner solution detail template |
| `docs-src/assets/js/partners.js` | Search, filters and URL state logic |

### Modified files

| File | Change |
|---|---|
| `docs-src/layouts/_default/index.html` | Dual CTAs (Explore partner solutions / Browse demos), hidden TechXchange feature slot |
| `docs-src/layouts/partials/global-header.html` | "Partner solutions" and "Demos" nav links with active-page indicator |
| `docs-src/assets/css/styles.css` | Partner catalog and detail page styles appended |

---

## Routes

| URL | Content |
|---|---|
| `/` | Homepage (updated) |
| `/partners/` | Partner solution catalog |
| `/partners/{partner-slug}/` | Partner solution detail |
| `/demos/` | Existing demo catalog (unchanged) |
| `/demos/{demo-slug}/` | Existing demo detail (unchanged) |

All routes are static Hugo pages — they support direct links, refresh and browser back navigation without a server.

---

## Local development

```bash
cd docs-src
hugo server
```

Visit `http://localhost:1313/`.

To run with the production base path:
```bash
hugo server --baseURL http://localhost:1313/dsce-sample-apps/
```

---

## Adding or updating partners

Edit `docs-src/data/partners.json`. The schema is:

```json
{
  "id": "unique-id",
  "slug": "url-slug",
  "name": "Display Name",
  "website": "https://...",
  "geo": "Americas | EMEA | APAC",
  "industries": ["Finance", "Government"],
  "ibmProducts": ["watsonx.ai", "IBM Maximo"],
  "solutions": [
    {
      "id": "unique-solution-id",
      "slug": "url-slug",
      "title": "Solution Name",
      "shortDescription": "One sentence for the card.",
      "businessProblem": "Paragraph for detail page.",
      "valueProp": "Paragraph for detail page.",
      "audience": "Who this is for.",
      "ibmProducts": ["watsonx.ai"],
      "demoSlugs": ["existing-demo-slug"],
      "evidence": [
        {
          "id": "unique-evidence-id",
          "type": "Customer story | Partner case study",
          "title": "Approved public title",
          "summary": "Approved public summary.",
          "sourceURL": "https://www.ibm.com/case-studies/...",
          "customerNameApproved": true,
          "published": true
        }
      ],
      "partnerProductURL": "https://partner-website.com/product",
      "published": true
    }
  ],
  "published": true
}
```

Set `"published": false` on a partner or solution to hide it from the public catalog without deleting the record.

Each partner also needs a content stub at `docs-src/content/partners/{slug}.md`:

```markdown
---
title: "Partner: {slug}"
slug: "{slug}"
showBack: true
---
```

---

## Enabling the TechXchange featured section

Edit `docs-src/data/featured.json`:

```json
{
  "published": true,
  "title": "Your approved title",
  "description": "Approved description.",
  "partnerNames": ["Partner A", "Partner B"],
  "solutionSlug": "partner-solution-slug",
  "linkLabel": "View the showcase",
  "linkURL": "/partners/partner-slug/"
}
```

Set `"published": false` to hide the section. The homepage will not render the feature block at all when `published` is false.

---

## Demo relationships

To link an existing demo to a partner solution, add its slug (from `demos.json`) to `demoSlugs` in `partners.json`:

```json
"demoSlugs": ["agentic-security-operations-center"]
```

The demo slug must match exactly. The detail page will display the demo title and short description from `demos.json` and link to the existing demo detail page.

---

## Public content rules

**Do not commit** `Build partner collateral for Monika.xlsx` or any internal export to this repository. That file contains Seismic win-wire links, Box folder URLs and unconfirmed customer data that must not appear in the public build.

Before publishing a partner record:
- Confirm the partner and solution details are approved for public disclosure.
- Use only publicly available IBM case study URLs in `evidence[].sourceURL`.
- Remove or leave empty any evidence entry that is not yet approved for public use.
- The `featured.json` slot must reference only confirmed, approved content.

---

## Deployment

The existing GitHub Actions workflow (`deploy.yml`) builds and deploys automatically on push to `main`. No changes to the workflow are needed.

**Do not push to `main` until the partner records have been reviewed for public content.**

---

## Checks completed

| Check | Result |
|---|---|
| `hugo --gc --minify` clean build | ✅ 53 pages, 0 errors |
| Homepage has dual CTAs | ✅ |
| Partner catalog renders all 23 partners | ✅ |
| Search input present | ✅ |
| Filters (industry, product, geo, evidence, demo) rendered from data | ✅ |
| Partner detail pages routable by slug | ✅ |
| Evidence cards display with source links | ✅ |
| Demo relationship cards link to existing demo pages | ✅ |
| Existing demo routes preserved unchanged | ✅ |
| TechXchange feature hidden when `published: false` | ✅ |
| No Seismic / Box internal links in partner pages | ✅ |
| Responsive layout (sidebar collapses on mobile) | ✅ |
| URL state for search and filters (replaceState) | ✅ |
| Browser back restores filter state (popstate) | ✅ |

### Checks not yet completed (require deployment or human review)

| Check | Reason |
|---|---|
| GitHub Pages base-path navigation (`/dsce-sample-apps/`) | Requires push to repository; baseURL is injected by CI |
| QR code / stable keynote link for TechXchange feature | Requires approved feature content to be configured |
| Partner records reviewed for public disclosure | Requires content owner sign-off before push to main |

---

## Content gaps

The following fields are present in the data schema but not yet populated for all partners:

- `partnerProductURL` — verified partner product page (populated to partner website for now)
- `demoSlugs` — explicit demo-to-solution mappings (only Addai, Happiest Minds mapped to security demo as a related example; all others pending explicit confirmation)
- `featured.json` — TechXchange feature title, description, link URL and approved partner names (pending confirmation)
- Partner logos — no logo assets are included; the catalog displays partner name text in lieu of logos

---

## Screenshots

Captured screenshots are in `screenshots/`:

- `01-homepage.png` — Updated homepage with dual CTAs
- `02-partner-catalog.png` — Partner solutions catalog (all 23 partners)
- `03-partner-detail.png` — Partner solution detail (Avid Solutions example)
- `04-existing-demo-preserved.png` — Existing demo page unchanged
