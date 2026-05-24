import { useCallback, useEffect, useRef, useState } from 'react';
import ThemeSwitcher from './ThemeSwitcher';

export default function Nav() {
  const [hidden, setHidden] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const show = useCallback(() => {
    setHidden(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHidden(true), 3000);
  }, []);

  useEffect(() => {
    timer.current = setTimeout(() => setHidden(true), 3000);

    const events = ['mousemove', 'scroll', 'touchstart', 'keydown'];
    events.forEach((e) => window.addEventListener(e, show, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, show));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [show]);

  const handleNavEnter = () => {
    if (timer.current) clearTimeout(timer.current);
    setHidden(false);
  };

  const handleNavLeave = () => {
    timer.current = setTimeout(() => setHidden(true), 2000);
  };

  return (
    <nav
      ref={navRef}
      className={`nav-pill ${hidden ? 'nav-pill--hidden' : ''}`}
      onMouseEnter={handleNavEnter}
      onMouseLeave={handleNavLeave}
    >
      <a href="#" className="nav-brand">IntelliTex</a>
      <div className="nav-links">
        <a href="#features" className="nav-link">Features</a>
        <a href="#about" className="nav-link">About</a>
        <a href="#download" className="nav-link nav-link--cta">Download</a>
        <ThemeSwitcher />
      </div>
    </nav>
  );
}
