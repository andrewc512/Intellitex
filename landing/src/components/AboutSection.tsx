import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Member = {
  name: string;
  role: string;
  linkedin: string;
  github: string;
  photo: string;
  responsibilities: string[];
};

const team: Member[] = [
  {
    name: 'Jayden Tan',
    role: '.itek Engineer',
    linkedin: 'https://www.linkedin.com/in/jaydentan1206/',
    github: 'https://github.com/jaytan3966',
    photo: '/team/jayden.jpg',
    responsibilities: [
      'Designed and built the .itek resume DSL and LaTeX transpiler',
      'Implemented dynamic spacing, bold formatting, and section drag-reorder',
      'Built the UI/UX system — dark/light themes, welcome screen, zoom controls',
      'Created the Monaco editor integration with custom syntax highlighting and folding',
    ],
  },
  {
    name: 'Andrew Chen',
    role: 'AI Engineer',
    linkedin: 'https://www.linkedin.com/in/andrew-chen51205/',
    github: 'https://github.com/andrewc512',
    photo: '/team/andrew.jpg',
    responsibilities: [
      'Architected the Electron app — IPC handlers, file management, and project system',
      'Built the file tree sidebar, tab bar, and multi-file workspace',
      'Implemented the diff review UI (Accept / Discard) for agent edits',
      'Set up deployment pipeline, image support, and app scaffolding',
    ],
  },
  {
    name: 'Sean Kwon',
    role: 'AI Engineer',
    linkedin: 'https://www.linkedin.com/in/keanswon/',
    github: 'https://github.com/keanswon',
    photo: '/team/sean.jpg',
    responsibilities: [
      'Built the agentic editing system — prompts, streaming, and tool-use loop',
      'Developed the pdflatex compiler integration and error handling',
      'Optimized token usage and multi-turn context summarization',
      'Created the agent eval harness and theme switcher',
    ],
  },
];

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('');
}

function Avatar({ member }: { member: Member }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="team-avatar">
      {!failed ? (
        <img src={member.photo} alt={member.name} onError={() => setFailed(true)} />
      ) : (
        <span className="team-avatar-fallback">{initials(member.name)}</span>
      )}
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.62 0 4.29 2.38 4.29 5.48v6.26zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.79-.26.79-.58 0-.28-.01-1.03-.02-2.03-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.19.7.8.58A12.01 12.01 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function MemberModal({ member, onClose }: { member: Member; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="modal-header">
          <Avatar member={member} />
          <div>
            <div className="team-name">{member.name}</div>
            <div className="team-role">{member.role}</div>
          </div>
        </div>
        <ul className="modal-list">
          {member.responsibilities.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <div className="modal-links">
          <a
            href={member.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="team-linkedin"
          >
            <LinkedInIcon /> LinkedIn
          </a>
          <a
            href={member.github}
            target="_blank"
            rel="noopener noreferrer"
            className="team-linkedin"
          >
            <GitHubIcon /> GitHub
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MemberCard({ member, interactive }: { member: Member; interactive: boolean }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        className="team-card team-card--active team-card--hoverable"
        onClick={() => setShowModal(true)}
        role="button"
        tabIndex={interactive ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowModal(true); }
        }}
      >
        <Avatar member={member} />
        <div className="team-name">{member.name}</div>
        <div className="team-role">{member.role}</div>
        <div className="team-social-row">
          <a
            href={member.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="team-linkedin"
            tabIndex={interactive ? 0 : -1}
            onClick={(e) => e.stopPropagation()}
          >
            <LinkedInIcon /> LinkedIn
          </a>
          <a
            href={member.github}
            target="_blank"
            rel="noopener noreferrer"
            className="team-linkedin"
            tabIndex={interactive ? 0 : -1}
            onClick={(e) => e.stopPropagation()}
          >
            <GitHubIcon /> GitHub
          </a>
        </div>
      </div>
      {showModal && <MemberModal member={member} onClose={() => setShowModal(false)} />}
    </>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

function Carousel() {
  const [index, setIndex] = useState(0);
  const total = team.length;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  return (
    <>
      <div className="team-carousel">
        <button
          className="team-arrow"
          onClick={() => canPrev && setIndex(index - 1)}
          disabled={!canPrev}
          aria-label="Previous team member"
        >
          <ChevronLeft />
        </button>

        <div className="team-viewport">
          <div className="team-track" style={{ ['--i' as string]: index }}>
            {team.map((m, i) => {
              const isActive = i === index;
              return (
                <div
                  key={m.name}
                  className={`team-card ${isActive ? 'team-card--active' : 'team-card--peek'}`}
                  onClick={() => !isActive && setIndex(i)}
                  role={isActive ? undefined : 'button'}
                  aria-hidden={!isActive}
                  tabIndex={isActive ? undefined : 0}
                  onKeyDown={(e) => {
                    if (!isActive && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setIndex(i);
                    }
                  }}
                >
                  <Avatar member={m} />
                  <div className="team-name">{m.name}</div>
                  <div className="team-role">{m.role}</div>
                  <div className="team-social-row">
                    <a
                      href={m.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="team-linkedin"
                      onClick={(e) => !isActive && e.preventDefault()}
                      tabIndex={isActive ? 0 : -1}
                    >
                      <LinkedInIcon /> LinkedIn
                    </a>
                    <a
                      href={m.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="team-linkedin"
                      onClick={(e) => !isActive && e.preventDefault()}
                      tabIndex={isActive ? 0 : -1}
                    >
                      <GitHubIcon /> GitHub
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          className="team-arrow"
          onClick={() => canNext && setIndex(index + 1)}
          disabled={!canNext}
          aria-label="Next team member"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="team-dots">
        {team.map((m, i) => (
          <button
            key={m.name}
            className={`team-dot ${i === index ? 'team-dot--active' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Show ${m.name}`}
          />
        ))}
      </div>
    </>
  );
}

export default function AboutSection() {
  const wide = useMediaQuery('(min-width: 960px)');

  return (
    <>
      <h2 className="section-title">
        Meet the <em>team</em>.
      </h2>
      <p className="section-sub">
        Three engineers who got tired of bouncing between editors, compile logs, and ChatGPT tabs
        every time a resume or paper wouldn't compile.
      </p>

      {wide ? (
        <div className="team-grid team-grid--reveal">
          {team.map((m) => (
            <MemberCard key={m.name} member={m} interactive />
          ))}
        </div>
      ) : (
        <Carousel />
      )}
    </>
  );
}
