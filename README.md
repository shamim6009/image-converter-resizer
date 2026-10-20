# Image Converter & Photo Resizer

A production-ready, 100% client-side image toolkit. Convert, resize, compress and
batch-export images without uploading a single byte to a server.

Built with **React 18 + TypeScript + Vite**, using the HTML5 Canvas API and real
image encoders. Everything runs in the browser and deploys as a static site to
GitHub Pages.

## Features

- **Real format conversion** between JPEG, PNG, WebP, AVIF, BMP and ICO. Output
  bytes are validated by magic number before they are ever shown or downloaded.
- **Input support** for JPG, PNG, WebP, AVIF, GIF, BMP, SVG, ICO, TIFF and
  HEIC/HEIF (via bundled decoders).
- **Resizing** by width, height, longest side, max dimensions, exact custom
  dimensions or percentage, with aspect-ratio locking and contain / cover /
  stretch / fit-within modes.
- **Compression** with a 1–100 quality slider for lossy formats and honest
  before/after byte-size reporting.
- **Bulk processing** with a shared settings panel, per-image statuses, a
  cancellable job queue and a ZIP download that processes missing outputs first.
- **Live encoded preview** plus a before/after comparison slider.
- **Privacy first**: no backend, no trackers, no accounts. Images never leave the
  device and file content is never written to localStorage.
- **Dark mode** with a no-flash theme bootstrap and responsive, accessible UI.

## Tech stack

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| UI             | React 18, lucide-react icons                       |
| Build          | Vite 6, TypeScript 5 (strict)                      |
| Rendering      | HTML5 Canvas 2D                                    |
| HEIC/HEIF      | heic2any                                           |
| TIFF           | UTIF                                               |
| AVIF           | native browser encoder, `@jsquash/avif` WASM fallback |
| ZIP            | JSZip                                              |
| Tests          | Vitest                                             |

## Getting started

```bash
npm install
npm run dev        # start the dev server on http://localhost:5173
```

### Scripts

```bash
npm run dev        # development server
npm run build      # type check + production build to dist/
npm run preview    # preview the production build locally
npm run typecheck  # tsc --noEmit
npm test           # run the Vitest suite once
npm run test:watch # run tests in watch mode
```

## How it works

1. `analyzeImageFile` sniffs the real format from file bytes and produces a
   thumbnail. Source files are kept in memory only.
2. `resolveGeometry` computes the exact output size and the source rectangle used
   to fit, cover, stretch or pad the image.
3. `composeCanvas` draws the image, handling background flattening and
   transparency.
4. `encodeComposition` produces a real Blob for the chosen format. AVIF uses the
   native encoder when available and a WebAssembly encoder otherwise; BMP and ICO
   use hand-written encoders.
5. `validateEncodedBlob` re-checks the encoded bytes against known signatures, so
   a file is only ever labelled with the format it truly is.
6. The same Blob backs both the preview and the download.

## Deployment

The repository ships with a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that type checks, tests, builds and publishes the
`dist` folder to GitHub Pages on every push to `main`.

To enable it:

1. Push the project to a GitHub repository.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually).

`vite.config.ts` uses `base: './'`, so the build works from a repository subpath
without extra configuration.

## Known limitations

- Animated GIF, WebP and AVIF inputs are processed as their first frame.
- Multi-page TIFF and multi-image HEIC files use the first page.
- ICO output is a square icon capped at 256 × 256 px.
- SVG input is sanitized, stripped of scripts and external references, then
  rasterized.
- Files must stay under 75 MB and images under 100 megapixels for safe local
  processing.

## License

MIT
