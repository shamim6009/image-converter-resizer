import { useState } from 'react';
import {
  Gauge,
  Images,
  Layers3,
  Menu,
  Moon,
  Scaling,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import type { WorkflowTab } from '../types/image';
import type { Theme } from '../hooks/useTheme';

interface HeaderProps {
  activeTab: WorkflowTab;
  onNavigate: (tab: WorkflowTab) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const NAV_ITEMS: Array<{ id: WorkflowTab; label: string; icon: typeof Images }> = [
  { id: 'convert', label: 'Image Converter', icon: Images },
  { id: 'resize', label: 'Photo Resizer', icon: Scaling },
  { id: 'bulk', label: 'Bulk Tools', icon: Layers3 },
  { id: 'compress', label: 'Compression', icon: Gauge },
];

export function Header({ activeTab, onNavigate, theme, onToggleTheme }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (tab: WorkflowTab) => {
    setMenuOpen(false);
    onNavigate(tab);
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <button type="button" className="brand" onClick={() => navigate('convert')} aria-label="Image Converter home">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={21} strokeWidth={2.4} />
          </span>
          <span className="brand-copy">
            <span className="brand-name">Image Converter</span>
            <span className="brand-sub">Photo Resizer Studio</span>
          </span>
        </button>

        <nav className="desktop-nav" aria-label="Main tools">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-link ${activeTab === item.id ? 'is-active' : ''}`}
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => navigate(item.id)}
              >
                <Icon size={16} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="header-actions">
          <span className="privacy-chip" title="Images are processed on this device">
            <ShieldCheck size={15} aria-hidden="true" />
            Private by design
          </span>
          <button
            type="button"
            className="icon-button theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
          </button>
          <button
            type="button"
            className="icon-button mobile-menu-button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile tools">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`mobile-nav-link ${activeTab === item.id ? 'is-active' : ''}`}
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
          <div className="mobile-privacy">
            <ShieldCheck size={16} aria-hidden="true" />
            Your images never leave this device.
          </div>
        </nav>
      ) : null}
    </header>
  );
}
