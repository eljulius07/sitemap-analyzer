# Site Analyzer

A cross-platform desktop app (macOS · Windows) for **crawling websites and auditing their SEO, performance, content, and technical health** — then visualizing the site as an interactive tree and generating a custom `sitemap.xml`.

Built with Electron + React + TypeScript. All crawling runs in the Electron main process, so there are **no CORS limits** and **no data ever leaves your machine**.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## Screenshots

> Drop images into `docs/screenshots/` and reference them here, e.g.
>
> `![Results dashboard](docs/screenshots/dashboard.png)`
> `![Site tree](docs/screenshots/site-tree.png)`

---

## Features

### Two crawl modes
- **📄 Sitemap Mode** — load a `sitemap.xml` from a local file or a URL. Supports gzip (`.xml.gz`) and recursive **sitemap index** files.
- **🕷️ Spider Mode** — discovery crawler that starts from a root URL and follows internal links (BFS) with:
  - configurable **max depth**, **max pages**, **concurrency**, and **timeout**
  - **robots.txt** support (allow/disallow + crawl-delay), follow-subdomains toggle, query-param handling
  - **include/exclude** glob patterns and optional external-link discovery

### Per-URL analysis
Every crawled page is analyzed across seven categories and scored 0–100:

| Category | Examples of what's checked |
|----------|----------------------------|
| **SEO** | title/length/pixel width, meta description, H1–H3, heading hierarchy, canonical & indexability, URL hygiene, hreflang |
| **Performance** | TTFB, total download, redirect time/count, HTML size, JS/CSS counts, render-blocking resources, lazy-loading, resource hints |
| **Content** | word count, text/HTML ratio, reading level, paragraphs, media (table/video/audio/iframe), language |
| **Technical** | HTTPS, doctype/charset/viewport/favicon, response headers (Server, CSP, HSTS, Cache-Control, ETag…) |
| **Social & Schema** | Open Graph, Twitter Card, JSON-LD types & validity (Article/Product/FAQ/Breadcrumb/LocalBusiness) |
| **Images** | total, missing/empty alt, missing dimensions, next-gen vs legacy formats, lazy-loaded, srcset |
| **Links** | internal/external, nofollow/sponsored/ugc, empty anchors, `#`-only, `javascript:` links |

A **weighted health score** combines them (SEO 35% · Performance 25% · Content 15% · Technical 10% · Social 10% · Images 5%) and each finding becomes a **critical / warning** issue. **Redirects are detected** even when followed — a dedicated column and graph marker show the final destination.

### Results dashboard
- Category **tabs** (Overview, SEO, Performance, Content, Technical, Social & Schema, Images, Links)
- **Global filters** (status group, severity, health range, text search) + **per-tab filter pills** with live counts
- **Virtualized** sortable table (handles tens of thousands of rows)
- **Detail panel** with per-category sub-tabs, issues, recommendations, and copy-to-clipboard
- Summary panel with a status-distribution donut and key metric cards
- Live progress with **pause / resume / cancel** and ETA

### Site graph
- **Clean URL-path tree** (the default) — vertical, radial/star, or left-right layouts. Branches by URL path, not by link soup. Missing intermediates appear as dashed **ghost nodes**.
- Collapse/expand (with animation), color-by modes (health, status, response time, word count, SEO, performance, depth), node search, breadcrumb, and a minimap.
- The raw **force-directed link graph** is still available behind a *Show link graph (advanced)* toggle.

### Sitemap generator
- Output as **XML**, **XML + sitemap index** (auto-split, zipped), or **TXT**
- `<lastmod>` (header / crawl date / custom), `<changefreq>` (auto-by-depth or uniform), `<priority>` (auto-calculated or uniform with pattern overrides)
- **hreflang** alternates (auto-detected from pages or manual marker mapping with `x-default`)
- **Image** and **News** sitemap extensions
- Manual URL selection, include/exclude patterns, gzip output, live **preview + validation**

### Exports
- **CSV** (all columns or current tab, UTF-8 BOM for Excel)
- **XLSX** multi-sheet workbook (summary + one sheet per category + a spider "Site Structure" sheet), with conditional formatting
- **HTML report** (self-contained, dark/light aware, print-friendly)
- **Graph**: PNG, SVG, JSON, GEXF (for Gephi)
- **Tree**: PNG, SVG, self-contained interactive HTML, indented text

---

## Tech stack

- **Shell:** [Electron](https://www.electronjs.org/) 33 + [electron-builder](https://www.electron.build/)
- **Build:** [electron-vite](https://electron-vite.org/) / [Vite](https://vitejs.dev/) 5
- **UI:** [React](https://react.dev/) 18 · [TypeScript](https://www.typescriptlang.org/) 5 · [Tailwind CSS](https://tailwindcss.com/) 3 · [zustand](https://github.com/pmndrs/zustand)
- **Crawling/analysis:** [axios](https://axios-http.com/) · [cheerio](https://cheerio.js.org/) · [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) · [robots-parser](https://github.com/samclarke/robots-parser) · [minimatch](https://github.com/isaacs/minimatch)
- **Visualization/export:** [d3](https://d3js.org/) · [@tanstack/react-virtual](https://tanstack.com/virtual) · [recharts](https://recharts.org/) · [exceljs](https://github.com/exceljs/exceljs) · [jszip](https://stuk.github.io/jszip/)

---

## Getting started

### Prerequisites
- **Node.js 20+** and npm

### Install
```bash
git clone <your-repo-url>
cd sitemap-analyzer
npm install
```

### Run in development (hot reload)
```bash
npm run dev
```

### Type-check
```bash
npm run typecheck
```

### Build the bundles
```bash
npm run build      # outputs to out/
npm start          # preview the built app
```

### Package installers
```bash
npm run dist:mac   # DMG (x64 + arm64)
npm run dist:win   # NSIS installer + portable (x64)
npm run dist       # current platform
```
Installers are written to `release/`. Packaging is configured in [`electron-builder.yml`](electron-builder.yml).

---

## Usage

1. **Choose a mode** on the Home screen.
   - *Sitemap Mode*: drop a `.xml`/`.xml.gz` file or paste a sitemap URL, then **Analyze**.
   - *Spider Mode*: enter a start URL, tune the crawl settings, then **Start Crawling**.
2. Watch live progress; **pause/resume/cancel** at any time.
3. Explore results in the category tabs; click any row to open the full detail panel.
4. In Spider Mode, open **🗺️ Site Graph** to see the structure and **📝 Generate Sitemap** to export one.
5. Use the **Export** menu for CSV / XLSX / HTML reports.

Per-crawl settings (concurrency, timeout, user-agent, follow redirects, retry) live on the **Settings** page and persist locally.

---

## Project structure

```
src/
├── main/                     # Electron main process (Node)
│   ├── index.ts              # window creation, external-link handling
│   ├── ipc-handlers.ts       # IPC bridge + file dialogs + error logging
│   ├── fetcher.ts            # HTTP fetch: redirect chain, timing, headers
│   ├── crawler.ts            # sitemap-mode concurrency pool
│   ├── spider.ts             # spider-mode BFS discovery engine
│   ├── parser.ts             # sitemap.xml / index / gzip parsing
│   ├── analyzer.ts           # cheerio HTML analysis (7 categories)
│   ├── url-normalizer.ts     # URL normalization + dedup
│   └── robots-parser.ts      # robots.txt fetch + rules
├── preload/
│   └── index.ts              # contextBridge API (no nodeIntegration)
├── shared/
│   ├── types.ts              # types + IPC channel names shared both ways
│   └── scoring.ts            # issue generation + category/health scoring
└── renderer/                 # React UI
    ├── components/           # UI + graph/ (D3 tree) subfolder
    ├── stores/               # zustand: analysis, spider, graph, tree
    ├── hooks/                # derived results (duplicates, filtering)
    ├── results/              # table column + filter config
    └── utils/                # summary, exports, sitemap + graph builders
```

---

## Architecture

- **Main process** does all networking and parsing. The renderer never touches Node directly — it talks to a small, typed API exposed through a **`contextBridge`** preload (`contextIsolation: true`, `nodeIntegration: false`).
- **Streaming IPC**: as each page finishes, the main process streams a `*:page-result` event to the renderer, which buffers and flushes in batches for smooth updates on large crawls.
- **Shared scoring** lives in `src/shared` so both the main process (per-URL, at crawl time) and the renderer (re-evaluated with cross-URL duplicate detection) use identical logic.
- **Security**: strict Content-Security-Policy, no remote code, and all external links open in the system browser (`setWindowOpenHandler` + `will-navigate`) — the app never navigates away from itself.

---

## Privacy

Site Analyzer is fully local. It has **no telemetry, no analytics, and no backend**. Crawl results stay in memory and are only written to disk when you explicitly export. Errors are logged to a local file in the app's `userData` directory.

---

## Troubleshooting

- **Blank window / app exits citing `isPackaged`** — your shell may export `ELECTRON_RUN_AS_NODE=1`, which forces Electron to run as plain Node. Launch with it unset:
  ```bash
  env -u ELECTRON_RUN_AS_NODE npm run dev
  ```
- **A page shows `200` but redirects in your browser** — the app follows redirects and reports the final status; the **Redirect** column and the dashed/`↪` graph marker show the destination. Some sites only redirect based on request headers (language, cookies), so behavior can differ from a logged-in browser session.

---

## Known limitations

- The site graph renders with **SVG**; very large graphs (2000+ nodes) stay responsive thanks to default-collapsed branches, but there is no dedicated canvas/WebGL renderer.
- **Total page weight** is estimated from the HTML document — external resources (JS/CSS/images) are parsed but not downloaded.
- **HTTP/2** detection is best-effort (the Node HTTP client negotiates HTTP/1.1).
- **Video** sitemap entries require embed metadata that isn't currently extracted.

---

## License

Released under the **MIT License** (a sensible default — change it to suit your project). See [`LICENSE`](LICENSE).
