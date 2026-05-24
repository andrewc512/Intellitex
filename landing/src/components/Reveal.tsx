import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  threshold?: number;
};

export default function Reveal({ children, delay = 0, className = '', style, threshold = 0.15 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { threshold, rootMargin: '60px 0px -60px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'reveal--visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms`, ...style } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function RevealGroup({ children, className = '', stagger = 100 }: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { threshold: 0.1, rootMargin: '60px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal-group ${visible ? 'reveal-group--visible' : ''} ${className}`}
      style={{ '--stagger': `${stagger}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
