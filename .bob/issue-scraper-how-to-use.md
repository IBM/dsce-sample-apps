# 📋 Issue Scraper Mode — How to Use

This mode reads a GitHub issue submitted via the `demo-submission.yml` template
and automatically wires it into the `dsce-sample-apps` Hugo catalog site. It
handles everything: data files, asset downloads, video upload to IBM COS, and
the demo script — leaving only one manual step at the end.

---

## Prerequisites

### Always required
- You must be working inside the `dsce-sample-apps` workspace.
- The GitHub repo (`IBM/dsce-sample-apps`) must be public — no token needed.

### Required only when the demo video is on Box / OneDrive / SharePoint
If the video URL in the issue points to YouTube, skip this section entirely.

Export these two env vars in your terminal **before** switching to the mode:

```bash
export COS_ACCESS_KEY_ID=your-hmac-access-key
export COS_SECRET_ACCESS_KEY=your-hmac-secret-key
```

**Where to get them:**
1. IBM Cloud → Resource list → your COS instance
2. Service credentials → expand any credential
3. Copy `cos_hmac_keys.access_key_id` and `cos_hmac_keys.secret_access_key`

> The COS bucket (`dsce2-demo-videos`) and endpoint
> (`s3.us-south.cloud-object-storage.appdomain.cloud`) are hardcoded in the
> mode — you do not need to provide them.

---

## Step-by-Step Usage

### Step 1 — Switch to Issue Scraper mode

Open the Bob mode picker and select **📋 Issue Scraper**.

---

### Step 2 — Give the mode the GitHub issue

Paste the issue URL or describe it by number. Either format works:

```
Process this demo submission:
https://github.com/IBM/dsce-sample-apps/issues/173
```

```
IBM/dsce-sample-apps issue 173
```

The mode fetches the issue from the GitHub API automatically.

---

### Step 3 — Review and confirm the plan

The mode will validate the issue against the `demo-submission.yml` template,
then show you a full plan **before writing anything**:

```
Slug:     ai-secret-management-and-modernization
Video:    YouTube → iframe embed (no COS upload needed)

Images to download:
  assets/demos/ai-secret-management-and-modernization/architecture.png
  assets/demos/ai-secret-management-and-modernization/home_page.png
  assets/demos/ai-secret-management-and-modernization/screenshot-01.png
  assets/demos/ai-secret-management-and-modernization/screenshot-02.png

New products to add to products.json:
  "HashiCorp Vault Radar"
  "HashiCorp Vault"

Files to write:
  docs-src/data/demos.json                                      (append)
  docs-src/data/products.json                                   (add 2 products)
  docs-src/content/demos/ai-secret-management-and-modernization.md
  docs-src/assets/demos/ai-secret-management-and-modernization/demo_script.md

Confirm? (yes / no)
```

Type **yes** to proceed. You can also ask the mode to change anything before
confirming — e.g. adjust the short description word count or override a
building block mapping.

---

### Step 4 — Mode executes automatically

After you confirm, the mode runs in this order:

| # | Action | Automated? |
|---|---|---|
| 1 | Create `assets/demos/<slug>/` folder | ✅ |
| 2 | Download architecture diagram from GitHub CDN | ✅ |
| 3 | Download screenshots from GitHub CDN | ✅ |
| 4 | For YouTube video: set `youTubeURL` (no upload) | ✅ |
| 5 | For Box/OneDrive video: download + upload to COS | ✅ |
| 6 | Write `demo_script.md` from the demo script field | ✅ |
| 7 | Append new entry to `demos.json` | ✅ |
| 8 | Add missing products to `products.json` | ✅ |
| 9 | Write `content/demos/<slug>.md` front-matter stub | ✅ |

---

### Step 5 — The only remaining manual action

Once the mode finishes, review the new entry in `demos.json` and flip
`isLive` from `false` to `true` when you are satisfied:

```json
"isLive": true
```

Then commit and push to `main`. The GitHub Actions workflow in
`.github/workflows/deploy.yml` deploys to GitHub Pages automatically on
every push to `main`.

---

## Video Handling Reference

| Video source in issue | How it renders on site | What mode does |
|---|---|---|
| `youtube.com` / `youtu.be` | Embedded `<iframe>` player | Sets `youTubeURL`, no upload |
| Box / OneDrive / SharePoint | Native `<video>` streamed from COS | Downloads file → uploads to `dsce2-demo-videos` COS bucket |
| Local file path (you provide) | Native `<video>` streamed from COS | Uploads directly from local path to COS |

---

## Template Validation

The mode checks that all required fields from `demo-submission.yml` are
present before proceeding:

| Field | Required |
|---|---|
| Demo name | ✅ |
| Short description (≤ 30 words) | ✅ |
| Industry / Use Case | ✅ |
| Long description | ✅ |
| IBM products used | ✅ |
| Link to functional demo | ✅ |
| Link to source code repository | ✅ |
| Demo overview video | ✅ |
| Screenshots (2–5 images) | ✅ |
| How to use the demo (demo script) | ✅ |
| Architecture diagram | ✅ |
| Architecture description | ✅ |
| IBM Bob Building Block skills used | optional |
| Link to specifications repository | optional |

If required fields are missing the mode reports them and stops — it will not
write partial data.

---

## What Gets Written

| File | Change |
|---|---|
| `docs-src/data/demos.json` | New demo object appended to the `demos` array |
| `docs-src/data/products.json` | Any products from the issue not already present are added |
| `docs-src/content/demos/<slug>.md` | Minimal Hugo front-matter stub created |
| `docs-src/assets/demos/<slug>/demo_script.md` | Demo script formatted as Markdown |
| `docs-src/assets/demos/<slug>/architecture.png` | Downloaded from issue |
| `docs-src/assets/demos/<slug>/home_page.png` | First screenshot downloaded from issue |
| `docs-src/assets/demos/<slug>/screenshot-0N.png` | Additional screenshots downloaded |

The mode **never modifies** existing entries in `demos.json` or `products.json`.

---

## Project Files Reference

```
dsce-sample-apps/
  docs-src/
    data/
      demos.json            ← demo metadata (mode appends here)
      products.json         ← product icon + URL registry (mode adds missing)
      skills.json           ← building block → skill mapping (mode reads)
      building_blocks.json  ← valid building block taxonomy (mode reads)
    content/demos/
      <slug>.md             ← Hugo page stub (mode creates)
    assets/demos/
      <slug>/               ← per-demo assets (mode creates folder + files)
        demo_script.md
        architecture.png
        home_page.png
        screenshot-01.png
    layouts/demos/
      single.html           ← detail page template (reads demos.json + assets)
      list.html             ← catalog list template (reads demos.json + assets)
  .github/
    ISSUE_TEMPLATE/
      demo-submission.yml   ← the form this mode is built to process
    workflows/
      deploy.yml            ← deploys to GitHub Pages on push to main
```
