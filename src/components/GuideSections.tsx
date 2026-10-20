import { CheckCircle2, FileWarning, Info, ShieldCheck, Sparkles } from 'lucide-react';

export function GuideSections() {
  return (
    <section className="guide-sections" aria-labelledby="guide-title">
      <div className="guide-header">
        <span className="section-kicker">Quick guide</span>
        <h2 id="guide-title">How to convert, resize and compress images online</h2>
        <p>
          Everything is done in your browser with the HTML5 Canvas API and real image encoders. There is no
          server round-trip and no waiting room.
        </p>
      </div>

      <div className="guide-grid">
        <article className="guide-card">
          <span className="guide-step">1</span>
          <h3>Upload your images</h3>
          <p>
            Drag and drop a single photo or a whole batch. Supported inputs include JPG, PNG, WebP, AVIF, GIF,
            BMP, SVG, ICO, TIFF and HEIC/HEIF.
          </p>
        </article>
        <article className="guide-card">
          <span className="guide-step">2</span>
          <h3>Choose format and size</h3>
          <p>
            Pick a target format such as JPG, PNG, WebP or AVIF, then resize by width, height, percentage or a
            preset. Set quality for lossy formats.
          </p>
        </article>
        <article className="guide-card">
          <span className="guide-step">3</span>
          <h3>Preview and download</h3>
          <p>
            Inspect the real encoded output against the original, download images individually, or grab every
            successful result in one ZIP archive.
          </p>
        </article>
      </div>

      <div className="guide-two-column">
        <article className="guide-panel">
          <div className="guide-panel-head">
            <Sparkles size={18} aria-hidden="true" />
            <h3>What this tool can do</h3>
          </div>
          <ul className="check-list">
            <li>
              <CheckCircle2 size={15} aria-hidden="true" /> Convert between JPG, PNG, WebP, AVIF, BMP and ICO
              with genuine encoders.
            </li>
            <li>
              <CheckCircle2 size={15} aria-hidden="true" /> Resize with aspect-ratio lock, contain, cover,
              stretch and fit-within modes.
            </li>
            <li>
              <CheckCircle2 size={15} aria-hidden="true" /> Batch process mixed formats with a shared settings
              panel.
            </li>
            <li>
              <CheckCircle2 size={15} aria-hidden="true" /> Compress with an adjustable 1–100 quality slider
              and real byte-size reporting.
            </li>
            <li>
              <CheckCircle2 size={15} aria-hidden="true" /> Preserve transparency in PNG, WebP, AVIF and ICO,
              or flatten onto a chosen background.
            </li>
            <li>
              <CheckCircle2 size={15} aria-hidden="true" /> Download all successful outputs as a ZIP with safe
              duplicate filenames.
            </li>
          </ul>
        </article>

        <article className="guide-panel">
          <div className="guide-panel-head">
            <FileWarning size={18} aria-hidden="true" />
            <h3>Honest limitations</h3>
          </div>
          <ul className="check-list muted-list">
            <li>
              <Info size={15} aria-hidden="true" /> Animated GIF, WebP and AVIF files are processed as their
              first frame. Animation is not preserved.
            </li>
            <li>
              <Info size={15} aria-hidden="true" /> Multi-page TIFF and HEIC files use the first page or image.
            </li>
            <li>
              <Info size={15} aria-hidden="true" /> ICO export produces a square icon capped at 256 × 256 px.
            </li>
            <li>
              <Info size={15} aria-hidden="true" /> SVG files are sanitized, stripped of scripts and external
              references, then rasterized.
            </li>
            <li>
              <Info size={15} aria-hidden="true" /> AVIF uses your browser's encoder when available and a
              bundled WebAssembly encoder otherwise.
            </li>
            <li>
              <Info size={15} aria-hidden="true" /> Files must be under 75 MB and images under 100 megapixels
              for safe local processing.
            </li>
          </ul>
        </article>
      </div>

      <div className="guide-two-column">
        <article className="guide-panel">
          <div className="guide-panel-head">
            <ShieldCheck size={18} aria-hidden="true" />
            <h3>Privacy and security</h3>
          </div>
          <p>
            Your files are read by the browser, decoded locally, drawn to an in-memory canvas and encoded back
            into a Blob. Nothing is uploaded, stored on a server, or shared. Uploaded image content is never
            placed in localStorage.
          </p>
        </article>

        <article className="guide-panel">
          <div className="guide-panel-head">
            <Info size={18} aria-hidden="true" />
            <h3>Frequently asked questions</h3>
          </div>
          <div className="faq-list">
            <details>
              <summary>Is this really a real PNG to WebP converter?</summary>
              <p>
                Yes. The app reads the decoded pixels, draws them to a canvas and asks the browser for a real
                WebP Blob. The preview and the downloaded file are the same encoded data.
              </p>
            </details>
            <details>
              <summary>Why is my compressed file sometimes larger?</summary>
              <p>
                Re-encoding can increase size, especially when converting a highly optimized JPEG to PNG or
                using maximum quality. The app reports the actual byte difference instead of hiding it.
              </p>
            </details>
            <details>
              <summary>Do you upload my photos?</summary>
              <p>
                No. There is no backend. Image processing uses browser APIs, and the GitHub Pages deployment
                only serves static files.
              </p>
            </details>
            <details>
              <summary>Can I use this offline?</summary>
              <p>
                After the first load, the core interface and encoders are cached by the browser. AVIF,
                HEIC/HEIF and TIFF decoding may load their WebAssembly modules on demand.
              </p>
            </details>
            <details>
              <summary>How do I set up my own deployment?</summary>
              <p>
                Fork or clone the repository, then follow the README. The included GitHub Actions workflow
                builds the Vite app and publishes the static output to GitHub Pages.
              </p>
            </details>
          </div>
        </article>
      </div>
    </section>
  );
}
