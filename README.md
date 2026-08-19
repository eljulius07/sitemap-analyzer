# SpiderSEO

A cross-platform desktop app (macOS · Windows) for **crawling websites and auditing their SEO, performance, content, and technical health**, then visualizing the site as an interactive tree and generating a custom `sitemap.xml`.

Built with Electron + React + TypeScript. All crawling runs in the Electron main process, so there are **no CORS limits** and **no data ever leaves your machine** (no telemetry, no backend).

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
- **📄 Sitemap Mode** — load a `sitemap.xml` from a local file or a URL. Supports gzip (`.xml.gz`) and recursive **sitemap index** files, reads the per-entry **`<xhtml:link rel="alternate">` hreflang set**, and collapses repeated `<loc>` values.
- **🕷️ Spider Mode** — discovery crawler that starts from a root URL and follows internal links (BFS) with:
  - configurable **max depth**, **max pages**, **concurrency**, and **timeout**
  - **robots.txt** support (allow/disallow + crawl-delay), follow-subdomains toggle, query-param handling
  - **include/exclude** glob patterns and optional external-link discovery

### Per-URL analysis
Every crawled page is analyzed across seven categories and scored 0–100:

| Category | Examples of what's checked |
|----------|----------------------------|
| **SEO** | title / length / pixel width, meta description, H1–H3, heading hierarchy, canonical & indexability, URL hygiene, on-page hreflang — plus **validation of the hreflang clusters the sitemap declares**: self-reference, bidirectional return links, alternates missing from the sitemap, duplicate language keys, malformed codes |
| **Performance** | TTFB, total download, redirect time / count, HTML size, **gzip / brotli / deflate** detection + real decompression, JS / CSS counts, render-blocking resources, lazy-loading, resource hints |
| **Content** | word count, text/HTML ratio, reading level, paragraphs, media (table / video / audio / iframe), language |
| **Technical** | HTTPS, **HTTP/2 + HTTP/3 detection via Alt-Svc**, doctype / charset / viewport / favicon, response headers (Server, CSP, HSTS, Cache-Control, ETag…) |
| **Social & Schema** | Open Graph, Twitter Card, JSON-LD types & validity (Article / Product / FAQ / Breadcrumb / LocalBusiness) |
| **Images** | total, missing / empty alt, missing dimensions, next-gen vs legacy formats, lazy-loaded, srcset — plus per-page **on-demand inspector** that returns each image's real weight (KB) and intrinsic dimensions (px) |
| **Links** | internal / external, nofollow / sponsored / ugc, empty anchors, `#`-only, `javascript:` links |

A **weighted health score** combines them (SEO 30 % · Performance 25 % · Content 15 % · Technical 10 % · Social 10 % · Images 5 % · Links 5 %) and each finding becomes a **critical / warning** issue. **Redirects are followed and surfaced** in a dedicated column with the redirect status + final destination, and the tree node is marked.

### Results dashboard
- **Slim top bar** (frameless, native window controls): logo + nav (Home / Results / Settings) + active crawl context (`🕷️ Spider: domain.com`) + theme toggle + GitHub link.
- Category **tabs** (Overview, SEO, Performance, Content, Technical, Social & Schema, Images, Links) over a **virtualized, sortable, resizable-column table**.
- **Global filters** (status group, severity, health range, text search) + **per-tab filter pills** with live counts.
- **"Large Images (>100 KB)" filter pill** — clicking it triggers a bulk inspection of every page's images (real bytes via partial GET + intrinsic dimensions from the image header) with live progress, then filters the table to the affected pages.
- **Right sidebar** (resizable 280–1200 px, collapsible, persisted):
  - **Descripción general** sub-tab — contextual stats per active category (counts, charts).
  - **Problemas** sub-tab — full catalog of detected issues classified as **Problema / Aviso / Oportunidad** with priority, affected URL count and %. Clicking a problem filters the main table to those URLs and pins description + how-to-fix in the lower half of the sidebar (height drag-adjustable).
  - When a table row is selected: full per-URL detail (sub-tabs Summary · SEO · Performance · Content · Technical · Social · Images · Links · with images list + heavy-image highlighting).
- Live progress dashboard with depth counts, throughput, ETA, mini live graph and **pause / resume / cancel**.

### Site graph
- **Clean URL-path tree** (default) — vertical, radial / star, or left-right layouts. Branches by URL path, not by link soup. Missing intermediates appear as dashed **ghost nodes**.
- Collapse / expand with animation, color-by modes (health, status, response time, word count, SEO, performance, depth), node search with pulse highlight, breadcrumb, and a live minimap.
- Redirect-marked nodes with arrow prefix + blue dashed border.
- The raw **force-directed link graph** is still available behind a *Show link graph (advanced)* toggle.

### Sitemap generator
- **Exclusions applied first**: only 200s get in, and URLs that redirect (3xx — the crawler follows them, so they arrive disguised as 200s), duplicates that resolve to the same destination, and optionally URLs canonicalised elsewhere are all dropped. The preview reports how many each rule removed.
- Output as **XML**, **XML + sitemap index** (auto-split, zipped), or **TXT**.
- `<lastmod>` (header / crawl date / custom), `<changefreq>` (auto-by-depth or uniform), `<priority>` (auto-calculated by depth + inbound links, or uniform with pattern overrides).
- **hreflang** alternates sourced from the page tags, from the original sitemap, or both (page wins per language, sitemap fills the gaps) — or manual marker mapping with `x-default`. Emitted as `<xhtml:link>` (the form Google documents) or as a bare `<link>` to match sitemaps already written that way, preserving any `type` attribute. An alternate is **pruned only when its target was crawled and then excluded**, so a 404 or a redirect never gets advertised while cross-language alternates that live in another sitemap file are left intact.
- **Image** and **News** sitemap extensions.
- Manual URL selection, include / exclude glob patterns, gzip output, live **preview + validation**.

### Exports
- **CSV** (all columns or current tab, UTF-8 BOM for Excel).
- **XLSX** multi-sheet workbook (summary + one sheet per category + a spider "Site Structure" sheet) with conditional formatting.
- **HTML report** (self-contained, dark / light aware, print-friendly).
- **Graph**: PNG, SVG, JSON, GEXF (for Gephi).
- **Tree**: PNG, SVG, self-contained interactive HTML, indented text.

---

## Tech stack

- **Shell:** [Electron](https://www.electronjs.org/) 33 + [electron-builder](https://www.electron.build/)
- **Build:** [electron-vite](https://electron-vite.org/) / [Vite](https://vitejs.dev/) 5
- **UI:** [React](https://react.dev/) 18 · [TypeScript](https://www.typescriptlang.org/) 5 · [Tailwind CSS](https://tailwindcss.com/) 3 · [zustand](https://github.com/pmndrs/zustand)
- **Crawling / analysis:** [axios](https://axios-http.com/) · Node `zlib` for gzip / brotli / deflate · [cheerio](https://cheerio.js.org/) · [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) · [robots-parser](https://github.com/samclarke/robots-parser) · [minimatch](https://github.com/isaacs/minimatch) · [image-size](https://github.com/image-size/image-size) (per-image probing)
- **Visualization / export:** [d3](https://d3js.org/) · [@tanstack/react-virtual](https://tanstack.com/virtual) · [recharts](https://recharts.org/) · [exceljs](https://github.com/exceljs/exceljs) · [jszip](https://stuk.github.io/jszip/)

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
4. Open **🗺️ Site Graph** for the URL-path tree and **📝 Generate Sitemap** to build a clean one — both available in either mode. The raw link graph behind *Show link graph (advanced)* needs Spider Mode, since only a spider crawl collects link data.
5. Use the **Export** menu for CSV / XLSX / HTML reports.

Per-crawl settings (concurrency, timeout, user-agent, follow redirects, retry) live on the **Settings** page and persist locally.

---

## Project structure

```
src/
├── main/                     # Electron main process (Node)
│   ├── index.ts              # window creation, external-link handling, frameless title bar
│   ├── ipc-handlers.ts       # IPC bridge + file dialogs + error logging
│   ├── fetcher.ts            # HTTP fetch: redirect chain, timing, headers, manual gzip/br/deflate, Alt-Svc h2/h3
│   ├── crawler.ts            # sitemap-mode concurrency pool
│   ├── spider.ts             # spider-mode BFS discovery engine
│   ├── image-inspector.ts    # per-image weight (Content-Range) + intrinsic dimensions
│   ├── parser.ts             # sitemap.xml / index / gzip parsing + hreflang alternates
│   ├── analyzer.ts           # cheerio HTML analysis (7 categories)
│   ├── url-normalizer.ts     # URL normalization + dedup
│   └── robots-parser.ts      # robots.txt fetch + rules
├── preload/
│   └── index.ts              # contextBridge API (no nodeIntegration)
├── shared/
│   ├── types.ts              # types + IPC channel names shared both ways
│   ├── scoring.ts            # issue generation + category/health scoring
│   └── hreflang.ts           # sitemap hreflang cluster validation
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
- **Lazy chunks**: heavy modules (`exceljs`, `jszip`, `d3` via the Site Tree, the Sitemap Generator) are split into separate chunks loaded on demand — the initial bundle is ~1.2 MB instead of ~3 MB.
- **Honest compression / protocol detection**: gzip / brotli / deflate are decompressed in-house (axios's auto-decompression hides the original `Content-Encoding`), and HTTP/2 + HTTP/3 server support is detected from the `Alt-Svc` header.
- **Security**: strict Content-Security-Policy (with `blob:` allowed for image rasterization only), no remote code, and all external links open in the system browser (`setWindowOpenHandler` + `will-navigate`) — the app never navigates away from itself.

---

## Privacy

SpiderSEO is fully local. It has **no telemetry, no analytics, and no backend**. Crawl results stay in memory and are only written to disk when you explicitly export. Errors are logged to a local file in the app's `userData` directory.

---

## Troubleshooting

- **Blank window / app exits citing `isPackaged`** — your shell may export `ELECTRON_RUN_AS_NODE=1`, which forces Electron to run as plain Node. Launch with it unset:
  ```bash
  env -u ELECTRON_RUN_AS_NODE npm run dev
  ```
- **A page shows `200` but redirects in your browser** — the app follows redirects and reports the final status; the **Redirect** column and the dashed/`↪` graph marker show the destination. Some sites only redirect based on request headers (language, cookies), so behavior can differ from a logged-in browser session.

---

## Known limitations

- The site graph renders with **SVG**; very large graphs (2000+ nodes) stay responsive thanks to default-collapsed branches, but there is no dedicated canvas / WebGL renderer.
- **Total page weight** is estimated from the HTML document by default. The on-demand **Image inspector** does fetch each image (partial range request) to surface real weight + intrinsic dimensions, but JS / CSS bytes are not downloaded.
- **HTTP/2 + HTTP/3** support is detected via the `Alt-Svc` header (server advertisement). The crawler itself negotiates HTTP/1.1 since Node's built-in client doesn't speak QUIC.
- **Video** sitemap entries require embed metadata that isn't currently extracted.

---

## License

Released under the **MIT License** (a sensible default — change it to suit your project). See [`LICENSE`](LICENSE).
