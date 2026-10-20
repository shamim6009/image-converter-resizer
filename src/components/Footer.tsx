import { Github, Heart, LockKeyhole, Mail } from 'lucide-react';
import type { WorkflowTab } from '../types/image';

interface FooterProps {
  onNavigate: (tab: WorkflowTab) => void;
}

const TOOL_LINKS: Array<{ id: WorkflowTab; label: string }> = [
  { id: 'convert', label: 'Image Converter' },
  { id: 'resize', label: 'Photo Resizer' },
  { id: 'bulk', label: 'Bulk Tools' },
  { id: 'compress', label: 'Image Compression' },
];

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <h2>Image Converter &amp; Photo Resizer</h2>
          <p>
            A free, privacy-first image toolkit that runs entirely in your browser. Convert, resize, compress
            and batch-export without accounts, uploads or watermarks.
          </p>
          <span className="footer-privacy">
            <LockKeyhole size={15} aria-hidden="true" />
            All processing happens locally on your device.
          </span>
        </div>

        <nav className="footer-column" aria-label="Footer tools">
          <h3>Tools</h3>
          {TOOL_LINKS.map((link) => (
            <button key={link.id} type="button" className="footer-link" onClick={() => onNavigate(link.id)}>
              {link.label}
            </button>
          ))}
        </nav>

        <div className="footer-column">
          <h3>Supported formats</h3>
          <p className="footer-formats">
            Input: JPG, PNG, WebP, AVIF, GIF, BMP, SVG, ICO, TIFF, HEIC/HEIF
          </p>
          <p className="footer-formats">Output: JPG, PNG, WebP, AVIF, BMP, ICO</p>
        </div>

        <div className="footer-column">
          <h3>Good to know</h3>
          <ul className="footer-list">
            <li>No login or account required</li>
            <li>No image content is transmitted</li>
            <li>Animated files are processed as a still frame</li>
            <li>Works offline after the page loads</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Image Converter &amp; Photo Resizer. All rights reserved.</span>
        <span className="footer-made">
          Built with React, Vite and the Canvas API <Heart size={13} aria-hidden="true" />
        </span>
        <span className="footer-meta">
          <Github size={14} aria-hidden="true" />
          Static build ready for GitHub Pages
          <Mail size={14} aria-hidden="true" />
          No trackers, no ads
        </span>
      </div>
    </footer>
  );
}
