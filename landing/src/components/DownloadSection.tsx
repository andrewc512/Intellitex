import { RevealGroup } from './Reveal';

const DMG_URL = 'https://github.com/jaytan3966/Intellitex/releases/download/v0.1.0/IntelliTex-0.1.0-arm64.dmg';
const BASICTEX_URL = 'https://www.tug.org/mactex/morepackages.html';
const MACTEX_URL = 'https://www.tug.org/mactex/';

export default function DownloadSection() {
  return (
    <div className="download-block">
      <RevealGroup stagger={110}>
        <h2 className="section-title">Get it.</h2>

        <a href={DMG_URL} download className="download-hero-btn">
          <span className="download-hero-label">Download for macOS</span>
          <span className="download-hero-meta">v0.1.0 &middot; arm64 &middot; 131 MB</span>
        </a>

        <p className="prose" style={{ marginTop: 28 }}>
          IntelliTex compiles via{' '}
          <code style={{ fontFamily: 'var(--mono)', fontSize: '0.92em' }}>pdflatex</code>.
          You'll need a LaTeX distribution installed:
        </p>

        <div className="download-deps">
          <a href={BASICTEX_URL} target="_blank" rel="noopener noreferrer" className="download-dep">
            <span className="download-dep-name">BasicTeX</span>
            <span className="download-dep-detail">Lightweight &middot; ~100 MB</span>
            <span className="download-dep-arrow">&rsaquo;</span>
          </a>
          <a href={MACTEX_URL} target="_blank" rel="noopener noreferrer" className="download-dep">
            <span className="download-dep-name">MacTeX</span>
            <span className="download-dep-detail">Full distribution &middot; ~5 GB</span>
            <span className="download-dep-arrow">&rsaquo;</span>
          </a>
        </div>

        <p className="prose" style={{ marginTop: 24, color: 'var(--text-3)', fontSize: 13 }}>
          Requires macOS 11 or later on Apple Silicon. Windows and Linux builds are coming soon.
        </p>
      </RevealGroup>
    </div>
  );
}
