# QSE Automation Workbench: Reverse-Engineered Specification

> **Document type:** as-built specification, reverse-engineered from the source tree at `qse-automation-workbench/`.
> **Scope rule:** this document describes what the code does today. Anything not in the code is labelled **Planned / Not implemented**. Behaviour that only exists under `STREAM_MODE=mock` is labelled **Mocked** and is never presented as a real integration.
> **Audience:** a developer or AI agent that must recreate the application functionally and visually, or extend it without breaking existing behaviour.

## Status legend (used in every table)

| Label | Meaning |
|---|---|
| **Implemented** | Present in code, exercised by at least one automated test or verified by the deploy `--check`. |
| **Partial** | Present, but with a documented limitation or a known inconsistency. |
| **Mocked** | Exists only when `STREAM_MODE=mock`. A recorded replay; no real GitHub, QSE CLI or Headless Bob call occurs. |
| **Planned** | Not in the code. Appears in docs or this spec only as a target. |

## Table of contents

1. [Business objectives, capabilities and requirements](#1-business-objectives-capabilities-and-requirements)
2. [Technology stack](#2-technology-stack)
3. [UI reverse-engineering](#3-ui-reverse-engineering)
   - [3.1 Visual foundation and design tokens](#31-visual-foundation-and-design-tokens)
   - [3.2 App shell](#32-app-shell)
   - [3.3 Pages](#33-pages)
   - [3.4 Pipeline digital twin](#34-pipeline-digital-twin)
   - [3.5 Component inventory](#35-component-inventory)
   - [3.6 UI assets](#36-ui-assets)
4. [Feature specifications](#4-feature-specifications)
5. [Architecture](#5-architecture)
6. [API specification](#6-api-specification)
7. [Data model and persistence](#7-data-model-and-persistence)
8. [Security](#8-security)
9. [Error-handling catalogue](#9-error-handling-catalogue)
10. [Deployment and infrastructure](#10-deployment-and-infrastructure)
11. [Testing specification](#11-testing-specification)
12. [Non-functional and production readiness](#12-non-functional-and-production-readiness)
13. [Traceability matrix](#13-traceability-matrix)
14. [Implementation gap analysis](#14-implementation-gap-analysis)
15. [Specification completeness checklist](#15-specification-completeness-checklist)

Paths in this document are relative to `qse-automation-workbench/` unless stated otherwise.

---

## 1. Business objectives, capabilities and requirements

### 1.1 Purpose

QSE Automation Workbench is a web application that lets an authenticated user orchestrate a **quantum-safe cryptography assessment** of a GitHub repository. The workbench does not perform the analysis itself. It prepares the inputs, hands a single prompt to an external agent (**Headless Bob**), which runs the **IBM Quantum Safe Explorer (QSE) CLI**, then retrieves and presents the resulting report.

### 1.2 Business objectives

| # | Objective | Realised by |
|---|---|---|
| O1 | Give a user one place to connect Headless Bob, clone a repository, validate the QSE CLI and start an assessment | Pages `/bob`, `/repository`, `/qse`, `/workspace` |
| O2 | Make the assessment observable in real time without inventing progress | SSE stream, step list, log viewer, Pipeline digital twin |
| O3 | Preserve results so they can be reviewed and exported later | SQLite persistence, `/history`, `/reports`, Markdown/PDF/JSON download |
| O4 | Keep credentials and untrusted repository content safe | AES-256-GCM secret box, SSRF guard, shell-free exec, redaction, CSRF |
| O5 | Allow a safe demonstration with no external dependencies | `STREAM_MODE=mock` replay of one recorded real run |

### 1.3 Capabilities

| Capability | Status |
|---|---|
| Local username/password sign-in with server-side sessions | Implemented |
| Configure and test a Headless Bob connection (`rest-threads` or `acp` adapter) | Implemented (realtime). Mocked (mock). |
| Validate and clone a GitHub repository (public, or private with a token) | Implemented (realtime). Mocked (mock). |
| Discover, configure and validate the QSE CLI | Implemented (realtime). Mocked (mock). |
| Submit one prompt, run the 9-step pipeline, stream events and logs | Implemented (realtime). Mocked (mock). |
| Cancel a running execution | Implemented |
| Persist execution history; search, filter, sort, paginate | Implemented |
| Build a Markdown report from Headless Bob's output; split it into sections | Implemented |
| Download report as Markdown, PDF or JSON; download retrieved artifacts | Implemented |
| Rotate the encryption key for stored secrets | Implemented (admin only) |
| Change own password | Implemented |
| Pipeline digital twin diagram | Implemented (added to the workspace page) |
| Multi-user management (create, delete, change role) | **Planned**: only the bootstrap admin exists; no API or UI |
| Structured crypto-risk scoring, CBOM rendering, risk categorisation | **Planned**: the backend never synthesises findings |
| Data retention / cleanup of old executions | **Planned** |
| Database other than SQLite | **Planned** (docs mention Postgres as a future adapter) |
| SSO / OIDC / MFA | **Planned** |

### 1.4 Functional requirements

| ID | Requirement | Status |
|---|---|---|
| FR-01 | The system shall require authentication for every `/api` route except `POST /api/auth/login`. | Implemented |
| FR-02 | The system shall store the Bob API key and repository tokens only in encrypted form and never return them. | Implemented |
| FR-03 | The system shall refuse to start an execution unless Bob is connected, the repository is cloned, the QSE CLI is validated and reachable from Bob, and a prompt is provided. | Implemented |
| FR-04 | The system shall run at most `MAX_CONCURRENT_EXECUTIONS` executions at once and queue the rest. | Implemented |
| FR-05 | The system shall stream execution state and logs over SSE and support resume via `Last-Event-ID` / `?after=`. | Implemented |
| FR-06 | The system shall persist every execution, its steps, logs, report and artifact metadata. | Implemented |
| FR-07 | The system shall present the report source honestly: `headless-bob-file`, `headless-bob-output` or `unavailable`. | Implemented |
| FR-08 | The system shall label all recorded-replay data as DEMO in the UI and in exports. | Implemented |
| FR-09 | The system shall allow the user to cancel an active execution. | Implemented |
| FR-10 | The system shall mark executions that were active at restart as failed. | Implemented |
| FR-11 | The system shall let an administrator re-encrypt stored secrets with the active key. | Implemented |
| FR-12 | The system shall show a live pipeline diagram derived only from real step events and connection status. | Implemented |

### 1.5 Non-functional requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-01 | Secrets never appear in logs, API responses, URLs or browser storage. | Implemented (redaction, secret box) |
| NFR-02 | All outbound HTTP to Bob is SSRF-guarded; redirects are not followed. | Implemented |
| NFR-03 | No child process is started through a shell; repository content is never executed. | Implemented |
| NFR-04 | The service shall shut down gracefully on SIGTERM/SIGINT (hard stop after 25 s). | Implemented |
| NFR-05 | The backend shall refuse to start on invalid configuration. | Implemented |
| NFR-06 | The UI shall use IBM Carbon (g100 dark) and IBM Plex typography. | Implemented, with the token caveat in [3.1.4](#314-known-token-caveat) |
| NFR-07 | The system shall be single-node. | By design (SQLite, in-memory SSE bus, in-process queue) |
| NFR-08 | Performance targets (latency, throughput) | **Not specified in code**; none are claimed here |

### 1.6 Out of scope (explicitly not built)

Multi-tenant isolation, per-user repositories (the repository list is global), horizontal scaling, queue persistence across restarts, QSE-phase-level progress (Headless Bob exposes none), and any analysis logic inside the workbench.

---

## 2. Technology stack

Versions are the **resolved** versions from `backend/package-lock.json` and `frontend/package-lock.json`; the `package.json` range is shown for reference.

### 2.1 Backend (`backend/`)

| Package | `package.json` | Resolved | Purpose |
|---|---|---|---|
| Node.js | `engines >=22.13` | (runtime: Node 24 in Docker, Node 26.4.0 on the dev host) | Runtime; provides built-in `node:sqlite` |
| express | ^5.3.0 | 5.3.0 | HTTP framework |
| zod | ^4.6.7 | 4.6.7 | Request and environment validation |
| pino | ^10.4.0 | 10.4.0 | Structured logging with redaction |
| helmet | ^8.3.0 | 8.3.0 | Security headers / CSP |
| express-rate-limit | ^8.7.3 | 8.7.3 | API, login and heavy-route throttling |
| cors | ^2.8.6 | 2.8.6 | Allow-listed CORS with credentials |
| cookie-parser | ^1.4.7 | 1.4.7 | Session cookie parsing |
| undici | ^8.12.4 | 8.12.4 | HTTP client for Bob, with a guarded DNS lookup |
| pdfkit | ^0.20.2 | 0.20.2 | PDF export |
| typescript (dev) | ^7.0.2 | 7.0.2 | Type checking and build (`tsc -p tsconfig.build.json`) |
| vitest (dev) | ^5.1.0 | 5.1.0 | Test runner |
| supertest (dev) | ^7.3.2 | 7.3.2 | HTTP integration tests |
| tsx (dev) | ^4.23.15 | 4.23.15 | `npm run dev` (watch) |

Database: built-in **`node:sqlite`** (`DatabaseSync`), WAL, `foreign_keys=ON`, `busy_timeout=5000`, `PRAGMA user_version` migrations (one migration).
Module format: ESM. TS config: target ES2023, `module: NodeNext`, `strict: true` (`backend/tsconfig.json`; the build config `backend/tsconfig.build.json` emits to `dist/` with source maps).

Backend scripts: `test`, `dev`, `build`, `start`, `typecheck`, `audit`.

### 2.2 Frontend (`frontend/`)

| Package | `package.json` | Resolved | Purpose |
|---|---|---|---|
| react / react-dom | ^18.3.1 | 18.3.1 | UI runtime |
| @carbon/react | ^1.120.0 | 1.120.0 | IBM Carbon components |
| @carbon/icons-react | ^11.92.0 | 11.92.0 | Icons |
| @ibm/plex-sans | ^1.1.0 | 1.1.0 | IBM Plex Sans web font (CSS import) |
| @tanstack/react-query | ^5.107.1 | 5.107.1 | Server-state cache |
| react-router-dom | ^7.18.5 | 7.18.5 | Routing |
| zustand | ^5.1.0 | 5.1.0 | Client state stores |
| react-markdown | ^10.1.0 | 10.1.0 | Safe Markdown rendering |
| remark-gfm | ^4.0.1 | 4.0.1 | GFM tables |
| vite (dev) | ^8.3.7 | 8.3.7 | Dev server and bundler |
| @vitejs/plugin-react (dev) | ^6.3.0 | 6.3.0 | React transform |
| typescript (dev) | ^7.0.2 | 7.0.2 | `tsc --noEmit` |
| sass (dev) | ^1.108.1 | 1.108.1 | SCSS (Carbon setup) |
| vitest (dev) | ^5.1.0 | 5.1.0 | Tests |
| jsdom (dev) | ^31.0.0 | 31.0.0 | Test DOM |
| @testing-library/react (dev) | ^16.3.3 | 16.3.3 | Component tests |

Also in devDependencies: `@testing-library/jest-dom ^7.0.1`, `@testing-library/user-event ^14.6.8`.
Frontend scripts: `test`, `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `typecheck`.
Build: target `es2022`, no source maps. Dev server port **5173**, proxying `/api` to `VITE_API_PROXY ?? http://127.0.0.1:8080` (`changeOrigin: false`).
TS config: `jsx: react-jsx`, `moduleResolution: Bundler`, `strict`, `isolatedModules` (`frontend/tsconfig.json`).

### 2.3 Infrastructure images

| Item | Value | Source |
|---|---|---|
| Backend base image | `node:24-bookworm-slim` (multi-stage), adds `git`, `ca-certificates`, `tini`, optional `${JAVA_PACKAGE}` | `backend/Dockerfile` |
| Frontend runtime image | `nginxinc/nginx-unprivileged:1.27-alpine` (uid 101) | `frontend/Dockerfile` |
| Frontend build image | `node:24-bookworm-slim` | `frontend/Dockerfile` |
| Optional Headless Bob image | `${HEADLESS_BOB_IMAGE:-headlessbob:latest}` (not built by this repo) | `deployment/docker-compose.yml` |
| Orchestration | Docker Compose or Podman Compose, project name `qse-workbench` | `deployment/docker-compose.yml` |

### 2.4 External systems

| System | Role | Version / contract |
|---|---|---|
| Headless Bob | Executes the prompt, runs QSE CLI | REST threads API under `/api/v1` or ACP 0.2.0 |
| IBM QSE CLI | Quantum-safe scanner, run by Bob | 2.3.1.0 observed (`App Version : 2.3.1.0 Build Version : 202605.00095`) |
| GitHub (or allow-listed host) | Repository source | `git` over HTTPS |

---

## 3. UI reverse-engineering

### 3.1 Visual foundation and design tokens

#### 3.1.1 Theme setup (`frontend/src/styles/index.scss`)

- `@use '@carbon/react/scss/config'` with `$font-path: '@ibm/plex'` and `$css--font-face: false`.
- `@use '@carbon/styles/scss/themes'`, then `theme with ($theme: themes.$g100)`, then `@use '@carbon/react'`, `spacing as *`, `type`.
- `@import '@ibm/plex-sans/css/ibm-plex-sans-default.min.css'` supplies the font faces.
- `index.html` sets `<html data-carbon-theme="g100">` and `<meta name="color-scheme" content="dark">`; `:root { color-scheme: dark }`.
- `main.tsx` wraps the app in `<GlobalTheme theme="g100">`.

#### 3.1.2 Design tokens table

Token values are the Carbon **g100** values confirmed from the built CSS bundle. Where the application hard-codes a hex, that is stated.

| Token / use | Value | Where used |
|---|---|---|
| `background` (page) | `#161616` | `body` (hard-coded), login gradient base, favicon |
| `text-primary` | `#f4f4f4` | `body` (hard-coded), `.twin-title` |
| `text-secondary` | `#c6c6c6` | `.header-status`, `.page-subtitle`, `.card-help`, `.stat .label`, `.step-source`, `.twin-sub` |
| `layer-01` | `#262626` | `.card`, `.stat`, `.login-card`, `.twin-rect` |
| `border-subtle-01` | `#393939` (Carbon g100) | `.card`, `.stat`, list separators |
| `border-strong-01` | `#6f6f6f` | `.stat` left border, `.twin-rect` stroke, `.twin-flow` |
| `support-success` | `#42be65` | Connected dot, completed icons, `.stat.ok` |
| `support-error` | `#fa4d56` | Failed dot, `.stat.bad` |
| `support-warning` | `#f1c21b` | `.stat.warn`, skipped/cancelled icons, `.log-line.warn .msg` |
| `support-info` | `#4589ff` | `.stat.info`, running icon, active twin node |
| Hard-coded status blue (connecting / running dot) | `#78a9ff` | `AppShell` header dots, `.src-backend`, favicon glyph |
| Not-configured / idle grey | `#8d8d8d` | `AppShell` header dots |
| Log background | `#0b0b0b` | `.log-view`, markdown `pre`, `.progress-lines` |
| Inline-code background | `#262626` | `.markdown code` |
| Log timestamp | `#6f6f6f` | `.log-line .ts` |
| Log source colours | backend `#78a9ff`; headless-bob `#be95ff`; system `#a8a8a8` | `.src-*` |
| Log error message | `#ff8389` | `.log-line.error .msg` |
| Login background | `radial-gradient(circle at 20% 10%, #1c2a44 0%, #161616 55%)` | `.login-shell` |

#### 3.1.3 Typography

| Role | Font | Detail |
|---|---|---|
| Body / UI | IBM Plex Sans (Plex stack) | via `@ibm/plex-sans` default CSS |
| Code, logs, `pre`, `.mono` | IBM Plex Mono | `.log-view` 0.75 rem, line-height 1.5 |
| `.page-title` | Carbon `heading-05` | margin-bottom `$spacing-02` |
| `.page-subtitle` | Carbon `body-compact-01`, secondary colour | max-width 60 rem, margin-bottom `$spacing-07` |
| `.card-title` | Carbon `heading-03` | flex, gap `$spacing-03`, margin-bottom `$spacing-03` |
| `.card-help` | Carbon `helper-text-01`, secondary | margin-bottom `$spacing-05` |
| `.stat .label` | Carbon `label-01`, uppercase, letter-spacing 0.32 px | secondary colour |
| `.stat .value` | Carbon `heading-03` | margin-top `$spacing-02` |
| Markdown body | Carbon `body-02`, max-width 62 rem | h1 `heading-05`, h2 `heading-04`, h3 `heading-03` |
| Twin text | system SVG text | title 12 px / 600, sub and src 10 px, state 11 px |

#### 3.1.4 Known token caveat

`GlobalTheme` only supplies React context. It does **not** add the `.cds--g100` class to the DOM, so `--cds-*` custom properties are **undefined** in the running page. Consequences:

- HTML surfaces survive because `body` hard-codes `#161616` / `#f4f4f4`, and Carbon component CSS carries its own resolved fallbacks.
- Custom rules that read `var(--cds-*)` (for example `.card { background: var(--cds-layer-01) }`, the success icon fill `var(--cds-support-success)` in `OverviewPage` and `WorkspacePage`) may resolve to the property's initial value.
- SVG is more sensitive than HTML (undefined fill falls back to black, undefined stroke to none). This blanked the first version of the digital twin.
- The twin therefore defines its own `--twin-*` variables with literal g100 values (see [3.4](#34-pipeline-digital-twin)).

A re-implementation must either apply the `cds--g100` class to `<html>` or `<body>`, or keep the literal values above. Status: **Partial** (observation recorded; application source intentionally not changed by this document).

#### 3.1.5 Spacing and layout

| Item | Value |
|---|---|
| Carbon spacing scale | `$spacing-02` … `$spacing-07` (0.25 rem … 3 rem) |
| `.app-main` | padding `$spacing-07`; `min-height: calc(100vh - 3rem)`; `max-width: 1584px`; `margin: 0 auto` |
| `.section` | margin-bottom `$spacing-07` |
| `.card` | background layer-01, 1 px `border-subtle-01`, padding `$spacing-06`; `.card + .card` margin-top `$spacing-05` |
| `.grid-2` | `grid-template-columns: repeat(auto-fit, minmax(min(100%, 28rem), 1fr))`, gap `$spacing-05` |
| `.grid-4` | `repeat(auto-fit, minmax(min(100%, 14rem), 1fr))`, gap `$spacing-05` |
| `.kv` | grid `minmax(8rem, 12rem) 1fr`, gap `$spacing-03 $spacing-05`; `dt` secondary, `dd` wraps anywhere |
| `.stat` | layer-01, border-subtle, left border 3 px `border-strong-01` (variants: ok/bad/warn/info set the colour), padding `$spacing-05` |
| `.actions` | flex wrap, gap `$spacing-03`, margin-top `$spacing-06` |
| `.form-stack > * + *` | margin-top `$spacing-05` |
| `.row` | flex, gap `$spacing-04`, align centre, wrap |
| `.step-list li` | grid `1.5rem 1fr auto`, gap `$spacing-04`, padding `$spacing-04 0`, bottom border-subtle |
| `.log-view` | height 26 rem, scroll, padding `$spacing-04`, border-subtle |
| `.log-line` | grid `5.5rem 6.5rem 1fr`, gap `$spacing-03`, `pre-wrap` |
| `.prompt-area textarea` | min-height 14 rem, IBM Plex Sans |
| `.progress-lines` | max-height 10 rem, mono 0.75 rem, background `#0b0b0b` |
| `.login-card` | width `min(100%, 26rem)`, padding `$spacing-07`, layer-01 |

#### 3.1.6 Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| `max-width: 1056px` | `.hide-md` hidden (the header repository and QSE chips) |
| `max-width: 672px` | `.header-status` hidden entirely; `.app-main` padding `$spacing-05`; `.kv` collapses to one column |
| Always | `grid-2`/`grid-4` auto-fit; twin SVG has `min-width: 1000px` and scrolls horizontally inside `.twin { overflow-x: auto }` |
| Side nav | fixed, expanded, 16 rem wide at all widths (`Content` has `margin-left: 16rem`). There is no collapse or hamburger behaviour. |

#### 3.1.7 Interaction and accessibility notes

- `SkipToContent` in the header.
- `LogViewer` is `role="log"`, `aria-live="off"`, `tabIndex=0`, `aria-label="Execution logs"`; clone progress is `role="log"`.
- `Toasts` container is `aria-live="polite"`.
- Twin SVG has `role="img"`, an `aria-label` summarising every step and external state, and a `<title>`.
- No `ErrorBoundary` exists anywhere in the frontend. A render exception blanks the page. Status: **Planned** (see [14](#14-implementation-gap-analysis)).
- No animations are defined in the app SCSS.

### 3.2 App shell

Source: `frontend/src/layouts/AppShell.tsx`, `frontend/src/components/RequireAuth.tsx`, `frontend/src/App.tsx`.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header (48px): [IBM QSE Automation Workbench]   status chips…        [user]  │
├────────────┬─────────────────────────────────────────────────────────────────┤
│ SideNav    │ Content (margin-left 16rem, margin-top 3rem)                    │
│ 16rem,     │   .app-main (padding $spacing-07, max-width 1584px, centred)    │
│ fixed,     │     <Suspense fallback=Loading> <Outlet/> </Suspense>           │
│ 8 items    │                                                                 │
└────────────┴─────────────────────────────────────────────────────────────────┘
                                           <Toasts/> fixed top 3.5rem, right 1rem
```

**Header**

- Carbon `Header`, `SkipToContent`, `HeaderName` (prefix "IBM", text "QSE Automation Workbench"), a `NavLink` to `/`.
- `.header-status` (label-01, `#c6c6c6`), left to right:
  1. **Bob:** `Bob: [Demo — ]<label>` with an 8 px dot. Dot colours: connected `#42be65`, connecting `#78a9ff`, not_configured `#8d8d8d`, anything else `#fa4d56`.
  2. Magenta `Tag` **`STREAM_MODE=mock`** when mock mode is active. Absent in realtime.
  3. Repository `owner/name@branch` (hidden under 1056 px; max-width 16 rem).
  4. `QSE: <status>` (hidden under 1056 px).
  5. `Execution: <status or Idle>` with dot: running `#78a9ff`, failed `#fa4d56`, completed `#42be65`, else `#8d8d8d`.
- The whole `.header-status` group is hidden under 672 px.
- A `HeaderGlobalAction` with `UserAvatar` (size 20) toggles a `HeaderPanel` containing a `Switcher`: "`username (role)`", a divider, **Settings**, **Sign out** (`Logout` icon).

**Side navigation:** Carbon `SideNav` with `expanded isFixedNav isRail={false}`.

| # | Label | Route | Icon | Active rule |
|---|---|---|---|---|
| 1 | Overview | `/` | `Dashboard` | exact match |
| 2 | Bob Connection | `/bob` | `Connect` | `startsWith` |
| 3 | Repository Configuration | `/repository` | `LogoGithub` | `startsWith` |
| 4 | QSE Configuration | `/qse` | `Chip` | `startsWith` |
| 5 | Execution Workspace | `/workspace` | `Code` | `startsWith` (also matches `/workspace/:id`) |
| 6 | Execution History | `/history` | `Activity` | `startsWith` |
| 7 | Reports | `/reports` | `DocumentMultiple_01` | `startsWith` (also matches `/reports/:id`) |
| 8 | Settings | `/settings` | `Settings` | `startsWith` |

**Auth gate (`RequireAuth`):** while `ready` is false it renders `<Loading description="Checking session" />`; with no user it navigates to `/login` (`replace`, `state.from = pathname`); otherwise `<Outlet/>`.

**Bootstrap (`App.tsx`):** on mount calls `GET /api/auth/me`; on success `setSession(user, csrfToken)`; always `markReady()`. A global 401 handler (`setUnauthorizedHandler`) clears the session and the query cache and navigates to `/login`.

**Provider order (`main.tsx`):** `React.StrictMode` → `GlobalTheme g100` → `QueryClientProvider` → `BrowserRouter` → `App`.
`QueryClient` defaults: retry only on network errors and fewer than 2 attempts; `refetchOnWindowFocus: true`; `staleTime: 5000`.

### 3.3 Pages

All pages except `LoginPage` are `React.lazy` chunks. Every authenticated page sits inside `RequireAuth` → `AppShell`.

#### 3.3.0 Route table

| Route | Component | File | Auth |
|---|---|---|---|
| `/login` | `LoginPage` | `frontend/src/pages/LoginPage.tsx` | public |
| `/` | `OverviewPage` | `frontend/src/pages/OverviewPage.tsx` | session |
| `/bob` | `BobConnectionPage` | `frontend/src/pages/BobConnectionPage.tsx` | session |
| `/repository` | `RepositoryPage` | `frontend/src/pages/RepositoryPage.tsx` | session |
| `/qse` | `QsePage` | `frontend/src/pages/QsePage.tsx` | session |
| `/workspace` | `WorkspacePage` | `frontend/src/pages/WorkspacePage.tsx` | session |
| `/workspace/:executionId` | `WorkspacePage` | same | session |
| `/history` | `HistoryPage` | `frontend/src/pages/HistoryPage.tsx` | session |
| `/reports` | `ReportsPage` | `frontend/src/pages/ReportsPage.tsx` | session |
| `/reports/:executionId` | `ReportViewPage` | `frontend/src/pages/ReportViewPage.tsx` | session |
| `/settings` | `SettingsPage` | `frontend/src/pages/SettingsPage.tsx` | session |
| `*` | redirect to `/` | `frontend/src/App.tsx` | n/a |

Note: the UI does not hide actions by role (viewer/operator). Role enforcement is server-side only; a forbidden action surfaces as a toast with the server's 403 message.

#### 3.3.1 Login (`/login`)

- Full-height `.login-shell` with the radial gradient; centred `.login-card` (form, `aria-labelledby="login-title"`).
- Content: "IBM" eyebrow (`.step-source`), `<h1>` "QSE Automation Workbench", help text "Sign in to orchestrate quantum-safe analysis through Headless Bob."
- Fields: `TextInput#login-username` (autoFocus, required, `autoComplete=username`), `PasswordInput#login-password` (required, `current-password`).
- Submit button full width; disabled while busy or either field empty; shows `InlineLoading "Signing in"` while pending.
- States: idle; busy; error (`InlineNotification` kind error, title "Sign-in failed", subtitle = server message or "Sign-in failed.").
- On success: clears the password, `setSession(user, csrfToken)`, navigates to `state.from` or `/`.
- If already signed in (`ready && user`) it redirects immediately.

#### 3.3.2 Overview (`/`)

- `PageHeader` "Overview".
- Row of 4 `Stat` tiles (`.grid-4`): **Headless Bob** (StatusTag + endpoint; tone ok if connected, none if not_configured, bad otherwise), **Repository** (`owner/name` or "None cloned", sub `Branch <b>`), **QSE CLI** (StatusTag + version), **Executions** (total, tone info, sub "Total recorded").
- `.grid-2`: **Getting started** card (4 numbered steps with done check or dashed circle and an "Open" ghost button) and **Recent executions** card (5 newest; link goes to `/reports/:id` when completed with a report, else `/workspace/:id`; skeleton while loading; `Tile` empty state; error `InlineNotification` "Could not load executions").
- Data: `useBob`, `useRepos`, `useQse`, `useExecutions({page:1,pageSize:5,sort:'createdAt',direction:'desc'})`.

#### 3.3.3 Bob Connection (`/bob`)

- Left card **Connection settings** (form `aria-label="Bob connection settings"`):
  - `TextInput#bob-endpoint` "Headless Bob address", placeholder `http://headless-bob:3000`.
  - `PasswordInput#bob-api-key` "Bob API key" (`autoComplete=new-password`); placeholder `Stored: ••••xxxx — leave blank to keep` when a key hint exists; disabled when auth mode is `none`.
  - Ghost toggle "Show/Hide protocol settings" (`aria-expanded`), revealing: `Dropdown#bob-adapter` (two options), `TextInput#bob-base` "API base path", `Dropdown#bob-auth` (Bearer, Custom header, None), and (only for `header`) `TextInput#bob-header`.
  - Buttons: **Save configuration** (`Save`, disabled unless endpoint non-empty or demo mode), **Test connection** (secondary, disabled unless configured), **Disconnect** (`danger--tertiary`, disabled unless configured).
- Right card **Connection status**: `StatusTag` (forced to `connecting` while a test is pending), `InlineLoading "Contacting Headless Bob"`, error notification for `auth_failed`/`connection_failed`, message line when connected, `KeyValues` (Address, Protocol, API key hint or "Not stored", Last tested).
- Full-width card **Supported capabilities**: `Tile` "No capabilities available…" until a test succeeds, then two `KeyValues` blocks (runtime ready, streaming, cancellation, file download, threads/continuation; run timeout, max message size, max concurrent runs, max download size).
- Toasts: "Configuration saved" (subtitle differs in demo), "Connected to Headless Bob", "Connection test failed", "Disconnected".
- Polling: `useBob` refetches every 1500 ms while `state === 'connecting'`.
- Mock mode: the page is usable without an address; the key is never stored.

#### 3.3.4 Repository Configuration (`/repository`)

- Left card **GitHub repository**: `TextInput#repo-url` (placeholder `https://github.com/owner/repository`; editing clears any validation result), `TextInput#repo-branch` (default `main`), `PasswordInput#repo-token` (optional; helper text switches when a token is already stored).
- Success `InlineNotification` "Repository validated" with `owner/name · branch X · <12-char commit>`.
- Buttons: **Validate repository** (`Checkmark`), **Clone repository** (`Download`), **Re-clone repository** (`Renew`, needs an existing repo), **Remove workspace** (`danger--ghost`, `TrashCan`). All disabled while any mutation is pending or the repo is cloning/validating; validate and clone also need a non-empty URL.
- Right card **Repository details**: `Tile` empty state, or status tag, `InlineLoading "Cloning in progress"`, failure notification "Clone failed", `KeyValues` (name, URL, branch, clone status, workspace label, commit (12), last cloned, files, token stored), and a `role="log"` **Clone progress** block (last 30 sanitized lines).
- The form is seeded from the active/first repository **once** on load.
- Polling: `useRepos` refetches every 1000 ms while any repo is `cloning` or `validating`.
- The page shows one repository (active → first cloned → first). Several can exist in the database; the Workspace page lets the user choose among cloned ones.

#### 3.3.5 QSE Configuration (`/qse`)

- Left card **Locate QSE CLI**: `RadioButtonGroup` (Automatic / Manual).
  - Manual: `TextInput#qse-path`, placeholder `/opt/qse-cli/qse-cli`, helper "Must be an absolute path to an allowed executable (default names: qse-cli, cli.sh)."
  - Automatic: "Discovered candidates" with **Run discovery** (`Search`), `InlineLoading "Searching"`, empty `Tile`, or a `StructuredListWrapper selection` table (Path / Source / Usable tag: green "Executable", gray "Not executable" or "Name not allowed"). Unusable rows are disabled. The first usable candidate is pre-selected.
  - Buttons: primary **Use selected and validate** / **Save and validate**; secondary **Revalidate** / **Validate QSE CLI** (needs a stored path).
- Right card **QSE CLI status**: StatusTag (forced `validating` while pending), error notification "Validation failed", warning "Not reachable from Headless Bob" (valid but outside shared mounts), `KeyValues` (executable path, path in Bob container, detected version, version command, method, validated, execution strategy).
- Discovery query runs automatically when mode is `auto`.

#### 3.3.6 Execution Workspace (`/workspace`, `/workspace/:executionId`)

Cards, top to bottom:

1. **Execution context**: four `.grid-4` cells (Bob status and protocol; repository, branch, clone status; QSE status and version; a repository `Select#ws-repo` shown only when more than one repository is cloned).
2. **What would you like Headless Bob to do?**: `Select#prompt-template` (Full quantum-safe assessment, Cryptographic inventory only, Remediation plan, Dependency review), `Select#prompt-history` (up to 25 distinct previous prompts; disabled when none), `TextArea#prompt` (rows 10, counter, `maxCount` = `settings.limits.maxPromptChars`, falling back to 20000 before settings load; invalid text "Prompt exceeds the N character limit."), **Reset to example**, **Clear**. The textarea is disabled while an execution is active. The draft is saved to `sessionStorage` key `qse.promptDraft`.
3. **Execution controls**: "Pre-flight checks" list (Bob connected; repository cloned; QSE validated **and** reachable from Bob; prompt provided and within limit, each with a **Fix** link to the owning page) and buttons **Start execution** (`Play`, enabled only when all checks pass and nothing is active), **Cancel execution** (`danger--tertiary`, `StopOutline`, enabled only while active and not already `cancelling`), **Clear workspace** (ghost, `TrashCan`, opens the confirmation modal).
4. **Pipeline digital twin**: see [3.4](#34-pipeline-digital-twin).
5. **Execution monitor** (only when an execution is selected): `KeyValues` (ID, status, started, elapsed (ticks every second while active), current activity, "N of M completed[, K failed]", live-updates state "Connected"/"Reconnecting…"/"Not streaming"); `InlineLoading`; notifications for failed, cancelled and warnings; two step lists (**Workbench preparation** `Tag` blue "backend" and **Headless Bob execution** `Tag` purple "headless-bob"); a note "Headless Bob does not report percentage progress, so none is shown." plus streamed character count; the `LogViewer`; and a **View report** button once completed with a report.
6. When nothing is selected: `Tile` "No execution selected. Start one above, or open a previous one from Execution History."

Modal **Clear workspace?** (danger): "This clears the prompt, the current execution view and deletes the cloned repository from the isolated workspace. Execution history and reports are kept." Buttons "Clear workspace" / "Keep".

Behaviour:

- Starting an execution navigates (replace) to `/workspace/:id` and stores the id in `sessionStorage` (`qse.activeExec`); the repository id is in `qse.activeRepo`.
- Live data comes from `useExecutionStream` (SSE) merged over `useExecution` (poll every 4 s while active). Logs: the stream array is used when it holds at least as many lines as the REST fallback (`GET /executions/:id/logs`).
- Because `Content` has no separate scroll container, the page scrolls as a whole.

#### 3.3.7 Execution History (`/history`)

- Carbon `DataTable` in `TableContainer` titled "Executions" (description "`N total`").
- Toolbar: `Search#history-search` (placeholder "Search prompt, repository or ID"; debounced 300 ms; resets page to 1) and `Dropdown#history-status` (All, Completed, Failed, Running, Queued, Cancelling, Cancelled).
- Columns: Execution ID (first 8 chars, tooltip full id, magenta `DEMO` tag for mock runs), Repository, Prompt (summary, tooltip full), Date, Duration, Status (`StatusTag`), Report (green "Available" or gray "None"), Actions (**View execution**, **View report** (disabled without a report)).
- Sortable by Repository, Date, Duration, Status; clicking toggles direction; a new column starts descending.
- `Pagination` page sizes 10/25/50.
- States: skeleton rows while loading, empty row "No executions match…" with a link, error notification "Could not load history".
- Auto-refresh every 3 s while any listed execution is queued/running/cancelling.

#### 3.3.8 Reports (`/reports`)

- Lists completed executions that have a `reportId`, taken from the newest 100 executions (client-side filter). Executions beyond the newest 100 are not shown (limitation).
- Each is a `Card` with status tag, optional `DEMO` tag, date, repository name, prompt summary, branch, duration, a link to the execution and an **Open report** button.
- States: skeleton, empty `Tile` "No reports yet. A report is available after an execution finishes.", error notification.

#### 3.3.9 Report view (`/reports/:executionId`)

- Loads `GET /api/executions/:id/report` (no retry). 404 renders a warning "No report available"; other errors an error notification; both with an "Open execution" link.
- Header "End-to-End Report", subtitle `repo · branch X · generated <date>`, actions: **Copy report** (clipboard), **Markdown**, **PDF**, **JSON results** (anchor downloads), **View execution logs** (jumps to the Logs tab).
- Status tag plus a source tag: green "Report file written by Headless Bob", blue "Final answer returned by Headless Bob (no report file was produced)", red "Headless Bob returned no report content".
- Warning or info notification for `unavailable` and `headless-bob-output`.
- `Tabs` (contained): **Executive Summary** (sections `summary` + `conclusion`; falls back to the raw `bobMarkdown` when the report has no structure), **Findings** (`findings` + `other`), **Recommendations**, **Execution Details** (KeyValues, warnings, step list), **Artifacts** (list with Download for retrieved files, "Not retrieved" tag otherwise, and an **Export report with logs (JSON)** link), **Logs** (fetched lazily when tab 5 opens; `LogViewer`, note "Secrets are redacted before logs are stored.").
- Section text is rendered by the `Markdown` component (raw HTML skipped, only `http(s):`, `mailto:`, `#` links kept, links open in a new tab with `noopener noreferrer nofollow`).

Note: the report tabs are fixed by the UI. There is **no** "Cryptographic Findings", "Risk Categorization" or "Remediation" tab; those names appear only if Bob's own Markdown headings match the classifier (see [4.7](#47-report-generation)).

#### 3.3.10 Settings (`/settings`)

- **Server configuration** (read-only `KeyValues`): version, execution strategy, prompt limit, execution timeout, concurrent executions, allowed Git hosts, session lifetime and idle time, encryption key id, stream mode tag (magenta "mock — demo, recorded data" or green "realtime — live Headless Bob").
- **Shared execution environment**: list of `label → bobPath` mounts, or `Tile` "No shared mounts configured."
- **Change password**: three `PasswordInput`s (current, new with helper "At least 12 characters.", confirm with mismatch error "Passwords do not match."). Submit enabled only when current is set, new has at least 12 characters and matches. On success all sessions are revoked server-side, the client clears session and cache and navigates to `/login` with a toast.
- **Credential rotation**: admin sees the instructions and a **Re-encrypt stored secrets** button opening a confirmation modal; others see an info notification "Administrator only".

### 3.4 Pipeline digital twin

Source: `frontend/src/components/PipelineTwin.tsx`; tests: `frontend/src/components/PipelineTwin.test.tsx` (5 tests); styles: `.twin*` at the end of `frontend/src/styles/index.scss`; mounted by `WorkspacePage` inside `Card title="Pipeline digital twin"`.

**Status:** Implemented. A pure view of data the page already has; it makes no API call and never invents progress or a percentage.

**Props (`PipelineTwinProps`):**

| Prop | Type | Meaning |
|---|---|---|
| `execution` | `Execution \| null` | Source of the step list. Empty or null selects the placeholder list. |
| `bob` | `BobConnection?` | Colours and labels the Headless Bob external node |
| `repo` | `Repository?` | Colours and labels the Git external node |
| `qse` | `QseConfig?` | Colours and labels the QSE CLI external node |
| `streamMode` | `'mock' \| 'realtime'?` | Triggers the DEMO note and the "recorded" QSE detail |

Also exported: `buildExternals(...)`.

**Geometry constants:** `STEP_W=108`, `STEP_H=76`, `GAP=24`, `PAD=12`, `EXT_Y=16`, `EXT_H=60`, `STEP_Y=150`. `viewBox = 0 0 {PAD*2 + n*STEP_W + (n-1)*GAP} 252`. For 9 steps width is 1188; for 8, 1056. The SVG has `min-width: 1000px` and `width: 100%`.

**Layout:** a row of step nodes (rect 108×76, 4 px left status bar, two title lines, a state line, optional duration, and the source label `backend` / `headless-bob` beneath). Arrows run between consecutive steps and turn green once the upstream step is completed. Above the row sit three external nodes, each centred over the step(s) it links to with dashed connector lines; a connector turns blue and thick while a linked step is running.

| External node | `data-testid` | Width | Linked steps | Tone rule |
|---|---|---|---|---|
| Git repository | `twin-ext-git` | 112 | `prepare_repo` | cloned → ok; failed → error; else idle |
| QSE CLI | `twin-ext-qse` | 112 | `validate_qse` | valid → ok; invalid → error; else idle |
| Headless Bob | `twin-ext-bob` | 172 | `submit_prompt`, `bob_processing` | connected → ok; auth/connection failed → error; else idle |

**Step tone map:** pending → idle, running → active, completed → ok, failed → error, skipped → warn, cancelled → warn. Step `data-testid` is `twin-step-<key>`; the wrapper is `pipeline-twin`.

**Short labels (`SHORT`)** exist for the 8 keys `validate_config`, `prepare_repo`, `validate_qse`, `prepare_context`, `submit_prompt`, `bob_processing`, `retrieve_results`, `generate_report`. Any other key (notably `completed`) falls back to splitting the backend label in half and truncating each half to 16 characters.

**Colour variables** (defined on `.twin`, because `--cds-*` are undefined, see 3.1.4):

| Variable | Value | Variable | Value |
|---|---|---|---|
| `--twin-layer` | `#262626` | `--twin-success` | `#42be65` |
| `--twin-border` | `#6f6f6f` | `--twin-info` | `#4589ff` |
| `--twin-text` | `#f4f4f4` | `--twin-error` | `#fa4d56` |
| `--twin-text-2` | `#c6c6c6` | `--twin-warning` | `#f1c21b` |

**CSS classes:** `.twin`, `.twin-svg`, `.twin-rect`, `.twin-bar`, `.twin-title`, `.twin-sub`, `.twin-src`, `.twin-state`, `.twin-flow` (`--done`), `.twin-link` (`--live`), `.twin-arrowhead`, `.twin-node--ok|active|error|warn`, `.twin-note`.

**Footer note:** "Now: <running step label>. " (only when a step is running) + "Built only from real step events and connection status; no percentage is shown because Headless Bob does not report one." + " DEMO: this twin replays a recorded run." when `execution.mock` or `streamMode === 'mock'`.

**Known inconsistency (Partial):** the backend defines **9** steps (`backend/src/orchestrators/steps.ts`, ending with `completed`). The twin's placeholder `DEFAULT_STEPS` (shown when no execution exists) has **8** (no `completed`). Once an execution exists the twin renders `execution.steps` (9 nodes) and the `completed` node uses the fallback label split ("Execution", "completed"). Both are cosmetic.

**Tests (5):** renders all steps pending with no execution; reflects real step statuses; shows the demo notice only for recorded runs; `buildExternals` derives external health from connection status; marks everything idle when nothing is configured.


### 3.5 Component inventory

All paths under `frontend/src/`. "Dependencies" lists the Carbon or library parts used.

#### 3.5.1 Shared components

| Name | Purpose | Path | Props | Local state | Events | Styling | Variants | Dependencies | Responsive |
|---|---|---|---|---|---|---|---|---|---|
| `PageHeader` | Page title row | `components/PageHeader.tsx` | `title: string`, `subtitle?: string`, `actions?: ReactNode` | none | none | `.row`, `.page-title`, `.page-subtitle`, `.spacer` | with/without subtitle and actions | none | actions wrap via `.row` |
| `Card` | Layer-01 panel with optional title bar | `components/PageHeader.tsx` | `title?`, `icon?`, `help?`, `children`, `actions?` | none | none | `.card`, `.card-title`, `.card-help` | titled / untitled | none | fluid |
| `Stat` | Summary tile | `components/PageHeader.tsx` | `label`, `value`, `sub?`, `tone?: 'ok'\|'bad'\|'warn'\|'info'` | none | none | `.stat` + tone class | 4 tones + none | none | in `.grid-4` |
| `KeyValues` | Definition list of label/value pairs | `components/PageHeader.tsx` | `rows: Array<[string, ReactNode]>` | none | none | `.kv` | none | none | one column under 672 px; null value renders `—` |
| `StatusTag` | Coloured status pill | `components/StatusTag.tsx` | `status: AnyStatus`, `size?: 'sm'\|'md'` | none | none | Carbon `Tag` | 21 mapped statuses (below); unknown → gray with raw text | `Tag` | n/a |
| `statusLabel` | Label lookup helper | `components/StatusTag.tsx` | `(s: string)` | none | none | n/a | n/a | none | n/a |
| `LogViewer` | Filterable, auto-scrolling log list | `components/LogViewer.tsx` | `logs: ExecutionLog[]`, `live: boolean` | `follow` (true), `source` ('all') | `Dropdown` change, `Checkbox` change | `.log-view`, `.log-line`, `.ts`, `.src-*` | source filter: all / backend / headless-bob / system; `headless-bob` is displayed as `bob` | `Dropdown#log-source`, `Checkbox#log-follow` | fixed height 26 rem, scrolls |
| `Markdown` | Safe Markdown renderer | `components/Markdown.tsx` | `children: string` | none | none | `.markdown` | GFM tables | `react-markdown`, `remark-gfm` | max-width 62 rem |
| `RequireAuth` | Route guard | `components/RequireAuth.tsx` | none | none | none | n/a | loading / redirect / outlet | `Loading`, `Navigate`, `Outlet` | n/a |
| `Toasts` | Toast stack | `components/Toasts.tsx` | none | reads `useToasts` | `onClose` dismisses | fixed, top 3.5 rem, right 1 rem, z-index 9100, grid gap 0.5 rem | kinds success/error/info/warning, `lowContrast`, `timeout={0}` (store handles expiry) | `ToastNotification` | fixed |
| `PipelineTwin` | Pipeline diagram | `components/PipelineTwin.tsx` | see 3.4 | none | none | `.twin*` | tones ok/active/error/warn/idle | inline SVG | horizontal scroll under 1000 px |
| `AppShell` | Header, side nav, outlet | `layouts/AppShell.tsx` | none | user-panel open flag | sign out, nav clicks | Carbon `Header`, `SideNav`, `.header-status` | mock vs realtime header | Carbon UI Shell, `@carbon/icons-react` | see 3.1.6 |

`StatusTag` mapping (type / label):

| Status | Carbon tag | Label |
|---|---|---|
| not_configured | gray | Not configured |
| connecting | blue | Connecting |
| connected | green | Connected |
| auth_failed | red | Authentication failed |
| connection_failed | red | Connection failed |
| pending | gray | Pending |
| validating | blue | Validating |
| validated | cyan | Validated |
| cloning | blue | Cloning |
| cloned | green | Cloned |
| failed | red | Failed |
| discovered | cyan | Discovered |
| valid | green | Valid |
| invalid | red | Invalid |
| queued | gray | Queued |
| running | blue | Running |
| cancelling | warm-gray | Cancelling |
| completed | green | Completed |
| cancelled | warm-gray | Cancelled |
| skipped | gray | Skipped |

(`pending`/`failed`/`skipped` are shared across repo, step and execution status domains.)

#### 3.5.2 Page-local components (not exported)

| Name | File | Purpose |
|---|---|---|
| `StepIcon` | `pages/WorkspacePage.tsx` | Icon per step status: `CheckmarkFilled` (success), `ErrorFilled` (error), `InProgress` (info), `WarningFilled` (warning, for cancelled/skipped), `CircleDash` (pending) |
| `StepRow` | `pages/WorkspacePage.tsx` | One `li`: icon, label, source line ("Headless Bob" / "Workbench backend"), optional message, small `StatusTag` |
| `Sections` | `pages/ReportViewPage.tsx` | Renders report sections as `h3` + `Markdown`, or an empty `Tile` |

#### 3.5.3 Hooks, stores and services

| Name | File | Behaviour |
|---|---|---|
| `useBob`, `useQse`, `useSettings` (stale 60 s), `usePrompts`, `useRepos`, `useExecutions`, `useExecution`, `useReport`, `useInvalidate` | `hooks/queries.ts` | TanStack Query wrappers. Poll intervals: Bob 1500 ms while `connecting`; repos 1000 ms while `cloning`/`validating`; executions list 3000 ms while any active; single execution 4000 ms while active |
| `keys` | `hooks/queries.ts` | Query-key factory: `bob`, `repos`, `repo(id)`, `qse`, `qseDiscover`, `executions(q)`, `execution(id)`, `report(id)`, `prompts`, `settings` |
| `useExecutionStream(id)` | `hooks/useExecutionStream.ts` | `EventSource` on `/api/executions/:id/stream?after=<lastId>` with credentials. Listens to `execution` and `log`. Keeps at most **5000** log lines. On error: closes, and if the cached execution is not terminal retries after **2000 ms**. Terminal events invalidate `['executions']` and `['prompts']`. |
| `useNotify` | `hooks/useNotify.ts` | `success`, `info`, `error(e, title)` → toasts; error subtitle from `ApiError.message` |
| `useNow(active, interval=1000)` | `hooks/useElapsed.ts` | Ticking clock for elapsed time |
| `useSession` (zustand) | `stores/session.ts` | `{user, ready, setSession(user, csrf), markReady}`; stores the CSRF token in module memory only |
| `useWorkspace` (zustand) | `stores/workspace.ts` | `activeRepositoryId`, `activeExecutionId`, `promptDraft`; persisted to `sessionStorage` keys `qse.activeRepo`, `qse.activeExec`, `qse.promptDraft`. No secrets. |
| `useToasts` (zustand) | `stores/notifications.ts` | Keeps the last 4 toasts; auto-dismiss after 6 s (10 s for errors) |
| `api` | `services/api.ts` | Typed fetch client; see [6](#6-api-specification). `ApiError(status, code, message, requestId?)`. `credentials: 'same-origin'`. Sends `X-CSRF-Token` on every non-GET. POST bodies default to `{}`. Network failure → `ApiError(0, 'network_error', 'Cannot reach the Workbench backend. Check your connection.')`. 401 on any path other than `/auth/login` and `/auth/me` invokes the unauthorized handler. |
| `format.ts` | `services/format.ts` | `formatDuration`, `formatDate`, `formatBytes`, `formatTime`, `ACTIVE_STATUSES` (queued, running, cancelling), `TERMINAL_STATUSES` (completed, failed, cancelled) |
| Types | `types/api.ts` | All DTO interfaces used below |

### 3.6 UI assets

| Asset | Detail |
|---|---|
| Favicon | `frontend/public/favicon.svg`: 32×32 viewBox, `#161616` square, a `#78a9ff` hexagonal "cube" glyph |
| Page title | `QSE Automation Workbench` (`frontend/index.html`) |
| Fonts | IBM Plex Sans via `@ibm/plex-sans` (bundled CSS, no CDN). IBM Plex Mono for code. |
| Icons | `@carbon/icons-react` only: Dashboard, Connect, LogoGithub, Chip, Code, Activity, DocumentMultiple_01, Settings, UserAvatar, Logout, Plug, Save, Unlink, Renew, Checkmark, TrashCan, Download, Search, Play, StopOutline, Reset, Time, CheckmarkFilled, CircleDash, ErrorFilled, InProgress, WarningFilled, ArrowRight, Copy, DocumentExport |
| Images / logos | None. The "IBM" text is the only brand mark. |

---

## 4. Feature specifications

Conventions: "mock" means `STREAM_MODE=mock`; "realtime" means `STREAM_MODE=realtime`. `STREAM_MODE` **defaults to `mock`** in `backend/src/config/env.ts`. Role requirements are enforced by `requireRole` in `backend/src/routes/index.ts`; `viewer` may only read.

### 4.0 Authentication and session (supporting feature)

| Item | Detail |
|---|---|
| Overview | Local accounts, server-side sessions, CSRF protection. Not in the user's feature list but a precondition for everything. |
| Journey | Open any route → `RequireAuth` calls `/auth/me` → redirected to `/login` → submit credentials → land on the requested page. |
| Preconditions | The bootstrap admin (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) is created on first start if absent. |
| Inputs | `username` ≤ 64, `password` ≤ 256 (zod `loginSchema`). Password change: `currentPassword`, `newPassword` 12–256. |
| Processing | scrypt (N=16384, r=8, p=1) verification with a dummy hash when the user does not exist (uniform timing). Session id is random; only its sha256 is stored. Cookie `qse_sid` (httpOnly, SameSite=Strict, `Secure` when `cookieSecure`). A per-session CSRF token is returned in the login body. |
| API | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/password` |
| Persistence | `users`, `sessions` |
| Success | Login 200 `{user, csrfToken}`; logout 204; password change 204 and **all sessions of that user revoked**. |
| Failure | 401 `invalid_credentials` ("Invalid username or password", same text for unknown user and bad password); 403 `invalid_credentials` ("Current password is incorrect") on password change; 429 from the login rate limiter; 400 `validation_error`. |
| UI transitions | Login: idle → busy → (redirect \| error notification). Password change: success → session cleared → `/login`. |
| Security | Idle expiry (`SESSION_IDLE_MINUTES`) and absolute expiry (`SESSION_TTL_MINUTES`); expired sessions are deleted on use and a purge job runs every 5 min. Login limiter: `LOGIN_RATE_LIMIT_MAX` (default 10) per 15 min window. |
| Tests | `backend/tests/integration/security.test.ts` (auth/CSRF, roles, rate limit, probes); `frontend/src/pages/pages.test.tsx` (LoginPage, 2 tests) |
| Status | Implemented. User management is **Planned**. |

### 4.1 Bob connection

| Item | Detail |
|---|---|
| Overview | Store the address and API key of a Headless Bob service (encrypted) and test it. The browser never calls Bob; the backend does. |
| Journey | `/bob` → enter address and key → **Save configuration** → **Test connection** → capabilities appear → `Connected`. |
| Preconditions | Session; role operator or admin for connect/test/disconnect. Realtime only for real calls. |
| Inputs and validation | `bobConnectSchema`: `endpoint` ≤ 300; `adapter` `rest-threads`\|`acp`; `apiBasePath` default `/api/v1` (must look like `/api/v1`, else `invalid_base_path`); `authMode` `bearer`\|`header`\|`none`; `authHeaderName` default `authorization` (token chars only, else `invalid_header_name`); `apiKey` ≤ 512, 8–512 chars, no whitespace (else `invalid_api_key`). Endpoint SSRF rules in [8](#8-security). A key is required for a new or changed endpoint (`api_key_required`); if the endpoint is unchanged and no key is sent, the stored key is kept. |
| Processing | `save()` normalises and validates, seals the key with AES-256-GCM, stores a hint `••••<last4>`, persists the row with state `connecting`, and then **immediately calls `test()`**, so "Save configuration" also performs a connection test (the toast text "Run Test Connection to verify" understates this). `test()` sets `connecting`, builds an adapter, runs the adapter's connection test, stores state, message and capabilities. State mapping: success → `connected`; HTTP 401/403 → `auth_failed`; 404 (wrong base path) or any other failure → `connection_failed`. `rest-threads` probes `GET /healthz` (no auth, no base path) then `GET {base}/capabilities`. `acp` probes `/ping`, `/agents` (needs agent `headlessbob`) and `/readyz`. `disconnect()` deletes the row (and so the key). |
| API | `GET /api/bob/status`, `POST /api/bob/connect`, `POST /api/bob/test-connection`, `POST /api/bob/disconnect` |
| Persistence | `bob_connection` (single row `id=1`), `api_key_enc`, `api_key_hint`, `capabilities` JSON |
| Success | `BobConnection` JSON (never contains the key). |
| Failure | `invalid_endpoint`, `endpoint_not_allowed`, `invalid_base_path`, `invalid_header_name`, `invalid_api_key`, `api_key_required`, `secret_unreadable`, `bob_not_configured` (409), 409 `execution_active` on disconnect during a run, network errors mapped to readable messages (connection refused, host not found, timeout, TLS). |
| UI transitions | not_configured → (save, which also tests) connecting → connected \| auth_failed \| connection_failed; **Test connection** repeats the last step. |
| Security | SSRF guard at save and at connect time (DNS-level); redirects are not followed; response size caps (JSON 4 MiB). Key never returned, logged or placed in a URL. |
| Mock behaviour | Endpoint is the constant `demo://recorded-run`; the state is always `connected`; the key is never stored; recorded capabilities are returned; save/test/disconnect do not touch the network. UI shows "Demo —" in the header and a DEMO-specific toast. |
| Tests | `security.test.ts` (Bob connection suite, 11 tests); `demo.test.ts`; `pages.test.tsx` BobConnectionPage (4 tests) |
| Status | Implemented (realtime); Mocked (mock). `acp` supports no file retrieval, so report source falls back to the final answer (**Partial** for that adapter). |

### 4.2 GitHub repository management

| Item | Detail |
|---|---|
| Overview | Validate reachability of a repository and branch, then shallow-clone it into an isolated workspace directory. |
| Journey | `/repository` → URL + branch (+ optional token) → **Validate** (optional) → **Clone** → progress lines → `Cloned` with commit and file count. |
| Preconditions | Session; operator role for validate. Realtime needs `git` on the backend host. |
| Inputs and validation | `repoInput`: `url` ≤ 300, `branch` default `main` (≤ 200), `token` ≤ 255 (8–255 chars, no whitespace else `invalid_token`). URL: `https` only; no credentials, query, hash or port; host in `GITHUB_ALLOWED_HOSTS`; exactly `owner/repo`; owner/name and branch regex checked (`invalid_repository_url`, `repository_host_not_allowed`, `invalid_branch`). |
| Processing | **Validate:** `git ls-remote --exit-code --heads <url> <branch>`; returns owner, name, branch and head commit. **Clone** (202, background): status `cloning` → `git clone --depth 1 --single-branch --no-tags --progress --branch <b>` into `<dir>.new` under `WORKSPACE_ROOT/repo-<hex>/`, then rename to `repo`; validates the tree (removes symlinks that escape, counts files; cap 250 000), removes the remote `origin`, reads HEAD commit; status `cloned`. Token is passed through `GIT_CONFIG_*` `http.extraHeader` as Basic `x-access-token:<token>`, never in argv or URL. `GIT_ALLOW_PROTOCOL=https`, hooks disabled, empty `credential.helper`. Progress keeps the last 30 lines with paths scrubbed. **Re-clone:** same, optionally new branch/token. **Remove:** deletes the work dir and row. |
| API | `GET /api/repositories`, `POST /api/repositories/validate`, `POST /api/repositories/clone` (202), `GET /api/repositories/:id`, `POST /api/repositories/:id/reclone` (202), `DELETE /api/repositories/:id` (204) |
| Persistence | `repositories` (`token_enc`, generated `dir_name`, `status`, `commit_sha`, `file_count`); files under `WORKSPACE_ROOT` |
| Success | `Repository` JSON; `hasToken` boolean only; `workspaceLabel` is a non-path label. |
| Failure | `branch_not_found`, `repository_unreachable`, `git_timeout` (504), `clone_failed`, `clone_cancelled`, `repository_too_large`, `git_unavailable` (500), `workspace_invalid`, 409 conflicts (clone already running; repo in use by an execution). On restart, repos left in `cloning`/`validating` are marked `failed`. |
| UI transitions | pending → validating → validated → cloning → cloned \| failed. |
| Security | Repository content is treated as untrusted data: never executed; the prompt tells Bob to treat it as data. Paths validated with `isInside`/`realpathInside`. Clone errors are redacted. |
| Mock behaviour | No git call; the recorded repository (`SunilManika/crypto-inventory-demo@main`, commit `bcc625a1…`, 55 files) is reported as cloned regardless of the URL entered. |
| Tests | `security.test.ts` (GitHub suite, 5 tests), `tests/unit/github.test.ts` (3 tests incl. `it.each`), `workflow.test.ts` (symlink clone) |
| Status | Implemented (realtime); Mocked (mock). The list is global (not per user). |

### 4.3 QSE CLI discovery and validation

| Item | Detail |
|---|---|
| Overview | Locate the QSE CLI executable, prove it runs, and ensure Headless Bob can reach the same path. |
| Journey | `/qse` → **Run discovery** → pick a candidate (or enter an absolute path) → **Use selected and validate** → `Valid` with version. |
| Preconditions | Session; operator role for configure/validate/discover. |
| Inputs and validation | `qseConfigureSchema`: `mode` `auto`\|`manual`; `path` ≤ 1024; `versionArgs` ≤ 4 items, each ≤ 40 chars and matching `^[A-Za-z0-9._=-]{1,40}$` (`invalid_version_args`). Manual path must be absolute (`invalid_qse_path`). |
| Processing | **Discover** (never executes anything): candidates from `QSE_CLI_PATH`, then `PATH`, then `QSE_CLI_SEARCH_DIRS`. A candidate is `allowed` when its real path lies inside `QSE_CLI_ALLOWED_DIRS` **and** its basename is in `QSE_CLI_EXECUTABLE_NAMES`; `executable` from file mode. **Configure:** `auto` requires the chosen path to be a candidate that is `allowed && executable` (`not_a_candidate`; none → `qse_not_found`); `manual` requires `path` (`path_required`). Then validates. **Validate:** runs the CLI directly (no shell) with `QSE_CLI_VERSION_ARGS` (default `-v`), cwd = the CLI directory, `minimalEnv()` plus the real `HOME` (the CLI keeps licence state in `$HOME/qs-explorer`), timeout `QSE_VALIDATION_TIMEOUT_MS`. Output containing "license agreement has not been accepted" yields `invalid` even with exit code 0; the workbench never accepts the licence. `extractVersion` prefers a line like `version: <digits>`, else the first non-empty line. Result view adds `bobVisiblePath` (via `PathMapper`), `reachableFromBob`, `strategy`. |
| API | `GET /api/qse/discover`, `POST /api/qse/configure`, `POST /api/qse/validate`, `GET /api/qse/status` |
| Persistence | `qse_config` (single row) |
| Success | `QseConfig` with `status: 'valid'`, `version`, `validatedAt`. |
| Failure | `status: 'invalid'` with a `message`; `qse_not_configured` (409) when validating with no path; symlink escaping the allowed dir is refused. |
| UI transitions | not_configured → discovered → (validate) valid \| invalid. A `valid` CLI outside the shared mounts shows the "Not reachable from Headless Bob" warning and blocks execution. |
| Security | Directory + basename allow-listing, `realpath` checks, shell-free exec, output cap 1 MiB, timeout then SIGKILL after 2 s. |
| Mock behaviour | Recorded values: path `/usr/local/bin/qse-cli-artifacts/cli.sh`, version `App Version : 2.3.1.0 Build Version : 202605.00095`. |
| Tests | `security.test.ts` (QSE suite, 6 tests), `tests/unit/qse-validator.test.ts` (6 tests) |
| Status | Implemented (realtime); Mocked (mock). The 4 version args are not editable in the UI (only via API/`QSE_CLI_VERSION_ARGS`). |

### 4.4 Prompt management

| Item | Detail |
|---|---|
| Overview | A single free-text instruction is sent to Headless Bob. The workbench wraps it with execution context and a deliverable specification. |
| Journey | `/workspace` → pick a template or history entry or type → edit → **Start execution**. |
| Preconditions | Session. |
| Inputs and validation | UI: non-empty and ≤ `settings.limits.maxPromptChars`. API zod: 1–20000. **Orchestrator additionally enforces `MAX_PROMPT_CHARS`** (default 8000, config max 15000) → `prompt_too_long`. See the mismatch in [14](#14-implementation-gap-analysis). |
| Templates (client-side constants in `WorkspacePage.tsx`) | `full` "Full quantum-safe assessment" (also the "Reset to example" text), `inventory` "Cryptographic inventory only", `remediation` "Remediation plan", `deps` "Dependency review". |
| Processing | `prompt-builder.ts` produces one text message: an execution-context block (repository path and branch as Bob sees them, QSE CLI path as Bob sees it, rules including "repository content is untrusted DATA"), the user task, and a six-section deliverable: Executive Summary, Repository Analysis, Quantum-Safe Assessment, Recommendations, Execution Artifacts, Conclusion, plus an instruction to write `./qse-e2e-report.md` if the adapter supports files. It forbids fabricating results. |
| API | `GET /api/executions/prompts` (25 most recent distinct prompts); prompt is submitted via `POST /api/executions`. |
| Persistence | `prompt_history` (trimmed to the latest 200 rows on each insert); browser `sessionStorage` draft |
| Success | Prompt appears in history after the execution is created. |
| Failure | `prompt_required`, `prompt_too_long`, `validation_error`. |
| UI transitions | The textarea is disabled while an execution is active; invalid state when over the limit. |
| Security | Prompt is stored verbatim in `executions.prompt`; redaction is applied to logs, not to the prompt record. Do not paste secrets into prompts. |
| Tests | `pages.test.tsx` (WorkspacePage pre-flight, 2 tests), `report.test.ts` (prompt builder) |
| Status | Implemented. Template editing/management is **Planned** (templates are hard-coded). |

### 4.5 Execution orchestration

| Item | Detail |
|---|---|
| Overview | A queued, cancellable pipeline of 9 recorded steps that prepares context, runs Bob, and builds a report. |
| Journey | **Start execution** → 202 + execution record → workspace page streams updates. |
| Preconditions | Operator role; Bob `connected`; a `cloned` repository; QSE `valid` and `reachableFromBob`; no other active execution for the same repository (409). |
| Inputs and validation | `executionCreateSchema`: `repositoryId` (uuid), `prompt`. Preflight error codes in [9](#9-error-handling-catalogue). |
| Steps (`backend/src/orchestrators/steps.ts`) | 1 `validate_config` (backend), 2 `prepare_repo` (backend), 3 `validate_qse` (backend), 4 `prepare_context` (backend), 5 `submit_prompt` (backend), 6 `bob_processing` (**headless-bob**, "includes QSE analysis"), 7 `retrieve_results` (backend), 8 `generate_report` (backend), 9 `completed` (backend). |
| Statuses | Execution: `queued`, `running`, `cancelling`, `completed`, `failed`, `cancelled`. Step: `pending`, `running`, `completed`, `failed`, `skipped`, `cancelled`. |
| Processing | Creation persists the execution and steps, pushes to an in-process queue honouring `MAX_CONCURRENT_EXECUTIONS`. The run re-checks Bob/repo/QSE, maps paths with `PathMapper`, builds the prompt, creates a thread, posts the message with an `idempotency-key` header, consumes events (SSE where available; otherwise polling every 2000 ms, tolerating up to 10 consecutive failures), accumulates streamed output, then walks the Bob workspace (depth 3) for artifacts up to `MAX_ARTIFACTS` (200) and `MAX_ARTIFACT_BYTES` (25 MiB each), downloads `qse-e2e-report.md` if present, and calls the report service. Timeout `EXECUTION_TIMEOUT_MS` triggers cancel. **Cancel:** sets `cancelling`, calls the adapter's cancel, waits a 30 s grace, then finalises as `cancelled`. **Restart recovery:** executions left active are set to `failed` with "Interrupted by a Workbench restart". Logs are redacted, capped at 4000 chars per line and also broadcast on an in-memory bus. |
| API | `POST /api/executions` (202), `GET /api/executions`, `GET /api/executions/:id`, `POST /api/executions/:id/cancel` (202) |
| Persistence | `executions`, `execution_steps`, `execution_logs`, `reports`, `artifacts`, `prompt_history` |
| Success | Terminal `completed` with `reportId`. |
| Failure | Bob errors recorded on the step and execution (`status: failed`, `error` set); no report is fabricated. Cancel → `cancelled`. Shutting down → 503 `shutting_down`. |
| UI transitions | queued → running → (completed \| failed \| cancelled); running → cancelling → cancelled. |
| Security | Operator role and "heavy" rate limit on start; per-repository concurrency guard; paths translated, never raw host paths exposed (`workspaceLabel`). |
| Mock behaviour | `replay()` of `recorded-run.json` (159 recorded Bob events and 4 files, recorded duration 253 273 ms) paced by `DEMO_STEP_DELAY_MS` (700), `DEMO_BOB_WAIT_MS` (6000) and `DEMO_REPLAY_SPEED` (4). All records carry `mock=true`. |
| Tests | `workflow.test.ts` (6 tests incl. cancel, failure, fallback), `demo.test.ts` (10 tests) |
| Status | Implemented (realtime); Mocked (mock). Concurrency queue is in-memory; queued executions are not restored after a restart (they are failed). |

### 4.6 Real-time monitoring

| Item | Detail |
|---|---|
| Overview | Live execution state and log lines over Server-Sent Events, with resume. |
| Journey | The workspace page opens an `EventSource` for the selected execution. |
| Preconditions | Session (cookie; `EventSource` is opened with credentials). GET so no CSRF header is needed. |
| Inputs | `?after=<logId>` or `Last-Event-ID` header. |
| Processing | On connect: send an `execution` snapshot, replay persisted logs after the cursor, subscribe to the bus. `log` events carry `id:` for resume. `execution` snapshots are debounced 150 ms. A comment heartbeat `: heartbeat` every 15 s also re-flushes logs and re-sends a snapshot. Cleanup on `close`. |
| API | `GET /api/executions/:id/stream` (SSE), `GET /api/executions/:id/logs?after=` (REST fallback) |
| Persistence | `execution_logs` |
| Success | Event types: `execution` (full `Execution`), `log` (`ExecutionLog`). |
| Failure | 404 if the execution does not exist; client reconnects after 2 s unless the execution is terminal. NGINX location for the stream disables buffering and uses a 3600 s read timeout. |
| UI transitions | "Live updates": Connected / Reconnecting… / Not streaming; log viewer shows `· live` while streaming. |
| Security | Authenticated, redacted lines only. |
| Tests | Covered indirectly by `workflow.test.ts`; `components.test.tsx` (LogViewer). There is **no dedicated SSE protocol test** (gap). |
| Status | Implemented. No percentage progress exists by design: Headless Bob does not report one. |

### 4.7 Report generation

| Item | Detail |
|---|---|
| Overview | Turn Bob's output into a stored Markdown report, split into sections for the UI, with PDF and JSON export. |
| Journey | When the run ends, the report is built; the user opens `/reports/:executionId`. |
| Report source priority | 1 `headless-bob-file` (the `qse-e2e-report.md` file retrieved from Bob's workspace) → 2 `headless-bob-output` (Bob's final answer) → 3 `unavailable` (no content; **no report body is fabricated**). |
| Processing | `parseSections` chooses a heading level and splits; `classifyHeading` maps titles to `summary`, `findings`, `recommendations`, `conclusion`, or `other` (titles containing "artifact" or "execution details" are always `other`). `compose` builds the final Markdown: `# QSE End-to-End Execution Report`, an optional DEMO blockquote, `## Execution Details` table, `## User Objective`, `# Report from Headless Bob` (Bob's body) and `## Artifacts retrieved by the Workbench`. `pdf.service` renders A4 with margin 54, headings, lists, Courier code, tables as text and blockquotes. |
| API | `GET /api/executions/:id/report`, `GET /api/reports/:id`, `GET /api/reports/:id/download?format=markdown\|pdf\|json`, `GET /api/reports/:id/export`, `GET /api/executions/:id/artifacts`, `GET /api/executions/:id/artifacts/:artifactId/download` |
| Persistence | `reports` (`markdown`, `bob_markdown`, `sections` JSON, `source`, `source_detail`, `mock`), `artifacts` |
| Success | Download filenames: `qse-report-<8 chars>[-DEMO].(md\|pdf\|json)`; export `qse-results-<8 chars>.json`; all with `X-Content-Type-Options: nosniff`. Artifact download: `application/octet-stream`, filename sanitised to `[A-Za-z0-9._-]`. |
| Failure | 404 "No report is available for this execution" / "Report not found" / "Artifact not found"; 502 `artifact_unavailable` when Bob cannot serve the file. |
| UI transitions | See 3.3.9. |
| Security | Report Markdown is rendered with raw HTML skipped and links neutralised. Export includes redacted logs. |
| Mock behaviour | Report and 4 artifacts are served from `backend/demo-data/workspace/` (the recorded report, plus three QSE result JSON files under `qs_scan_result_run2/qs_explorer_result/`). The recorded analysis is fixed; whatever repository or prompt the user enters, the demo shows the same Java repository result. |
| Tests | `tests/unit/report.test.ts` (7 tests incl. PDF), `workflow.test.ts` (fallback and failure paths), `components.test.tsx` (Markdown, 2 tests) |
| Status | Implemented. **Not implemented:** dedicated "Cryptographic Findings", "Risk Categorization" or numeric risk tabs. The backend neither extracts findings from the QSE JSON/CBOM nor scores risk; those headings appear only if Bob's Markdown contains them. |

### 4.8 Execution history

| Item | Detail |
|---|---|
| Overview | Searchable, sortable, paginated list of all executions. |
| Inputs and validation | `executionListSchema`: `search` ≤ 200; `status` one of the six; `sort` `createdAt\|durationMs\|status\|repositoryName` (default `createdAt`); `direction` `asc\|desc`; `page` ≥ 1; `pageSize` 1–100 (default 10). |
| Processing | SQL `LIKE ... ESCAPE '\\'` search over execution id, repository name, repository URL and prompt (secondary order `created_at DESC`); `promptSummary` is the first 140 characters; `durationMs` computed from start/finish. |
| API | `GET /api/executions` → `{items, total, page, pageSize}` |
| Persistence | `executions` index `executions_created` |
| Success / failure | As 3.3.7. Unknown query values yield 400 `validation_error`. |
| Tests | `workflow.test.ts` (end-to-end ends with history), `pages.test.tsx` indirectly. No dedicated pagination/sort test (gap). |
| Status | Implemented. Deleting an execution is **Planned** (no delete API). |

### 4.9 Settings

| Item | Detail |
|---|---|
| Overview | Read-only effective server configuration plus account security and secret rotation. |
| API | `GET /api/settings` returns `version` ("1.0.0", hard-coded), `streamMode`, `executionStrategy`, `githubAllowedHosts`, `limits{maxPromptChars, executionTimeoutMs, maxConcurrentExecutions}`, `sharedMounts[{label, bobPath}]`, `encryptionKeyId`, `session{ttlMinutes, idleMinutes}`. Internal paths are not included. `POST /api/admin/rotate-secrets` (admin) re-encrypts the Bob key and every repository token with the first key in `SECRETS_KEYS`. |
| Rotation procedure | Add a new `kid:key` as the **first** entry of `SECRETS_KEYS`, restart the backend, run **Re-encrypt stored secrets**. Old keys remain in the list for decryption. |
| Failure | 403 for non-admin; rotation errors show a toast "Rotation failed". |
| Tests | `security.test.ts` ("rotates the encryption key for stored secrets"), `tests/unit/utils.test.ts` (SecretBox). |
| Status | Implemented. Settings are not editable from the UI (all come from environment variables). |


---

## 5. Architecture

### 5.1 Current implementation vs target production architecture

| Aspect | Current implementation (as built) | Target production architecture (**Planned**, not built) |
|---|---|---|
| Processes | One Node process (Express) + NGINX for static files and reverse proxy | Same, behind an ingress / load balancer |
| Persistence | Embedded SQLite file, single writer, WAL | Managed database (docs mention Postgres as a replacement for the `repositories/` layer only) |
| Scaling | Single node. Queue, SSE bus and rate-limit counters are in process memory | Shared queue and pub/sub; sticky or shared state |
| Identity | Local users, scrypt, one bootstrap admin | SSO/OIDC, user management, MFA |
| Headless Bob | External service, optional compose profile `bob` using an image not built here | Managed Bob service |
| Execution isolation | Workspace and QSE CLI shared by volume or by co-location (`EXECUTION_STRATEGY`) | Per-run ephemeral workspaces |
| Data lifecycle | No retention or deletion of executions, logs or reports | Retention policy and purge job |
| Observability | pino JSON logs, `x-request-id`, `/healthz`, `/readyz` | Metrics, tracing, alerting |
| Secrets | `SECRETS_KEYS` env var, AES-256-GCM key ring | KMS / vault |

Anything in the right column must not be assumed to exist.

### 5.2 Logical architecture

```mermaid
flowchart LR
  subgraph Browser
    SPA[React SPA<br/>Carbon g100]
  end
  subgraph WB[Workbench]
    NGINX[NGINX<br/>static + /api proxy]
    API[Express API<br/>routes, controllers]
    MW[Middleware<br/>helmet, CORS, rate limit,<br/>session, CSRF, RBAC]
    ORCH[Execution orchestrator<br/>queue, steps, cancel]
    SVC[Services<br/>bob, repository, qse,<br/>report, pdf, log, demo]
    REPO[Repositories layer]
    DB[(SQLite<br/>node:sqlite)]
    BUS[In-memory event bus<br/>SSE fan-out]
    FS[(Workspace root<br/>cloned repos)]
  end
  subgraph EXT[External]
    BOB[Headless Bob<br/>REST threads or ACP]
    GH[GitHub / allow-listed Git host]
    CLI[QSE CLI executable]
  end
  SPA -->|HTTPS, cookie + CSRF| NGINX --> API
  API --> MW --> SVC
  API --> ORCH
  ORCH --> SVC
  ORCH --> BUS
  SVC --> REPO --> DB
  SVC -->|git, shell-free| GH
  SVC --> FS
  SVC -->|shell-free exec, version check| CLI
  ORCH -->|SSRF-guarded HTTP| BOB
  BOB -. reads same paths .-> FS
  BOB -. runs .-> CLI
  BUS -->|SSE| SPA
```

In `STREAM_MODE=mock` the arrows to `BOB`, `GH` and `CLI` are never exercised. `demo.service` replays `backend/demo-data/recorded-run.json`.

### 5.3 Backend layering

| Layer | Directory | Responsibility |
|---|---|---|
| Bootstrap | `backend/src/server.ts`, `app.ts`, `app-context.ts` | Server (HTTP or HTTPS), probes, graceful shutdown, dependency wiring |
| Config | `backend/src/config/env.ts` | zod-validated environment; process exits on invalid config |
| Routes / controllers | `routes/index.ts`, `controllers/index.ts` | Route table, role and rate-limit wiring, request parsing |
| Middleware | `middleware/{auth,security,error-handler,context}.ts` | Sessions, CSRF, RBAC, headers, CORS, rate limits, error shape, request ids |
| Orchestrator | `orchestrators/{execution.orchestrator,prompt-builder,steps}.ts` | Pipeline, queue, cancel, replay (mock) |
| Services | `services/*.ts` | Domain logic |
| Integrations | `integrations/{headless-bob,github,qse-cli}/` | External protocol adapters |
| Repositories | `repositories/*.repository.ts` | SQL access |
| DB | `db/database.ts` | Connection, pragmas, migrations |
| Utils | `utils/*.ts` | `secret-box`, `passwords`, `redact`, `paths`, `safe-exec`, `ssrf`, `logger`, `errors` |

### 5.4 Execution strategies (`EXECUTION_STRATEGY`)

| Strategy | When to use | Path handling |
|---|---|---|
| `shared-volume` (default) | Workbench in a container, Bob in another | `PathMapper` translates backend paths to Bob paths using explicit mounts: `WORKSPACE_ROOT` ↔ `BOB_WORKSPACE_MOUNT_DIR` and `QSE_MOUNT_DIR` ↔ `BOB_QSE_MOUNT_DIR` |
| `colocated` | Workbench and Bob on the same host (the `deploy_local.sh` flow) | Identity mapping of the workspace and the allowed QSE directories |

`PathMapper` uses longest-prefix matching. A path outside every mount is "not reachable from Bob", which blocks execution (`qse_not_reachable`, `repo_not_reachable`).

### 5.5 Sequence diagrams

#### 5.5.1 Bob connect

```mermaid
sequenceDiagram
  actor U as User
  participant UI as BobConnectionPage
  participant API as POST /api/bob/connect
  participant S as BobService
  participant DB as SQLite
  participant B as Headless Bob
  U->>UI: address, key, Save
  UI->>API: JSON + X-CSRF-Token
  API->>S: save(input)
  S->>S: SSRF checks, base path, key format
  S->>DB: store row (api_key_enc, state=connecting)
  S->>B: GET /healthz (no auth)
  S->>B: GET {base}/capabilities (auth)
  alt 2xx
    S->>DB: state=connected + capabilities
  else 401/403
    S->>DB: state=auth_failed
  else 404 or network error
    S->>DB: state=connection_failed
  end
  S-->>UI: BobConnection (no key)
  UI->>UI: refetch status, toast
```

#### 5.5.2 Clone

```mermaid
sequenceDiagram
  actor U as User
  participant UI as RepositoryPage
  participant API as /api/repositories/clone
  participant R as RepositoryService
  participant G as git (shell-free)
  participant FS as WORKSPACE_ROOT
  U->>UI: URL, branch, token
  UI->>API: POST (202)
  API->>R: clone()
  R->>R: parse + allow-list URL, validate token
  R->>DB: insert status=cloning
  R-->>UI: Repository (cloning)
  par background
    R->>G: git clone --depth 1 ... into repo.new
    G->>FS: write files
    R->>FS: sanitise symlinks, count files, rename to repo
    R->>DB: status=cloned, commit, fileCount
  and polling
    UI->>API: GET /repositories every 1 s while cloning
  end
```

#### 5.5.3 QSE discovery and validation

```mermaid
sequenceDiagram
  actor U as User
  participant UI as QsePage
  participant Q as QseService
  participant D as discovery.ts
  participant V as validator.ts
  participant C as QSE CLI
  U->>UI: Run discovery
  UI->>Q: GET /qse/discover
  Q->>D: QSE_CLI_PATH, PATH, search dirs (no execution)
  D-->>UI: candidates {path, source, executable, allowed}
  U->>UI: Use selected and validate
  UI->>Q: POST /qse/configure {mode, path}
  Q->>V: validate(path, versionArgs)
  V->>C: run -v (no shell, own cwd, timeout)
  C-->>V: output + exit code
  V->>V: licence check, extractVersion
  Q->>DB: qse_config (valid or invalid)
  Q-->>UI: QseConfig + bobVisiblePath + reachableFromBob
```

#### 5.5.4 Prompt submit and Bob execution

```mermaid
sequenceDiagram
  actor U as User
  participant UI as WorkspacePage
  participant O as ExecutionOrchestrator
  participant B as Headless Bob
  participant DB as SQLite
  U->>UI: Start execution
  UI->>O: POST /api/executions {repositoryId, prompt}
  O->>O: preflight (bob, repo, qse, prompt length, no duplicate)
  O->>DB: insert execution + 9 steps (queued)
  O-->>UI: 202 Execution
  O->>O: queue slot
  O->>DB: running; step 1-4 (validate, prepare)
  O->>B: POST {base}/threads
  O->>B: POST {base}/threads/{id}/messages (idempotency-key)
  O->>B: GET {base}/runs/{id}/events (SSE) or poll
  loop until run ends
    B-->>O: events (text, status)
    O->>DB: execution_logs, step bob_processing
  end
  O->>B: GET {base}/threads/{id}/files?path= (walk, depth 3)
  O->>B: GET .../files/download?path=qse-e2e-report.md
  O->>DB: artifacts, step retrieve_results
  O->>DB: report (generate_report), status completed
```

#### 5.5.5 Real-time monitoring

```mermaid
sequenceDiagram
  participant UI as useExecutionStream
  participant N as NGINX
  participant A as stream controller
  participant L as ExecutionLogService bus
  UI->>N: GET /api/executions/:id/stream?after=N (cookie)
  N->>A: proxy, buffering off
  A-->>UI: event: execution (snapshot)
  A-->>UI: event: log (id: persisted logs > N)
  loop while connected
    L-->>A: log or state event
    A-->>UI: event: log / event: execution (debounced 150 ms)
    A-->>UI: ": heartbeat" every 15 s (+ re-flush)
  end
  Note over UI,A: on error the client closes and, if not terminal, reconnects after 2 s with the last log id
```

#### 5.5.6 Report retrieval and download

```mermaid
sequenceDiagram
  actor U as User
  participant UI as ReportViewPage
  participant API as Express
  participant R as ReportService
  participant P as PdfService
  UI->>API: GET /api/executions/:id/report
  API->>R: view(reportId)
  R-->>UI: Report {sections, markdown, execution, artifacts}
  U->>UI: PDF / Markdown / JSON
  UI->>API: GET /api/reports/:id/download?format=pdf (navigation)
  API->>R: view
  opt pdf
    API->>P: markdownToPdf(markdown)
  end
  API-->>U: attachment qse-report-<8>[-DEMO].pdf
  U->>UI: artifact Download
  UI->>API: GET /api/executions/:id/artifacts/:artifactId/download
  API->>Bob: GET files/download (realtime) or demo file (mock)
  API-->>U: application/octet-stream
```

#### 5.5.7 Cancellation

```mermaid
sequenceDiagram
  actor U as User
  participant UI as WorkspacePage
  participant O as Orchestrator
  participant B as Headless Bob
  U->>UI: Cancel execution
  UI->>O: POST /executions/:id/cancel (202)
  O->>DB: status=cancelling
  O->>B: POST {base}/runs/{id}/cancel
  alt Bob stops or grace elapses (30 s)
    O->>DB: status=cancelled, open step=cancelled
  end
  O-->>UI: stream snapshot (cancelled)
  Note over O: EXECUTION_TIMEOUT_MS expiry triggers the same path
```

---

## 6. API specification

Base URL: `/api` (the dev proxy and NGINX both forward it). All bodies are JSON unless noted. All `/api` responses carry `Cache-Control: no-store` and `x-request-id`. Every route except `POST /auth/login` needs the `qse_sid` cookie. Every non-GET/HEAD/OPTIONS request needs header `X-CSRF-Token` equal to the value returned by login or `/auth/me`, and an `Origin` that matches the service host or `CORS_ALLOWED_ORIGINS`.

### 6.1 Error envelope

```json
{ "error": { "code": "bob_not_connected", "message": "Headless Bob is not connected. Test the connection first.", "details": null, "requestId": "6f1c2c1e-…" } }
```

Produced by `middleware/error-handler.ts`:

| Source | HTTP | `code` | `message` | `details` |
|---|---|---|---|---|
| `ZodError` | 400 | `validation_error` | "Request validation failed" | `[{ "path": "...", "message": "..." }]` |
| `AppError` | its own status | its own code | its message, passed through `redact()` | its own details or null |
| Body-parser 4xx | 400 (or the parser's status) | `bad_request` | "Request body is too large", "Malformed JSON body" or "Bad request" | null |
| Anything else | 500 | `internal_error` | "An unexpected error occurred" | null |

Unknown routes: 404 `route_not_found`. Rate limiters: 429 `rate_limited` ("Too many requests. Please slow down and retry shortly."; login: "Too many sign-in attempts. Try again later."), with `RateLimit` draft-7 headers. Invalid path parameter: 400 `invalid_parameter`, message "Invalid <name>". CSRF mismatch: 403 `csrf_invalid`. Cross-origin write: 403 `forbidden`, "Cross-origin request rejected".

### 6.2 Application REST endpoints

Role column: `any` = authenticated viewer or above; `op` = operator or admin; `adm` = admin. "Heavy" = additionally rate limited to `max(10, floor(RATE_LIMIT_MAX/6))` per window.

| Method | Path | Role | Heavy | Success | Notes |
|---|---|---|---|---|---|
| POST | `/auth/login` | public | login limiter | 200 | Sets `qse_sid` cookie |
| POST | `/auth/logout` | any | no | 204 | Clears cookie, deletes session |
| GET | `/auth/me` | any | no | 200 | `{user, csrfToken}` |
| POST | `/auth/password` | any | no | 204 | Revokes all sessions of the user |
| GET | `/bob/status` | any | no | 200 | `BobConnection` |
| POST | `/bob/connect` | op | yes | 200 | Saves then tests |
| POST | `/bob/test-connection` | op | yes | 200 | |
| POST | `/bob/disconnect` | op | no | 200 | 409 `execution_active` |
| GET | `/repositories` | any | no | 200 | `{items}` |
| POST | `/repositories/validate` | op | yes | 200 | `RepoValidation` |
| POST | `/repositories/clone` | op | yes | 202 | `Repository` |
| GET | `/repositories/:id` | any | no | 200 | |
| POST | `/repositories/:id/reclone` | op | yes | 202 | |
| DELETE | `/repositories/:id` | op | no | 204 | |
| GET | `/qse/discover` | op | no | 200 | `{candidates, searched}` |
| POST | `/qse/configure` | op | yes | 200 | |
| POST | `/qse/validate` | op | yes | 200 | |
| GET | `/qse/status` | any | no | 200 | |
| POST | `/executions` | op | yes | 202 | `Execution` |
| GET | `/executions` | any | no | 200 | `Page<Execution>` |
| GET | `/executions/prompts` | any | no | 200 | `{items}` |
| GET | `/executions/:id` | any | no | 200 | |
| GET | `/executions/:id/stream` | any | no | 200 SSE | See 6.5 |
| POST | `/executions/:id/cancel` | op | no | 202 | |
| GET | `/executions/:id/logs?after=` | any | no | 200 | `{items}` |
| GET | `/executions/:id/report` | any | no | 200 | 404 when no report |
| GET | `/executions/:id/artifacts` | any | no | 200 | `{items}` |
| GET | `/executions/:id/artifacts/:artifactId/download` | any | no | 200 | Binary attachment |
| GET | `/reports/:id` | any | no | 200 | |
| GET | `/reports/:id/download?format=` | any | no | 200 | `markdown` (default), `pdf`, `json` |
| GET | `/reports/:id/export` | any | no | 200 | `{report, logs}` JSON attachment |
| GET | `/settings` | any | no | 200 | |
| POST | `/admin/rotate-secrets` | adm | no | 200 | |

Path-parameter rule: `:id` and `:artifactId` must match `^[A-Za-z0-9-]{1,64}$`, otherwise 400 `invalid_parameter`.

Non-`/api` endpoints served by the backend: `GET /healthz` → `{"status":"ok"}`; `GET /readyz` → 200/503 `{"status":"ready"|"not_ready","checks":{"database","workspace","accepting"}}`. NGINX forwards both and also serves `GET /nginx-health` itself.

### 6.3 JSON examples

**Login**

```http
POST /api/auth/login
{ "username": "admin", "password": "…" }
```
```json
{ "user": { "id": "2d0f…", "username": "admin", "role": "admin" }, "csrfToken": "b3c1…" }
```

**Bob connect (request)**

```json
{ "endpoint": "http://127.0.0.1:8000", "adapter": "rest-threads", "apiBasePath": "/api/v1", "authMode": "bearer", "authHeaderName": "authorization", "apiKey": "<service token>" }
```

**BobConnection (response)**

```json
{
  "state": "connected", "configured": true, "endpoint": "http://127.0.0.1:8000", "adapter": "rest-threads",
  "apiBasePath": "/api/v1", "authMode": "bearer", "authHeaderName": "authorization", "apiKeyHint": "••••abcd",
  "message": "Connected", "lastTestedAt": "2026-11-10T08:00:00.000Z", "mock": false,
  "capabilities": {
    "adapter": "rest-threads", "runtimeReady": true,
    "features": { "streaming": true, "cancellation": true, "fileDownloads": true, "threads": true, "continuation": true },
    "limits": { "timeoutMs": 300000, "maxMessageCharacters": 20000, "maxConcurrentRuns": 2, "maxDownloadBytes": 26214400 }
  }
}
```

**Repository clone (request / response)**

```json
{ "url": "https://github.com/owner/repo", "branch": "main", "token": "ghp_…optional" }
```
```json
{ "id": "7c1e…", "url": "https://github.com/owner/repo", "name": "repo", "owner": "owner", "branch": "main", "status": "cloning",
  "error": null, "hasToken": true, "commit": null, "fileCount": null, "lastClonedAt": null, "createdAt": "…",
  "workspaceLabel": null, "progress": [] }
```

**QSE configure (request) / QseConfig (response)**

```json
{ "mode": "auto", "path": "/usr/local/bin/qse-cli-artifacts/cli.sh" }
```
```json
{ "status": "valid", "mode": "auto", "executablePath": "/usr/local/bin/qse-cli-artifacts/cli.sh", "bobVisiblePath": "/usr/local/bin/qse-cli-artifacts/cli.sh",
  "reachableFromBob": true, "version": "App Version : 2.3.1.0 Build Version : 202605.00095", "validatedAt": "…", "message": null,
  "versionArgs": ["-v"], "strategy": "colocated" }
```

**Create execution (request) / Execution (response, abbreviated)**

```json
{ "repositoryId": "7c1e4f9a-…-uuid", "prompt": "Analyze this repository using QSE CLI …" }
```
```json
{
  "id": "c0d229f4-…", "status": "queued", "currentActivity": null, "prompt": "…", "promptSummary": "Analyze this repository using QSE CLI …",
  "repositoryId": "7c1e…", "repositoryUrl": "https://github.com/owner/repo", "repositoryName": "repo", "branch": "main", "commit": "bcc625a…",
  "qseVersion": "App Version : 2.3.1.0 …", "adapter": "rest-threads", "mock": false, "bobRunId": null, "bobThreadId": null,
  "createdAt": "…", "startedAt": null, "finishedAt": null, "durationMs": null, "error": null, "warnings": [],
  "steps": [ { "key": "validate_config", "label": "Validating configuration", "source": "backend", "status": "pending", "startedAt": null, "finishedAt": null, "message": null } ],
  "reportId": null, "usage": null, "bobStreamedChars": 0
}
```

**Execution list**: `GET /api/executions?search=aws&status=completed&sort=createdAt&direction=desc&page=1&pageSize=10`

```json
{ "items": [ { "id": "…", "status": "completed", "…": "…" } ], "total": 1, "page": 1, "pageSize": 10 }
```

**Report (abbreviated)**

```json
{ "id": "…", "executionId": "…", "source": "headless-bob-file", "sourceDetail": "qse-e2e-report.md", "mock": false, "generatedAt": "…",
  "sections": [ { "key": "summary", "title": "Executive Summary", "markdown": "…" }, { "key": "findings", "title": "Quantum-Safe Assessment", "markdown": "…" } ],
  "bobMarkdown": "…", "markdown": "# QSE End-to-End Execution Report\n…", "execution": { "…": "…" },
  "artifacts": [ { "id": "…", "executionId": "…", "path": "qse-e2e-report.md", "size": 4096, "retrieved": true, "contentType": "text/markdown", "note": null } ] }
```

**Settings**

```json
{ "version": "1.0.0", "streamMode": "realtime", "executionStrategy": "colocated", "githubAllowedHosts": ["github.com"],
  "limits": { "maxPromptChars": 8000, "executionTimeoutMs": 1800000, "maxConcurrentExecutions": 1 },
  "sharedMounts": [ { "label": "…", "bobPath": "/shared/workspaces" } ], "encryptionKeyId": "k1",
  "session": { "ttlMinutes": 480, "idleMinutes": 60 } }
```

**Rotate secrets**: response `{ "activeKeyId": "k2", "bobApiKeyReencrypted": true, "repositoryTokensReencrypted": 1 }`.

### 6.4 Headless Bob interfaces (outbound, adapter `rest-threads`)

All calls go through the SSRF-guarded undici client (`maxRedirections: 0`, JSON limit 4 MiB, SSE buffer limit 8 MiB). Auth: `bearer` → `Authorization: Bearer <key>`; `header` → `<authHeaderName>: <key>`; `none` → no header.

| Purpose | Request | Notes |
|---|---|---|
| Liveness | `GET /healthz` (origin root, no base path, no auth) | |
| Capabilities | `GET {base}/capabilities` | 401/403 → `auth_failed` |
| Create thread | `POST {base}/threads` body `{ "title": "…" }` | |
| Send prompt | `POST {base}/threads/{threadId}/messages` body `{ "content": "<built prompt>" }`, header `idempotency-key` | Returns a run id |
| Events | `GET {base}/runs/{runId}/events?after=<n>` (SSE) | Fallback: poll every 2000 ms; 10 consecutive failures tolerated |
| Run state | `GET {base}/runs/{runId}` | |
| Cancel | `POST {base}/runs/{runId}/cancel` | |
| List files | `GET {base}/threads/{threadId}/files?path=` | Walked to depth 3 |
| Download file | `GET {base}/threads/{threadId}/files/download?path=` | Limited by `MAX_ARTIFACT_BYTES` |

Adapter `acp` (ACP 0.2.0): `/ping`, `/agents` (needs agent `headlessbob`), `/readyz`, `POST /runs` (async), poll `/runs/{id}/events` and `/runs/{id}`, `POST /runs/{id}/cancel`. `supportsFiles=false`, so no artifacts or report file.

### 6.5 SSE contract (`GET /api/executions/:id/stream`)

Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

```text
event: execution
data: {"id":"…","status":"running","steps":[…],"…":"…"}

id: 42
event: log
data: {"id":42,"executionId":"…","ts":"2026-11-10T08:00:01.000Z","source":"headless-bob","level":"info","step":"bob_processing","message":"…"}

: heartbeat
```

- `execution` events contain the full `Execution` view; `log` events contain one `ExecutionLog` and an SSE `id:` equal to the log id.
- Resume cursor: `Last-Event-ID` header or `?after=<id>`.
- Heartbeat comment every 15 s.
- No `retry:` field is sent; the client implements its own 2 s reconnect.

### 6.6 GitHub interactions

Done with the `git` CLI only (no GitHub REST API, no GitHub App/OAuth):

| Operation | Command |
|---|---|
| Validate | `git ls-remote --exit-code --heads <url> <branch>` |
| Clone | `git clone --depth 1 --single-branch --no-tags --progress --branch <branch> <url> <dir>.new` |
| Auth | `GIT_CONFIG_COUNT/KEY_0/VALUE_0` = `http.extraHeader: Authorization: Basic base64("x-access-token:<token>")` |
| Hardening | `GIT_ALLOW_PROTOCOL=https`, `GIT_TERMINAL_PROMPT=0`, hooks path disabled, `credential.helper=` empty, remote `origin` removed after clone |

### 6.7 Internal interfaces

| Interface | File | Contract |
|---|---|---|
| `HeadlessBobAdapter` | `backend/src/integrations/headless-bob/types.ts` | `testConnection`, `createThread`, `sendMessage`, `streamEvents`, `getRun`, `cancel`, `listFiles`, `downloadFile`, `supportsFiles` |
| Adapter factory | `…/factory.ts` | Creates `rest-threads` or `acp` adapters; throws `demo_mode` unless `STREAM_MODE=realtime` |
| `PathMapper` | `backend/src/utils/paths.ts` | `toBob(path)`, `list()`; longest-prefix |
| `SecretBox` | `backend/src/utils/secret-box.ts` | `seal`, `open`, `activeKeyId`; envelope `{v, kid, iv, tag, ct}` with the kid as AAD |
| `ExecutionLogService` | `backend/src/services/execution-log.service.ts` | `append`, `list(id, after)`, `subscribe(id, fn)` |
| `runFile` | `backend/src/utils/safe-exec.ts` | `spawn` with `shell:false`, detached group, timeout then SIGKILL after 2 s, output cap 1 MiB, `minimalEnv()` |

---

## 7. Data model and persistence

Store: SQLite via `node:sqlite`. Default path `<DATA_DIR>/db/workbench.sqlite` in realtime and `<DATA_DIR>/db/workbench-demo.sqlite` in mock (separate files, so demo data never mixes with real data). Pragmas: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`. Migrations use `PRAGMA user_version`; there is **one** migration (creates everything below). Schema source: `backend/src/db/database.ts`.

```mermaid
erDiagram
  users ||--o{ sessions : has
  repositories ||--o{ executions : "referenced by repository_id (no FK)"
  executions ||--o{ execution_steps : has
  executions ||--o{ execution_logs : has
  executions ||--o| reports : produces
  executions ||--o{ artifacts : has
  users ||--o{ prompt_history : "user_id (no FK)"
  users {
    TEXT id PK
    TEXT username UK "NOCASE"
    TEXT password_hash
    TEXT role "admin|operator|viewer"
    TEXT created_at
  }
  sessions {
    TEXT id_hash PK "sha256 of cookie"
    TEXT user_id FK
    TEXT csrf_token
    TEXT created_at
    TEXT last_seen_at
    TEXT expires_at
  }
  bob_connection {
    INTEGER id PK "always 1"
    TEXT endpoint
    TEXT adapter
    TEXT api_base_path
    TEXT auth_mode
    TEXT auth_header_name
    TEXT api_key_enc
    TEXT api_key_hint
    TEXT state
    TEXT message
    TEXT last_tested_at
    TEXT capabilities "JSON"
  }
  qse_config {
    INTEGER id PK "always 1"
    TEXT mode
    TEXT executable_path
    TEXT version_args "JSON"
    TEXT status
    TEXT version
    TEXT message
    TEXT validated_at
  }
  repositories {
    TEXT id PK
    TEXT url
    TEXT owner
    TEXT name
    TEXT branch
    TEXT status
    TEXT error
    TEXT token_enc
    TEXT dir_name "repo-hex"
    TEXT commit_sha
    INTEGER file_count
    TEXT last_cloned_at
  }
  executions {
    TEXT id PK
    TEXT status
    TEXT current_activity
    TEXT prompt
    TEXT repository_id
    TEXT repository_url
    TEXT repository_name
    TEXT branch
    TEXT commit_sha
    TEXT qse_version
    TEXT qse_path
    TEXT adapter
    INTEGER mock
    TEXT bob_run_id
    TEXT bob_thread_id
    TEXT created_at
    TEXT started_at
    TEXT finished_at
    TEXT error
    TEXT warnings "JSON"
    TEXT usage "JSON"
    INTEGER bob_streamed_chars
    TEXT report_id
  }
  execution_steps {
    TEXT execution_id PK,FK
    TEXT key PK
    INTEGER position
    TEXT label
    TEXT source
    TEXT status
    TEXT started_at
    TEXT finished_at
    TEXT message
  }
  execution_logs {
    INTEGER id PK "autoincrement"
    TEXT execution_id FK
    TEXT ts
    TEXT source
    TEXT level
    TEXT step
    TEXT message
  }
  reports {
    TEXT id PK
    TEXT execution_id FK,UK
    TEXT source
    TEXT source_detail
    INTEGER mock
    TEXT bob_markdown
    TEXT markdown
    TEXT sections "JSON"
    TEXT generated_at
  }
  artifacts {
    TEXT id PK
    TEXT execution_id FK
    TEXT path "UNIQUE per execution"
    INTEGER size
    INTEGER retrieved
    TEXT content_type
    TEXT note
  }
  prompt_history {
    INTEGER id PK
    TEXT user_id
    TEXT prompt
    TEXT created_at
  }
```

Notes:

- `executions.repository_id` has no foreign key on purpose, so deleting a repository keeps history. The execution row carries denormalised repository fields.
- Foreign keys cascade from `executions` to steps, logs, reports and artifacts. Sessions cascade from users.
- Indexes: `executions_created (created_at DESC)`, `execution_logs_exec (execution_id, id)`.
- `prompt_history` is trimmed to the newest 200 rows on every insert; the prompts API returns at most 25 distinct prompts.
- Single-row tables (`bob_connection`, `qse_config`) are enforced by `CHECK (id = 1)`.
- File-system state: cloned repositories under `WORKSPACE_ROOT/repo-<hex>/repo`.
- Browser persistence: only `sessionStorage` keys `qse.activeRepo`, `qse.activeExec`, `qse.promptDraft`. No `localStorage`, no tokens.
- There is **no** cleanup of executions, logs, reports or workspaces except deleting a repository (which removes its work dir).

---

## 8. Security

### 8.1 Controls

| Area | Control | Source |
|---|---|---|
| Authentication | scrypt N=16384 r=8 p=1; dummy-hash verification for unknown users; uniform error text | `utils/passwords.ts`, `controllers/index.ts` |
| Sessions | Random id; only sha256 stored; cookie `qse_sid` httpOnly, SameSite=Strict, `Secure` per `COOKIE_SECURE` (forced when `NODE_ENV=production`); idle + absolute expiry; purge every 5 min | `middleware/auth.ts` |
| CSRF | Per-session token in `X-CSRF-Token` (timing-safe compare) plus `Origin` check on non-safe methods | `middleware/auth.ts` |
| RBAC | `viewer` < `operator` < `admin`; `requireRole` per route | `routes/index.ts` |
| Transport | Optional HTTPS in the Node server (`TLS_KEY_FILE`/`TLS_CERT_FILE`) or NGINX TLS override; HSTS 1 year | `server.ts`, `deployment/nginx/default.tls.conf.template` |
| Headers | helmet CSP `default-src 'none'`, CORP same-origin, Referrer-Policy no-referrer; NGINX CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; …`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` | `middleware/security.ts`, NGINX templates |
| Rate limiting | API (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`), login (15-min window, `LOGIN_RATE_LIMIT_MAX`), heavy routes `max(10, floor(max/6))`; in-memory counters | `middleware/security.ts` |
| Input | zod on every body/query; 64 kb JSON limit; NGINX `client_max_body_size 256k`; path params `^[A-Za-z0-9-]{1,64}$` | `models/schemas.ts`, `controllers/index.ts` |
| SSRF | Bob endpoint: http(s) only, no credentials/query/fragment; hostname allow-list (`BOB_ALLOWED_HOSTS`); DNS-time classification of resolved IPs; metadata/link-local/reserved always blocked; private/loopback only when `BOB_ALLOW_PRIVATE_NETWORK=true`; no redirects | `utils/ssrf.ts`, `integrations/headless-bob/http-client.ts` |
| Command execution | `spawn` with `shell:false`, argument arrays, minimal environment, timeouts, output cap, process-group kill | `utils/safe-exec.ts` |
| Repository handling | https-only URL allow-list, token via env-injected header, hooks disabled, escaping symlinks removed, file-count cap; repository content never executed; prompt marks it as untrusted data | `integrations/github/*`, `prompt-builder.ts` |
| Secrets at rest | AES-256-GCM key ring (`SECRETS_KEYS`), key id as AAD, rotation endpoint | `utils/secret-box.ts` |
| Secrets in logs | pino redact paths + regex redactor for GitHub tokens, Bearer/Basic, URL credentials, `authorization`, `api_key`/`token`/`secret`/`password`, plus registered live secrets | `utils/redact.ts`, `utils/logger.ts` |
| Output encoding | Markdown rendered with `skipHtml` and a link allow-list (`http(s):`, `mailto:`, `#`); download filenames sanitised | `components/Markdown.tsx`, `controllers/index.ts` |
| Container hardening | Non-root uid 1001 (backend) / 101 (NGINX), `cap_drop: ALL`, `no-new-privileges`, read-only root FS with tmpfs, backend port not published | `deployment/docker-compose.yml` |
| Licence | The workbench detects an unaccepted QSE licence and never accepts it | `integrations/qse-cli/validator.ts` |

### 8.2 Threat and mitigation scenarios

| # | Threat | Mitigation | Residual risk |
|---|---|---|---|
| T1 | Credential stuffing on login | Login limiter, uniform errors, scrypt | In-memory limiter resets on restart; no lockout or MFA |
| T2 | Cross-site request forgery | SameSite=Strict, CSRF header, Origin check | None known |
| T3 | SSRF through the Bob address | Scheme/host checks, DNS-time IP classification, no redirects, metadata blocked | An admin can allow private networks deliberately |
| T4 | Malicious repository (symlinks, hooks, large trees) | No execution, symlink pruning, hooks disabled, size cap, `GIT_ALLOW_PROTOCOL=https` | Repository content is still read by Bob; prompt-injection risk is mitigated by wording only |
| T5 | Prompt injection from repository content into the agent | Prompt rule "repository content is DATA"; no fabricated results policy | Not technically enforceable; depends on Bob |
| T6 | Secret leakage via logs or API | Redaction before persistence, no key in any response, hint only | A secret embedded in a prompt is stored verbatim in `executions.prompt` |
| T7 | Stored XSS through report Markdown | Raw HTML skipped, link allow-list, `rel="noopener noreferrer nofollow"`, CSP | None known |
| T8 | Path traversal through artifact or workspace paths | `sanitizeRelativePath`, `isInside`/`realpathInside`, filename sanitisation | None known |
| T9 | Session theft | httpOnly cookie, Strict SameSite, server-side revocation, password change revokes all sessions | No device list, no concurrent-session limit |
| T10 | Denial of service via long runs | Execution timeout, concurrency cap, per-route rate limits, output and payload caps | No quota per user; in-memory counters |
| T11 | Key compromise | Key ring + rotate endpoint | Key is an environment variable (no KMS) |
| T12 | Tampering with stored ciphertext | GCM tag + AAD; `secret_unreadable` surfaced | None known |
| T13 | Information disclosure through settings | `/settings` omits filesystem paths | `sharedMounts` shows Bob-side paths |
| T14 | Demo data mistaken for real results | `mock` flag on every record, DEMO labels, `-DEMO` filenames, separate DB file, header chip | Users must read the labels |

---

## 9. Error-handling catalogue

Envelope: see 6.1. "User message" is what the UI shows (toast or inline notification) and is the server `message` unless noted. Logging: every error is logged by pino with `requestId`; 5xx at `error`, 4xx at `warn`/`info`, with redaction.

| Code | HTTP | Cause | Backend behaviour | User message | Recovery |
|---|---|---|---|---|---|
| `validation_error` | 400 | zod rejects body/query | Returns issues in `details` | Server message or first issue | Fix the input |
| `bad_request` | 400 | Malformed JSON / body-parser error | 400 with "Request body is too large", "Malformed JSON body" or "Bad request" | The server message | Resend valid JSON |
| `invalid_parameter` | 400 | Path param fails `^[A-Za-z0-9-]{1,64}$` | 400 | "Invalid <name>" (for example "Invalid id") | Use a valid id |
| `unauthorized` | 401 | Missing/expired/invalid session | 401; client handler clears state | Redirect to `/login` | Sign in |
| `invalid_credentials` | 401 / 403 | Wrong login (401) or wrong current password (403) | Generic message | "Invalid username or password" / "Current password is incorrect" | Retry |
| `forbidden` | 403 | Role too low or cross-origin request | 403 | Server message | Use a permitted role |
| `csrf_invalid` | 403 | Missing/mismatched `X-CSRF-Token` | 403 | "CSRF token missing or invalid" | Reload to refresh the token |
| `not_found` | 404 | Unknown execution/repo/report/artifact | 404 | e.g. "Execution not found" | Navigate back |
| `route_not_found` | 404 | Unknown route | 404 | "No route for METHOD /path" | n/a |
| `conflict` | 409 | Duplicate active run, clone/reclone conflicts | 409 | Server text | Wait or cancel |
| `execution_active` | 409 | Disconnect during an active execution | 409 | "Cancel the active execution before disconnecting." | Cancel first |
| `bob_not_configured` | 409 | Test/use before save | 409 | "Headless Bob is not configured" | Save settings |
| `qse_not_configured` | 409 | Validate with no path | 409 | "QSE CLI is not configured" | Configure |
| `rate_limited` | 429 | Limiter hit | 429 with `RateLimit-*` headers | "Too many requests…" / "Too many sign-in attempts. Try again later." | Wait |
| `invalid_endpoint` | 400 | Bob URL malformed/credentials/query/scheme | 400 | See `utils/ssrf.ts` messages | Correct URL |
| `endpoint_not_allowed` | 400 | Blocked address or host not in allow-list | 400 | "Endpoint resolves to a blocked address range…" | Adjust `BOB_ALLOWED_HOSTS` / `BOB_ALLOW_PRIVATE_NETWORK` |
| `invalid_base_path` | 400 | Base path not like `/api/v1` | 400 | "API base path must look like /api/v1" | Correct it |
| `invalid_header_name` | 400 | Bad custom header | 400 | "Authentication header name is invalid" | Correct it |
| `invalid_api_key` | 400 | Key length/whitespace | 400 | "API key format is invalid" | Re-enter |
| `api_key_required` | 400 | No key for new/changed endpoint | 400 | "An API key is required (re-enter it when the endpoint changes)." | Enter key |
| `secret_unreadable` | 500 | Stored ciphertext cannot be opened (key ring changed) | 500 | "The stored API key cannot be decrypted with the configured SECRETS_KEYS. Re-enter the API key." | Re-enter key or restore key ring |
| `demo_mode` | 500 | Adapter/test requested in mock mode | 500 | "Headless Bob is never contacted when STREAM_MODE=mock." | Use realtime |
| `invalid_repository_url` | 400 | URL not https/owner/repo, has credentials/query/port | 400 | e.g. "Enter a repository URL such as https://github.com/owner/repo" | Fix URL |
| `repository_host_not_allowed` | 400 | Host not in `GITHUB_ALLOWED_HOSTS` | 400 | `Host "x" is not allowed. Allowed hosts: …` | Add host |
| `invalid_branch` | 400 | Branch regex failure | 400 | "Branch name contains invalid characters" | Fix branch |
| `invalid_token` | 400 | Token not 8–255 chars or has whitespace | 400 | "Access token format is invalid" | Re-enter |
| `branch_not_found` | 422 | `ls-remote` finds no such head | 422 | `Branch "x" was not found in the repository` | Fix branch |
| `repository_unreachable` | 422 | Auth/DNS/not-found from git | 422 with explained stderr | Explained, redacted text | Check URL/token |
| `git_timeout` | 504 | `ls-remote` or clone timed out (`CLONE_TIMEOUT_MS`) | 504 | "Timed out contacting the repository" / "Clone timed out" | Retry |
| `clone_failed` | 422 | Non-zero git exit or no repo root | Repo status `failed`, `error` set | "Clone failed" notification with reason | Re-clone |
| `clone_cancelled` | 499 | Clone cancelled | Repo `failed` | "Clone was cancelled" | Re-clone |
| `repository_too_large` | 422 | More than 250 000 files | Repo `failed` | "Repository has more than 250000 files" | Use a smaller repo |
| `git_unavailable` | 500 | `git` binary missing | 500 | "The git CLI is not available on the server" | Install git / set `GIT_BIN` |
| `workspace_invalid` | 500 | Workspace path fails validation | 500 | "Repository workspace failed path validation" | Re-clone |
| `invalid_qse_path` | 400 | Path empty or not absolute | 400 | "Provide the absolute path to the QSE CLI executable" / "The QSE CLI path must be absolute" | Fix |
| `invalid_version_args` | 400 | More than 4 args or unsafe chars | 400 | "Version arguments must be at most 4 simple flags such as -v" | Fix |
| `not_a_candidate` | 400 | Chosen path not found by discovery | 400 | "The selected path was not found by discovery. …" | Re-run discovery |
| `qse_not_found` | 404 | Discovery finds nothing | 404 | "No QSE CLI was found in QSE_CLI_PATH, PATH or the configured search directories." | Install or use manual |
| `path_required` | 400 | Manual mode without a path | 400 | "Provide the absolute path to the QSE CLI executable" | Enter path |
| `prompt_required` | 422 | Empty prompt | 422 | "Enter a prompt before starting an execution" | Enter text |
| `prompt_too_long` | 422 | Over `MAX_PROMPT_CHARS` | 422 | "Prompt exceeds N characters" | Shorten |
| `bob_not_connected` | 422 | Bob not `connected` at start or run time | 422 | "Headless Bob is not connected. Test the connection first." | Test connection |
| `repository_not_cloned` | 422 | Repo not `cloned` | 422 | "The repository has not been cloned successfully." | Clone |
| `qse_not_validated` | 422 | QSE not valid | 422 | "The QSE CLI is not configured and validated." | Validate |
| `qse_not_reachable` | 422 | CLI outside shared mounts | 422 | "The QSE CLI is not located in a directory shared with the Headless Bob container…" | Move under mount |
| `repo_not_reachable` | 422 | Workspace outside shared mounts | Step fails | "Repository workspace is not in a directory shared with Headless Bob." | Fix mounts |
| `qse_invalid` | 422 | Re-validation failed inside the run | Step `validate_qse` fails | "QSE CLI validation failed: …" | Fix CLI |
| `shutting_down` | 503 | Start during shutdown | 503 | "The service is shutting down" | Retry later |
| `cancelled` | 499 | Run cancelled | Execution `cancelled` | "Execution cancelled" | n/a |
| `artifact_unavailable` | 502 | Bob cannot serve the file | 502 | "Could not download artifact from Headless Bob: …" | Retry; check Bob |
| `internal_error` | 500 | Unhandled exception | Logged with stack (redacted); generic body | "An unexpected error occurred" | Report the `requestId` |
| `network_error` (client only) | 0 | `fetch` rejected | `ApiError(0, …)` | "Cannot reach the Workbench backend. Check your connection." | Check network |
| Execution-level failures | n/a | Bob run failed, run timeout, adapter error, interrupted by restart | Execution `failed`, `error` text, failed step; no report invented; restart gives "Interrupted by a Workbench restart" | "Execution failed" notification with the error | Fix cause, start again |

---

## 10. Deployment and infrastructure

### 10.1 Modes

| Mode | `STREAM_MODE` | Where it runs | Entry point | Purpose |
|---|---|---|---|---|
| Development | any | Host: `npm run dev` in `backend/` (tsx watch, port 8080) and `frontend/` (Vite, port 5173, `/api` proxy) | `README.md` "Local development" | Coding |
| Test | n/a | `vitest` in each package | `npm test` | Automated tests (see 11) |
| Local realtime | `realtime` | **Host process** (not containers) so Bob and the backend see the same filesystem; `EXECUTION_STRATEGY=colocated` | `scripts/deploy_local.sh` | Real end-to-end analysis next to a local Headless Bob and QSE CLI |
| Containerised demo | `mock` | Podman or Docker Compose: `frontend` (NGINX) + `backend` | `scripts/deploy_psh.sh`, `deployment/docker-compose.yml` | Demonstration with a recorded run |
| Production | `realtime` (set explicitly) | Compose with `docker-compose.tls.yml` (HTTPS on 8443) and `shared-volume`, optional `--profile bob` | `deployment/docker-compose.yml` + `docker-compose.tls.yml` | Containerised realtime; requires Bob to share the two volumes |

Note: the **default** `STREAM_MODE` is `mock` (both in `env.ts` and in `docker-compose.yml`). A fresh install shows the demo until the variable is changed. The README states real analysis is intended to run on the user's machine (Setup A) and containers are the demo only.

### 10.2 Deployment scripts (`scripts/`)

| Script | Mode | Behaviour |
|---|---|---|
| `scripts/deploy_local.sh` | `STREAM_MODE=realtime`, host processes | Prereq and port checks (OS, tools, Node ≥ 22.13, git, lsof, Java), creates/updates the root `.env` idempotently (backs it up, generates `SECRETS_KEYS` and `ADMIN_PASSWORD` if missing, sets `EXECUTION_STRATEGY=colocated`), installs dependencies, builds, starts backend (8080) and Vite UI (5173) with pidfiles in `.run/`, waits for `/readyz`, prints URLs. Has `--check` (prereqs only) and stop options. |
| `scripts/deploy_psh.sh` | `STREAM_MODE=mock`, containers | Checks podman/docker and compose, port 8080, writes `deployment/.env` (generated secrets, `STREAM_MODE=mock`), builds and starts compose, waits for health. Has `--check` and down options. |
| `scripts/lib/common.sh` | shared | `step/ok/note/warn/bad/die`, `have`, `version_ge`, `java_major`, `port_pids`, `stop_pid`, `wait_for_url`, `run_with_timeout`, `run_logged`, `json_get`, `gen_secrets_key`, `gen_password`, `env_get/env_set/env_ensure/env_default`, `check_os`, `check_tool`, `on_exit_hint` |

Both scripts pass `--check` on the author's macOS arm64 host (podman 6.0.0, Node 26.4.0).

### 10.3 Containers

| Service | Image / build | Ports | Volumes | Hardening | Health check |
|---|---|---|---|---|---|
| `frontend` | `frontend/Dockerfile` → `nginxinc/nginx-unprivileged:1.27-alpine`; `BACKEND_UPSTREAM=http://backend:8080` | `${HTTP_PORT:-8080}:8080` (TLS override adds `${HTTPS_PORT:-8443}:8443`) | tmpfs `/tmp`, `/etc/nginx/conf.d` | read-only, `cap_drop: ALL`, `no-new-privileges` | `wget --spider http://127.0.0.1:8080/nginx-health` |
| `backend` | `backend/Dockerfile` (`node:24-bookworm-slim` + `git`, `tini`, optional `JAVA_PACKAGE`) | `expose 8080` (not published) | `workbench-data:/data`, `workspaces:/data/workspaces`, `${QSE_CLI_HOST_DIR:-./qse-cli}:/opt/qse-cli:ro` | read-only, tmpfs `/tmp`, `stop_grace_period: 30s` | `fetch /readyz` |
| `headless-bob` (profile `bob`) | `${HEADLESS_BOB_IMAGE:-headlessbob:latest}` (not built here) | 8000 internal | `headless-bob-data:/data`, `workspaces:/shared/workspaces:${BOB_WORKSPACE_MOUNT_MODE:-ro}`, QSE dir at `/opt/qse-cli:${BOB_QSE_MOUNT_MODE:-ro}` | same hardening | `fetch /healthz` |

Network `qse-workbench-net`. Volumes: `qse-workbench-data`, `qse-workbench-workspaces` (fixed name so an external Bob can mount it), `qse-workbench-bob-data`. **There is no database or message-broker container**; the compose file defines no Postgres.

### 10.4 NGINX behaviour

| Location | Behaviour |
|---|---|
| `/nginx-health` | `200 ok` |
| `/healthz`, `/readyz` | Proxied to the backend |
| `~ ^/api/executions/[^/]+/stream$` | Proxy, HTTP/1.1, `proxy_buffering off`, `gzip off`, read/send timeout 3600 s, `X-Accel-Buffering: no` |
| `/api/` | Proxy, read timeout 120 s |
| `/assets/` | `expires 1y`, `immutable` |
| `/` | SPA fallback to `/index.html`, `Cache-Control: no-store`, CSP and security headers |
| TLS variant | `:8080` returns 308 to `https://${PUBLIC_HOST}:${PUBLIC_HTTPS_PORT}`; `:8443` terminates TLS 1.2/1.3 with `/etc/nginx/certs/tls.{crt,key}` and adds HSTS |

### 10.5 Environment variables

Source of truth: `backend/src/config/env.ts` plus `.env.example` and `deployment/docker-compose.yml`. "Sensitive" = must never be logged or committed.

#### Backend runtime

| Variable | Purpose | Required | Default | Sensitive |
|---|---|---|---|---|
| `NODE_ENV` | Mode; `production` forces secure cookies | No | `development` | No |
| `HOST` | Bind address | No | `0.0.0.0` | No |
| `PORT` | Listen port | No | `8080` | No |
| `LOG_LEVEL` | pino level | No | `info` | No |
| `DATA_DIR` | Data root | No | `./data` | No |
| `WORKSPACE_ROOT` | Where repositories are cloned | No | derived from `DATA_DIR` (`workspaces`) | No |
| `DATABASE_PATH` | SQLite file | No | `<DATA_DIR>/db/workbench.sqlite` (realtime) or `workbench-demo.sqlite` (mock) | No |
| `STREAM_MODE` | `mock` or `realtime` | No | `mock` | No |
| `DEMO_DATA_DIR` | Location of `recorded-run.json` and the demo workspace | No | `demo-data` in the backend | No |
| `DEMO_STEP_DELAY_MS` | Replay pacing per step | No | `700` | No |
| `DEMO_BOB_WAIT_MS` | Replay duration for the Bob phase | No | `6000` | No |
| `DEMO_REPLAY_SPEED` | Event replay speed multiplier | No | `4` | No |
| `SECRETS_KEYS` | AES-256-GCM key ring `kid:base64(32 bytes)[,…]` | **Yes** | none | **Yes** |
| `ADMIN_USERNAME` | Bootstrap admin | No | `admin` | No |
| `ADMIN_PASSWORD` | Bootstrap admin password, at least 12 characters | **Yes** | none | **Yes** |
| `SESSION_TTL_MINUTES` | Absolute session lifetime | No | `480` | No |
| `SESSION_IDLE_MINUTES` | Idle timeout | No | `60` | No |
| `COOKIE_SECURE` | `Secure` cookie flag | No | `false` (forced `true` in production) | No |
| `TRUST_PROXY` | Reverse-proxy hop count | No | `1` | No |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins | No | empty | No |
| `TLS_KEY_FILE` / `TLS_CERT_FILE` | Serve HTTPS from Node (both needed) | No | unset | Path only |
| `BOB_ALLOWED_HOSTS` | Host allow-list for Bob | No | empty (any that pass SSRF checks) | No |
| `BOB_ALLOW_PRIVATE_NETWORK` | Permit private/loopback targets | No | `false` (compose default `true`) | No |
| `BOB_REQUEST_TIMEOUT_MS` | Bob HTTP timeout | No | `15000` | No |
| `GITHUB_ALLOWED_HOSTS` | Allowed Git hosts | No | `github.com` | No |
| `GIT_BIN` | git executable | No | `git` | No |
| `CLONE_TIMEOUT_MS` | Clone/ls-remote timeout | No | `600000` | No |
| `QSE_CLI_PATH` | Explicit CLI path for discovery | No | empty | No |
| `QSE_CLI_SEARCH_DIRS` | Discovery directories | No | `/opt/qse-cli,/usr/local/bin/qse-cli-artifacts` | No |
| `QSE_CLI_ALLOWED_DIRS` | Directories a CLI may live in | No | `/opt,/usr/local/bin,/usr/bin` | No |
| `QSE_CLI_EXECUTABLE_NAMES` | Allowed basenames | No | `qse-cli,cli.sh` | No |
| `QSE_CLI_VERSION_ARGS` | Version command arguments | No | `-v` | No |
| `QSE_VALIDATION_TIMEOUT_MS` | Version command timeout | No | `30000` | No |
| `QSE_USAGE_HINT` | Extra hint text in validation messages | No | unset | No |
| `EXECUTION_STRATEGY` | `shared-volume` or `colocated` | No | `shared-volume` | No |
| `QSE_MOUNT_DIR` | CLI mount inside the backend | No | `/opt/qse-cli` | No |
| `BOB_QSE_MOUNT_DIR` | CLI mount inside Bob | No | `/opt/qse-cli` | No |
| `BOB_WORKSPACE_MOUNT_DIR` | Workspace mount inside Bob | No | `/shared/workspaces` | No |
| `EXECUTION_TIMEOUT_MS` | Per-run timeout | No | `1800000` | No |
| `MAX_CONCURRENT_EXECUTIONS` | Parallel runs (max 16) | No | `1` | No |
| `MAX_PROMPT_CHARS` | Prompt cap (max 15000) | No | `8000` | No |
| `MAX_ARTIFACT_BYTES` | Max size per artifact | No | `26214400` (25 MiB) | No |
| `MAX_ARTIFACTS` | Max artifacts per run | No | `200` | No |
| `RATE_LIMIT_WINDOW_MS` | API limiter window | No | `60000` | No |
| `RATE_LIMIT_MAX` | API requests per window | No | `300` | No |
| `LOGIN_RATE_LIMIT_MAX` | Login attempts per 15 min | No | `10` | No |

#### Compose / script-only variables

| Variable | Purpose | Required | Default | Sensitive |
|---|---|---|---|---|
| `HTTP_PORT` | Published NGINX HTTP port | No | `8080` | No |
| `HTTPS_PORT` | Published NGINX HTTPS port (TLS override) | No | `8443` | No |
| `PUBLIC_HOST` | Host in the HTTP→HTTPS redirect | No | `localhost` | No |
| `BACKEND_UPSTREAM` | NGINX upstream | No | `http://backend:8080` | No |
| `QSE_CLI_HOST_DIR` | Host directory bind-mounted at `/opt/qse-cli` | No | `./qse-cli` | No |
| `BACKEND_JAVA_PACKAGE` | Build arg `JAVA_PACKAGE` for the backend image | No | empty | No |
| `HEADLESS_BOB_IMAGE` | Image for the `bob` profile | No | `headlessbob:latest` | No |
| `BOB_API_KEY` | Bob Shell key inside the Bob container | No | empty | **Yes** |
| `AUTH_TOKENS` | Service tokens Bob accepts (JSON) | No | empty | **Yes** |
| `BOB_RUN_TIMEOUT_MS` | Bob's own run timeout | No | `1800000` | No |
| `BOB_WORKSPACE_MOUNT_MODE` / `BOB_QSE_MOUNT_MODE` | `ro` or `rw` mounts inside Bob | No | `ro` | No |
| `VITE_API_PROXY` | Dev proxy target for the Vite server | No | `http://127.0.0.1:8080` | No |

The Bob address and API key are **not** environment variables: they are entered in the UI and stored encrypted.


---

## 11. Testing specification

### 11.1 Current test inventory (as run)

Last full run: backend **7 files, 110 tests passed**; frontend **6 files, 36 tests passed**. Counts for `it.each` suites are expanded, so they exceed the number of `it(` lines.

| Layer | Suite | Tests | Covers |
|---|---|---|---|
| Backend integration | `backend/tests/integration/security.test.ts` | 30 | Auth and CSRF, role enforcement, secure headers, rate limit, probes; Bob connection (11 tests: SSRF, allow-list, key rotation, removed mock adapter); GitHub (5); QSE (6) |
| Backend integration | `backend/tests/integration/workflow.test.ts` | 6 | connect → clone → validate → execute → report → history; fallback to final answer; Bob failure; cancel; start preconditions; symlink-escape clone |
| Backend integration | `backend/tests/integration/demo.test.ts` | 10 | Mock replay, default mock, validation still applies, setup required, cancel mid-replay, missing recording fails fast, realtime never serves demo data (4) |
| Backend unit | `backend/tests/unit/utils.test.ts` | 15 | Bob event helpers, SSRF classification, paths, redaction, SecretBox, passwords, safe-exec, config validation (requires secrets, defaults `STREAM_MODE=mock`, separate DB files, secure cookies in production) |
| Backend unit | `backend/tests/unit/report.test.ts` | 7 | Report section parsing, PDF, prompt builder |
| Backend unit | `backend/tests/unit/qse-validator.test.ts` | 6 | `extractVersion`, `validateQseCli` licence handling |
| Backend unit | `backend/tests/unit/github.test.ts` | 3 | GitHub URL and branch parsing |
| Frontend page | `frontend/src/pages/pages.test.tsx` | 10 | Login, Overview, Bob, Repository, Qse, Workspace, History, Reports, Settings rendering and actions |
| Frontend component | `frontend/src/components/PipelineTwin.test.tsx` | 5 | Digital twin nodes, edges, status mapping |
| Frontend component | `frontend/src/components/components.test.tsx` | 3 declared (expanded by `it.each` over `StatusTag`) | `StatusTag`, `LogViewer`, `Markdown` |
| Frontend unit | `frontend/src/services/api.test.ts` | 5 | CSRF header, error mapping, 401 handler |
| Frontend unit | `frontend/src/stores/stores.test.ts` | 4 | session, workspace, notifications stores |
| Frontend unit | `frontend/src/services/format.test.ts` | 4 | Formatting helpers |

### 11.2 Test infrastructure

| Item | Detail |
|---|---|
| Backend runner | Vitest, `environment: node`, include `tests/**/*.test.ts`, timeouts 30 s, `pool: forks` (`backend/vitest.config.ts`) |
| HTTP testing | `supertest` `^7.3.2` against the Express app built by `backend/tests/helpers/harness.ts` |
| Bob test double | `backend/tests/helpers/fake-bob.ts`: an in-process server that implements the Headless Bob REST-threads contract. It is a **contract double, not a product mock mode**; the production code contains no mock adapter (asserted by a security test) |
| Frontend runner | Vitest through `frontend/vite.config.ts` (jsdom, globals, `css: false`) |
| Frontend setup | `frontend/src/test/setup.ts` (jest-dom matchers; `matchMedia`, `ResizeObserver`, `scrollIntoView` shims); `frontend/src/test/utils.tsx` (render with providers) |
| Test data | Backend tests create temporary data directories; mock tests use `backend/demo-data/recorded-run.json` |

### 11.3 Commands and quality gate

```bash
cd backend  && npm run typecheck && npm test && npm run build && npm audit --omit=dev
cd frontend && npm run typecheck && npm test && npm run build && npm audit --omit=dev
./scripts/deploy_local.sh --check   # prerequisite and config check, realtime
./scripts/deploy_psh.sh   --check   # prerequisite and config check, mock
```

A change is acceptable only when all commands exit 0.

### 11.4 Testing mock versus realtime

| Aspect | `STREAM_MODE=mock` | `STREAM_MODE=realtime` |
|---|---|---|
| Needs Headless Bob, GitHub, QSE CLI | No | Yes |
| Database file | Separate demo file | Real file |
| Expected evidence | Records carry `mock=true`; filenames contain `-DEMO`; UI shows DEMO chip | `mock=false`; report source is `headless-bob-file` or `headless-bob-output` |
| Automated coverage | `demo.test.ts` | `workflow.test.ts` with `fake-bob` |
| Real end-to-end | Not applicable | **Manual only**: the live chain with real Bob and QSE has been run end-to-end once (README, "Honest limitations") |

### 11.5 Acceptance criteria

| ID | Requirement | Acceptance criterion (Given/When/Then) | Verified by |
|---|---|---|---|
| AC-01 | FR-01 | Given no session cookie, when any `/api` route except login is called, then the response is 401 `unauthorized` | `security.test.ts` |
| AC-02 | FR-01 | Given a valid session, when a POST is sent without `X-CSRF-Token`, then 403 `csrf_invalid` | `security.test.ts` |
| AC-03 | FR-02 | Given a saved Bob key, when `GET /api/bob/status` is called, then the body contains only `apiKeyHint` (a masked hint) and no key material | `security.test.ts` |
| AC-04 | FR-03 | Given Bob not connected, when `POST /api/executions` is called, then 4xx with a precondition code and no execution is created | `workflow.test.ts` (start preconditions) |
| AC-05 | FR-03 | Given a valid chain, when an execution is started, then it finishes `completed` with a `reportId` | `workflow.test.ts` |
| AC-06 | FR-04 | Given `MAX_CONCURRENT_EXECUTIONS` active runs, when another is started, then it is `queued` | **Not covered** (see 11.6) |
| AC-07 | FR-05 | Given a running execution, when the stream is read with `Last-Event-ID`, then only newer events are delivered | **Not covered** (no SSE protocol test) |
| AC-08 | FR-06 | Given a finished execution, when `GET /api/executions/:id` and `/logs` are called, then steps and logs are returned | `workflow.test.ts` |
| AC-09 | FR-07 | Given Bob wrote no report file, when the run ends, then the report uses the final answer and `source=headless-bob-output` | `workflow.test.ts` (fallback) |
| AC-10 | FR-08 | Given `STREAM_MODE=mock`, when a run completes, then all rows have `mock=true` and exports are labelled DEMO | `demo.test.ts` |
| AC-11 | FR-08 | Given `STREAM_MODE=realtime`, when a run is started without Bob, then it fails and never serves demo data | `demo.test.ts` |
| AC-12 | FR-09 | Given a running execution, when cancel is called, then the final status is `cancelled` | `workflow.test.ts`, `demo.test.ts` |
| AC-13 | FR-11 | Given an admin, when `POST /api/admin/rotate-secrets` is called, then stored secrets are re-encrypted with the active key and still decrypt | `security.test.ts` (key rotation) |
| AC-14 | FR-12 | Given step events, when the Workspace renders, then twin nodes reflect only those statuses | `PipelineTwin.test.tsx` |
| AC-15 | NFR-02 | Given an endpoint on a blocked address class, when Bob connect is called, then it is refused | `security.test.ts`, `utils.test.ts` |
| AC-16 | NFR-03 | Given a repository containing a symlink that escapes the workspace, when cloned, then it is rejected | `workflow.test.ts` |
| AC-17 | NFR-05 | Given missing `SESSION_SECRET` or `ENCRYPTION_KEY`, when the config loads, then startup fails | `utils.test.ts` |
| AC-18 | FR-10 | Given executions marked running at shutdown, when the service starts, then they are `failed` | **Not covered** by a dedicated test |

### 11.6 Test gaps

| Gap | Impact | Priority |
|---|---|---|
| No browser E2E tests | UI regressions across routing and SSE are caught only manually | High |
| No SSE protocol test (resume, heartbeat, terminal event) | AC-07 unverified | High |
| No test for queueing beyond `MAX_CONCURRENT_EXECUTIONS` | AC-06 unverified | Medium |
| No restart-recovery test | AC-18 unverified | Medium |
| No pagination or sort test for `/executions` | Query bugs undetected | Low |
| No accessibility test (axe) | Keyboard and contrast regressions undetected | Medium |
| No coverage tooling | Coverage unknown | Low |
| Real Headless Bob and QSE are never exercised in CI | Contract drift undetected | High (needs an environment) |

---

## 12. Non-functional and production readiness

No performance benchmark has been measured for this application, so none is stated here.

### 12.1 Readiness checklist

| Area | Item | Status | Evidence |
|---|---|---|---|
| Observability | Structured JSON logs with redaction (pino) | Implemented | `backend/src/utils/logger.ts`, `backend/src/utils/redact.ts` |
| Observability | Request id on every response (`x-request-id`) and in the error envelope | Implemented | `backend/src/middleware/context.ts` |
| Observability | Liveness `/healthz` and readiness `/readyz` (database, workspace, accepting) | Implemented | `backend/src/app.ts` |
| Observability | Metrics endpoint, tracing, alerting | **Planned** | not in code |
| Reliability | Graceful shutdown on SIGTERM/SIGINT, hard stop after 25 s, new executions refused with 503 `shutting_down` | Implemented | `backend/src/server.ts` |
| Reliability | Active executions marked failed after restart | Implemented | `backend/src/orchestrators/execution.orchestrator.ts` |
| Reliability | Queued executions restored after restart | **Not implemented** | in-memory queue |
| Reliability | Retry of Bob calls | Partial | Idempotency key on run start (`backend/src/integrations/headless-bob/rest-threads.adapter.ts`); event polling tolerates 10 consecutive failures; no general retry |
| Scalability | Horizontal scaling | **Not supported** | SQLite, in-memory SSE bus, queue and rate limiter (NFR-07) |
| Security | Secure headers, CSRF, Origin check, rate limits, SSRF guard, shell-free exec | Implemented | section 8 |
| Security | TLS | Partial: optional override `deployment/docker-compose.tls.yml`; certificates are supplied by the operator |
| Security | SSO, MFA, user management, audit log | **Planned** | not in code |
| Container hardening | Non-root uid 1001 (backend) / 101 (NGINX), `cap_drop: ALL`, `no-new-privileges`, read-only root FS with tmpfs | Implemented: `deployment/docker-compose.yml` (see section 8) |
| Data | Backup | Manual: copy the SQLite file(s) and the workspace volume while the service is stopped or using SQLite backup tooling; no automated backup |
| Data | Retention and cleanup of executions, logs, reports, workspaces | **Not implemented** (no delete API) |
| Data | Schema migrations | Partial: schema is created by `backend/src/db/database.ts` on start; no versioned migration framework |
| Upgrade | Rebuild images and restart; the `--check` scripts validate configuration first | Implemented |
| Quality | Typecheck, unit and integration tests, `npm audit --omit=dev` | Implemented |
| Quality | E2E, accessibility, load tests | **Not implemented** |

### 12.2 Operating limits (configurable, from section 10.5)

| Limit | Variable | Default |
|---|---|---|
| Concurrent executions | `MAX_CONCURRENT_EXECUTIONS` | 1 (max 16) |
| Execution timeout | `EXECUTION_TIMEOUT_MS` | 1800000 |
| Prompt size | `MAX_PROMPT_CHARS` | 8000 (max 15000) |
| Request rate | `RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX` | 300 per window; 10 per 15 min |
| Session lifetime | `SESSION_IDLE_MINUTES`, `SESSION_TTL_MINUTES` | 60 idle; 480 absolute |
| Bob run wait | Headless Bob's own run timeout (`RUN_TIMEOUT_MS` in Bob; README states a 5 minute default there; the compose `bob` profile sets `BOB_RUN_TIMEOUT_MS` to 1800000) | Raise it on the Bob side for large scans |

### 12.3 Production go/no-go blockers

1. Set `STREAM_MODE=realtime` explicitly; the default is `mock`.
2. Provide `SESSION_SECRET`, `ENCRYPTION_KEY` and a strong `ADMIN_PASSWORD`; serve over TLS so cookies are `Secure`.
3. Accept the single-node constraint and plan manual backups.
4. Accept that there is no retention policy and that the real analysis requires a reachable Headless Bob and QSE CLI.

---

## 13. Traceability matrix

Paths are relative to `qse-automation-workbench/`. "DB" lists tables from `backend/src/db/database.ts`.

| Feature | Frontend file | Backend file | API | DB | Status |
|---|---|---|---|---|---|
| Authentication (supporting) | `frontend/src/pages/LoginPage.tsx`, `frontend/src/components/RequireAuth.tsx`, `frontend/src/stores/session.ts` | `backend/src/middleware/auth.ts`, `backend/src/repositories/auth.repository.ts`, `backend/src/utils/passwords.ts` | `/api/auth/*` | `users`, `sessions` | Implemented |
| Bob connection | `frontend/src/pages/BobConnectionPage.tsx` | `backend/src/services/bob.service.ts`, `backend/src/repositories/bob-connection.repository.ts`, `backend/src/integrations/headless-bob/*`, `backend/src/utils/ssrf.ts`, `backend/src/utils/secret-box.ts` | `/api/bob/status`, `/connect`, `/test-connection`, `/disconnect` | `bob_connection` | Implemented (REST threads); Partial (ACP adapter has no file API) |
| GitHub repository management | `frontend/src/pages/RepositoryPage.tsx` | `backend/src/services/repository.service.ts`, `backend/src/repositories/git-repository.repository.ts`, `backend/src/integrations/github/git-client.ts`, `backend/src/integrations/github/url.ts`, `backend/src/utils/safe-exec.ts`, `backend/src/utils/paths.ts` | `/api/repositories*` | `repositories` | Implemented; Mocked clone in mock mode |
| QSE CLI discovery and validation | `frontend/src/pages/QsePage.tsx` | `backend/src/services/qse.service.ts`, `backend/src/repositories/qse-config.repository.ts`, `backend/src/integrations/qse-cli/discovery.ts`, `backend/src/integrations/qse-cli/validator.ts` | `/api/qse/discover`, `/configure`, `/validate` | `qse_config` | Implemented; `versionArgs` not editable in UI (Partial) |
| Prompt management | `frontend/src/pages/WorkspacePage.tsx` | `backend/src/orchestrators/prompt-builder.ts`, `backend/src/controllers/index.ts` | `/api/executions/prompts`, `POST /api/executions` | `prompt_history` | Partial: templates hard-coded, limit mismatch |
| Execution orchestration | `frontend/src/pages/WorkspacePage.tsx`, `frontend/src/stores/workspace.ts` | `backend/src/orchestrators/execution.orchestrator.ts`, `backend/src/orchestrators/steps.ts`, `backend/src/repositories/execution.repository.ts`, `backend/src/services/demo.service.ts` | `POST /api/executions`, `GET /api/executions/:id`, `POST /api/executions/:id/cancel` | `executions`, `execution_steps` | Implemented; Mocked in mock mode |
| Real-time monitoring | `frontend/src/hooks/useExecutionStream.ts`, `frontend/src/components/LogViewer.tsx`, `frontend/src/components/StatusTag.tsx`, `frontend/src/hooks/useElapsed.ts` | `backend/src/services/execution-log.service.ts`, `backend/src/integrations/headless-bob/events.ts` | `GET /api/executions/:id/stream`, `/logs` | `execution_logs` | Implemented; no QSE-level progress |
| Pipeline digital twin | `frontend/src/components/PipelineTwin.tsx`, `frontend/src/components/PipelineTwin.test.tsx`, `frontend/src/styles/index.scss` | `backend/src/orchestrators/steps.ts` (step definitions) | uses existing execution and Bob status APIs | none | Implemented; Partial (placeholder has 8 steps, backend 9) |
| Report generation | `frontend/src/pages/ReportsPage.tsx`, `frontend/src/pages/ReportViewPage.tsx`, `frontend/src/components/Markdown.tsx` | `backend/src/services/report.service.ts`, `backend/src/services/pdf.service.ts` | `/api/reports/:id`, `/download`, `/export`, `/api/executions/:id/report`, `/artifacts` | `reports`, `artifacts` | Implemented; fixed tabs, no CBOM parsing (Partial) |
| Execution history | `frontend/src/pages/HistoryPage.tsx`, `frontend/src/pages/OverviewPage.tsx` | `backend/src/repositories/execution.repository.ts`, `backend/src/controllers/index.ts` | `GET /api/executions` | `executions` | Implemented; no delete or retention |
| Settings | `frontend/src/pages/SettingsPage.tsx` | `backend/src/controllers/index.ts`, `backend/src/config/env.ts`, `backend/src/services/bob.service.ts` (rotation) | `GET /api/settings`, `POST /api/admin/rotate-secrets`, `POST /api/auth/password` | `users`, `sessions` | Implemented; version string hard-coded |
| App shell and notifications | `frontend/src/layouts/AppShell.tsx`, `frontend/src/components/Toasts.tsx`, `frontend/src/stores/notifications.ts`, `frontend/src/hooks/useNotify.ts` | none | none | none | Implemented |
| Cross-cutting backend | `frontend/src/services/api.ts`, `frontend/src/hooks/queries.ts`, `frontend/src/types/api.ts` | `backend/src/app.ts`, `backend/src/app-context.ts`, `backend/src/server.ts`, `backend/src/routes/index.ts`, `backend/src/middleware/security.ts`, `backend/src/middleware/error-handler.ts`, `backend/src/models/schemas.ts`, `backend/src/models/types.ts`, `backend/src/db/database.ts` | all | all | Implemented |
| Deployment | n/a | `scripts/deploy_local.sh`, `scripts/deploy_psh.sh`, `scripts/lib/common.sh`, `deployment/docker-compose.yml`, `deployment/nginx/default.conf.template` | n/a | n/a | Implemented |

---

## 14. Implementation gap analysis

Classification: **Defect** (behaves wrongly), **Inconsistency**, **Missing** (not built), **Test gap**, **Operational**. Priority: P1 fix before production, P2 soon, P3 backlog.

| # | Gap | Classification | Impact | Dependencies | Priority | Files |
|---|---|---|---|---|---|---|
| G1 | Prompt limit differs by layer: zod 1–20000, orchestrator `MAX_PROMPT_CHARS` (8000, max 15000), Workspace textarea falls back to 20000 before settings load | Inconsistency | User sees a late `prompt_too_long` 422 | none | P2 | `backend/src/models/schemas.ts`, `backend/src/orchestrators/execution.orchestrator.ts`, `backend/src/config/env.ts`, `frontend/src/pages/WorkspacePage.tsx` |
| G2 | Twin placeholder `DEFAULT_STEPS` has 8 steps; backend defines 9 (`completed`); `SHORT` has no label for `completed` | Inconsistency | Cosmetic mismatch before first data | none | P3 | `frontend/src/components/PipelineTwin.tsx`, `backend/src/orchestrators/steps.ts` |
| G3 | `--cds-*` CSS variables are undefined because `.cds--g100` is never applied; `.card`, `.stat`, success icon fills rely on them. The twin avoids it with `--twin-*` | Defect (styling) | Some elements fall back to default colours | Carbon theme wiring | P2 | `frontend/src/styles/index.scss`, `frontend/src/main.tsx` |
| G4 | No `ErrorBoundary` | Missing | A render error blanks the page (the earlier twin blank-render bug is an example) | none | P2 | `frontend/src/App.tsx` |
| G5 | UI does not hide actions by role; it relies on server 403 | Missing | Viewer sees buttons that fail | session store has `role` | P3 | all `frontend/src/pages/*Page.tsx` |
| G6 | No user-management API or UI; only the bootstrap admin | Missing | Single shared admin | schema, routes, Settings UI | P2 | `backend/src/routes/index.ts`, `backend/src/repositories/auth.repository.ts`, `frontend/src/pages/SettingsPage.tsx` |
| G7 | No retention or cleanup of executions, logs, reports, workspaces; no delete-execution API | Missing | Unbounded disk growth | G6 for authorisation policy | P1 | `backend/src/repositories/execution.repository.ts`, `backend/src/services/repository.service.ts` |
| G8 | SQLite single node; in-memory queue, SSE bus and rate limits; queued executions are failed after restart | Operational | No HA or scale-out | external DB, queue, shared limiter | P2 (target architecture) | `backend/src/db/database.ts`, `backend/src/orchestrators/execution.orchestrator.ts` |
| G9 | Reports page only considers the newest 100 executions | Defect | Older reports not listed | pagination in UI | P3 | `frontend/src/pages/ReportsPage.tsx` |
| G10 | Report tabs are fixed; no Cryptographic Findings or Risk Categorization view; backend does not parse CBOM or QSE JSON | Missing | Findings are shown only as Bob's text | Parser for the QSE JSON artifacts | P2 | `backend/src/services/report.service.ts`, `frontend/src/pages/ReportViewPage.tsx` |
| G11 | QSE `versionArgs` not editable in the UI | Missing | Tools using a different version flag need API calls | none | P3 | `frontend/src/pages/QsePage.tsx` |
| G12 | Prompt templates are hard-coded | Missing | Cannot add templates without code change | storage and CRUD | P3 | `backend/src/orchestrators/prompt-builder.ts` |
| G13 | `/settings` version is hard-coded "1.0.0" | Inconsistency | Wrong version after upgrades | build metadata | P3 | `backend/src/controllers/index.ts` |
| G14 | Save toast on Bob page says "Run Test Connection to verify" although save already tests | Inconsistency | Misleading text | none | P3 | `frontend/src/pages/BobConnectionPage.tsx` |
| G15 | No SSE protocol, pagination/sort, E2E or accessibility tests | Test gap | Regressions undetected (see 11.6) | test environment | P1 for SSE and E2E | `backend/tests/`, `frontend/src/` |
| G16 | Default `STREAM_MODE` is `mock`, including in compose | Operational | A fresh install shows the demo, which may be mistaken for a real run | none | P2 (mitigated by DEMO labels) | `backend/src/config/env.ts`, `deployment/docker-compose.yml` |
| G17 | `docs/ARCHITECTURE.md` mentions Postgres as a future adapter, but no Postgres exists | Inconsistency | Misleading docs | none | P3 | `docs/ARCHITECTURE.md` |
| G18 | ACP adapter has no file API, so no artifact or report-file retrieval | Missing (limitation of ACP) | Reports come only from final answer on ACP | upstream Bob capability | P3 | `backend/src/integrations/headless-bob/acp.adapter.ts` |
| G19 | Prompt text is stored verbatim and not redacted | Operational | A secret typed in a prompt is stored | decision on redaction policy | P2 | `backend/src/repositories/execution.repository.ts` |
| G20 | Real analysis requires an operator-run Headless Bob and QSE CLI; the live chain has been run end-to-end once; Headless Bob's own run timeout defaults to 5 minutes | Operational | Long scans may time out on the Bob side | Bob-side configuration | P2 | `README.md`, `deployment/docker-compose.yml` |
| G21 | No metrics, tracing or alerting; no automated backup; no versioned migrations | Missing | Weak operability | monitoring stack | P2 | `backend/src/utils/logger.ts`, `backend/src/db/database.ts` |

---

## 15. Specification completeness checklist

| # | Check | Result | Where |
|---|---|---|---|
| 1 | Business objectives, capabilities, FR and NFR | Complete | Section 1 |
| 2 | Technology stack with exact versions from lockfiles | Complete | Section 2 |
| 3 | Design tokens, app shell, all 11 routes, component inventory, assets | Complete; token caveat for `border-subtle-01` and `--cds-*` recorded | Sections 3.1–3.6, G3 |
| 4 | Nine features specified with journey, inputs, API, persistence, failures, tests, status | Complete | Section 4 |
| 5 | Logical and sequence diagrams; current vs target architecture | Complete | Section 5 |
| 6 | Every REST route, error envelope, SSE contract, outbound Bob calls | Complete | Section 6 |
| 7 | ER diagram covering all 11 tables | Complete | Section 7 |
| 8 | Threat scenarios with mitigations and residual risk | Complete | Section 8 |
| 9 | Error catalogue | Complete | Section 9 |
| 10 | Modes, scripts, containers, full env-var table | Complete | Section 10 |
| 11 | Testing spec with counts, acceptance criteria and gaps | Complete | Section 11 |
| 12 | Production readiness without invented benchmarks | Complete | Section 12 |
| 13 | Traceability matrix | Complete | Section 13 |
| 14 | Gap analysis | Complete | Section 14 |
| 15 | Implemented/Partial/Mocked/Planned separated | Complete | Legend and every table |

Known limits of this specification: it was reverse-engineered from source and tests; the live Headless Bob and QSE chain was not re-run during this work; no performance figures exist.
