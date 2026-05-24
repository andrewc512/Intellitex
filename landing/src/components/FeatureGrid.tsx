import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import Reveal from './Reveal';

const INTERVAL_MS = 5000;

interface Feature {
  name: string;
  label: string;
  title: string;
  desc: string;
  panel: 'itek' | 'preview' | 'chat' | 'autofix';
}

const features: Feature[] = [
  {
    name: '.itek Resumes',
    label: '.itek',
    title: 'A resume language that compiles to LaTeX.',
    desc: 'Write resumes in a simple DSL that transpiles to ATS-friendly Jake\u2019s Resume\u2013style LaTeX. Drag to reorder sections, auto-format phone numbers, and compile instantly.',
    panel: 'itek',
  },
  {
    name: 'Live PDF Preview',
    label: 'Preview',
    title: 'See changes the instant you type.',
    desc: 'See your document update in real time as you type. Inline error tracking and one-click rebuilds \u2014 for both .tex and .itek files.',
    panel: 'preview',
  },
  {
    name: 'Agentic Editing',
    label: 'Agent',
    title: 'An agent that edits, compiles, and verifies.',
    desc: 'The agent reads your files, edits via str-replace, compiles to verify, and returns reviewable diffs. Accept or discard each change inline.',
    panel: 'chat',
  },
  {
    name: 'Auto-fix Errors',
    label: 'Auto-fix',
    title: 'Hand it an error, get back a fix.',
    desc: 'Hand a compile error to the agent and get a focused fix. It reads the log, patches your source, and recompiles to confirm.',
    panel: 'autofix',
  },
];

function ChatIcon() {
  return (
    <svg className="chat-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChatPreview() {
  return (
    <div className="chat-preview" aria-hidden="true">
      <div className="chat-bubble chat-bubble--user">
        fix the missing $ on line 42
      </div>
      <div className="chat-row chat-row--assistant">
        <ChatIcon />
        <div className="chat-bubble chat-bubble--assistant">
          Found it — missing a closing <code>$</code> on line 42. Fixed and recompiled, no errors.
        </div>
      </div>
      <div className="chat-bubble chat-bubble--user">
        how does my file look so far
      </div>
      <div className="chat-row chat-row--assistant">
        <ChatIcon />
        <div className="chat-bubble chat-bubble--assistant">
          Looks great — compiles clean, formatting is consistent. Ready to submit.
        </div>
      </div>
    </div>
  );
}

function ItekPreview() {
  return (
    <div className="chat-preview" aria-hidden="true">
      <div className="itek-preview-code">
        <div className="itek-line"><span className="itek-key">name</span> <span className="itek-punct">=</span> <span className="itek-val">Jane Doe</span></div>
        <div className="itek-line"><span className="itek-key">email</span> <span className="itek-punct">=</span> <span className="itek-val">jane@email.com</span></div>
        <div className="itek-line"><span className="itek-key">phone</span> <span className="itek-punct">=</span> <span className="itek-val">1234567890</span></div>
        <div className="itek-line itek-line--muted">↓ transpiles to</div>
        <div className="itek-line"><span className="itek-key">\name</span>{'{'}Jane Doe{'}'}</div>
        <div className="itek-line"><span className="itek-key">\email</span>{'{'}jane@email.com{'}'}</div>
        <div className="itek-line"><span className="itek-key">\phone</span>{'{'}(123) 456-7890{'}'}</div>
      </div>
    </div>
  );
}

function PreviewPanel() {
  return (
    <div className="chat-preview" aria-hidden="true">
      <div className="preview-panel-mock">
        <div className="preview-panel-bar">
          <span className="preview-dot preview-dot--red" />
          <span className="preview-dot preview-dot--yellow" />
          <span className="preview-dot preview-dot--green" />
          <span className="preview-panel-filename">resume.tex</span>
        </div>
        <div className="preview-panel-body">
          <div className="preview-line preview-line--h">\documentclass{'{'}article{'}'}</div>
          <div className="preview-line">\begin{'{'}document{'}'}</div>
          <div className="preview-line preview-line--highlight">\section{'{'}Experience{'}'}</div>
          <div className="preview-line preview-line--dim">...</div>
          <div className="preview-line">\end{'{'}document{'}'}</div>
        </div>
        <div className="preview-panel-status">
          <span className="preview-status-dot" />
          Compiled · 0 errors
        </div>
      </div>
    </div>
  );
}

function AutofixPreview() {
  return (
    <div className="chat-preview" aria-hidden="true">
      <div className="chat-bubble chat-bubble--user">
        fix the LaTeX errors in my file
      </div>
      <div className="chat-row chat-row--assistant">
        <ChatIcon />
        <div className="chat-bubble chat-bubble--assistant">
          I found 2 errors in your file. Line 18 has an unclosed brace, and line 34 is missing
          <code>\end{'{'}itemize{'}'}</code>. I've patched both and recompiled — your PDF is ready.
        </div>
      </div>
    </div>
  );
}

function FeaturePanel({ panel }: { panel: Feature['panel'] }) {
  switch (panel) {
    case 'itek': return <ItekPreview />;
    case 'preview': return <PreviewPanel />;
    case 'chat': return <ChatPreview />;
    case 'autofix': return <AutofixPreview />;
  }
}

export default function FeatureGrid() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [lockedHeight, setLockedHeight] = useState<number | undefined>(undefined);
  const measureRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;

    const measure = () => {
      const children = el.children;
      let max = 0;
      for (let i = 0; i < children.length; i++) {
        max = Math.max(max, (children[i] as HTMLElement).offsetHeight);
      }
      setLockedHeight(max);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const scheduleTo = useCallback((next: number) => {
    if (next === activeRef.current) return;
    if (transitionRef.current) clearTimeout(transitionRef.current);
    setVisible(false);
    transitionRef.current = setTimeout(() => {
      setActive(next);
      setVisible(true);
      transitionRef.current = null;
    }, 280);
  }, []);

  const resetInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const next = (activeRef.current + 1) % features.length;
      scheduleTo(next);
    }, INTERVAL_MS);
  }, [scheduleTo]);

  useEffect(() => {
    resetInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (transitionRef.current) clearTimeout(transitionRef.current);
    };
  }, [resetInterval]);

  const handleTabClick = (index: number) => {
    scheduleTo(index);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setPaused(true);
  };

  const current = features[active];

  return (
    <div>
      {/* Hidden container to measure the tallest slide */}
      <div ref={measureRef} className="feature-lead-measure" aria-hidden="true">
        {features.map((f, i) => (
          <div className="feature-lead" key={i}>
            <div className="feature-lead-text">
              <div className="feature-lead-label">{f.label}</div>
              <h3 className="feature-lead-title">{f.title}</h3>
              <p className="feature-lead-desc">{f.desc}</p>
            </div>
            <div className="feature-lead-panel">
              <FeaturePanel panel={f.panel} />
            </div>
          </div>
        ))}
      </div>

      <Reveal>
        <div
          className={`feature-lead ${!visible ? 'feature-lead--transitioning' : ''}`}
          style={lockedHeight ? { minHeight: lockedHeight } : undefined}
        >
          <div className="feature-lead-text" key={active}>
            <div className="feature-lead-label">{current.label}</div>
            <h3 className="feature-lead-title">{current.title}</h3>
            <p className="feature-lead-desc">{current.desc}</p>
          </div>
          <div className="feature-lead-panel" key={`panel-${active}`}>
            <FeaturePanel panel={current.panel} />
          </div>
        </div>
      </Reveal>

      <Reveal delay={200}>
        <div className="feature-tabs">
          <div className="feature-tab-row">
            {features.map((f, i) => (
              <button
                key={f.name}
                className={`feature-tab ${active === i ? 'feature-tab--active' : ''}`}
                onClick={() => handleTabClick(i)}
              >
                {f.name}
                {active === i && !paused && (
                  <span
                    className="feature-tab-progress"
                    key={`progress-${active}-${Date.now()}`}
                    style={{ animationDuration: `${INTERVAL_MS}ms` }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
