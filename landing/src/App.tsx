import Nav from './components/Nav';
import Hero3D from './components/Hero3D';
import FeatureGrid from './components/FeatureGrid';
import DownloadSection from './components/DownloadSection';
import AboutSection from './components/AboutSection';
import Reveal, { RevealGroup } from './components/Reveal';

export default function App() {
  return (
    <div className="page">
      <Nav />

      <main>
        <section className="snap hero">
          <div className="hero-content">
            <RevealGroup stagger={120}>
              <div className="hero-meta-top">v0.1.0 · macOS · released today</div>
              <h1 className="hero-title">
                An AI-powered <em>LaTeX editor</em> built for resumes and research.
              </h1>
              <p className="hero-sub">
                IntelliTex pairs a Monaco-based editor with a live PDF preview and an agentic
                assistant that edits, compiles, and proposes diffs — plus a dedicated resume
                language that transpiles to ATS-friendly LaTeX in one click.
              </p>
              <div className="hero-actions">
                <a href="#download" className="btn btn-primary">Download for macOS</a>
                <a href="#features" className="link-quiet">See what's inside →</a>
              </div>
            </RevealGroup>
          </div>
          <Reveal delay={200} className="hero-3d">
            <Hero3D />
          </Reveal>
        </section>

        <section id="features" className="snap section">
          <div className="container">
            <RevealGroup stagger={100}>
              <div className="section-num">01 — Features</div>
              <h2 className="section-title">
                Built for the way you <em>actually</em> write.
              </h2>
              <p className="section-sub">
                Agentic LaTeX editing for papers and resumes — compile, review, and revise with
                an AI that reads your project and proposes diffs you can accept or discard.
              </p>
            </RevealGroup>
            <Reveal delay={300}>
              <FeatureGrid />
            </Reveal>
          </div>
        </section>

        <section id="about" className="snap section">
          <div className="container">
            <Reveal>
              <div className="section-num">02 — About</div>
            </Reveal>
            <Reveal delay={80}>
              <AboutSection />
            </Reveal>
          </div>
        </section>

        <section id="download" className="snap section">
          <div className="container">
            <Reveal>
              <div className="section-num">03 — Download</div>
            </Reveal>
            <Reveal delay={100}>
              <DownloadSection />
            </Reveal>
          </div>
        </section>
      </main>

    </div>
  );
}
