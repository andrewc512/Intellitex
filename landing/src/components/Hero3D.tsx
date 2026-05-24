import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';

function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    bg: s.getPropertyValue('--bg').trim(),
    bgSoft: s.getPropertyValue('--bg-soft').trim(),
    bgElevated: s.getPropertyValue('--bg-elevated').trim(),
    text: s.getPropertyValue('--text').trim(),
    text2: s.getPropertyValue('--text-2').trim(),
    text3: s.getPropertyValue('--text-3').trim(),
    accent: s.getPropertyValue('--accent').trim(),
    accentInk: s.getPropertyValue('--accent-ink').trim(),
  };
}

type ThemeColors = ReturnType<typeof getThemeColors>;

function lerpColor(a: string, b: string, t: number): string {
  const parse = (c: string) => {
    if (c.startsWith('#')) {
      const hex = c.slice(1);
      const full = hex.length === 3
        ? hex.split('').map(h => h + h).join('')
        : hex;
      return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
      ];
    }
    const m = c.match(/\d+/g);
    return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function lerpThemeColors(from: ThemeColors, to: ThemeColors, t: number): ThemeColors {
  const keys = Object.keys(from) as (keyof ThemeColors)[];
  const result = {} as ThemeColors;
  for (const k of keys) {
    result[k] = lerpColor(from[k], to[k], t);
  }
  return result;
}

function useThemeColors(): ThemeColors {
  const targetRef = useRef<ThemeColors>(getThemeColors());
  const currentRef = useRef<ThemeColors>(getThemeColors());
  const progressRef = useRef(1);
  const [colors, setColors] = useState<ThemeColors>(getThemeColors);

  useEffect(() => {
    const onThemeChange = () => {
      targetRef.current = getThemeColors();
      progressRef.current = 0;
    };
    const observer = new MutationObserver(onThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let raf: number;
    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (progressRef.current < 1) {
        progressRef.current = Math.min(1, progressRef.current + dt / 0.6);
        const eased = 1 - Math.pow(1 - progressRef.current, 3);
        currentRef.current = lerpThemeColors(currentRef.current, targetRef.current, eased);
        setColors({ ...currentRef.current });
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return colors;
}

function EditorMockup({ colors, mouse }: { colors: ThemeColors; mouse: React.RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const smoothMouse = useRef({ x: 0, y: 0 });

  useFrame(() => {
    if (!group.current) return;
    const t = performance.now() * 0.001;

    const target = mouse.current ?? { x: 0, y: 0 };
    smoothMouse.current.x += (target.x - smoothMouse.current.x) * 0.05;
    smoothMouse.current.y += (target.y - smoothMouse.current.y) * 0.05;

    group.current.position.y = Math.sin(t * 0.6) * 0.05;
    group.current.rotation.y = smoothMouse.current.x * 0.3;
    group.current.rotation.x = -smoothMouse.current.y * 0.15;
  });

  const W = 7.2;
  const H = 4.4;
  const topBar = 0.3;
  const sidebarW = 1.1;
  const assistantW = 1.8;
  const editorW = W - sidebarW - assistantW - 0.2;
  const contentTop = H / 2 - topBar - 0.15;

  // Sidebar file entries: [indent, width, y]
  const sidebarFiles: [number, number, number][] = [
    [0, 0.7, contentTop - 0.1],
    [0.1, 0.6, contentTop - 0.32],
    [0.1, 0.5, contentTop - 0.52],
    [0.1, 0.55, contentTop - 0.72],
    [0, 0.65, contentTop - 0.98],
    [0.1, 0.7, contentTop - 1.18],
    [0.1, 0.55, contentTop - 1.38],
    [0.1, 0.6, contentTop - 1.58],
    [0.1, 0.5, contentTop - 1.78],
    [0, 0.6, contentTop - 2.04],
    [0.1, 0.7, contentTop - 2.24],
    [0.1, 0.45, contentTop - 2.44],
  ];

  // Editor code lines: [indent, width, y, color]
  const editorLines: [number, number, number, string][] = [
    [0, 1.8, contentTop - 0.0, colors.accentInk],
    [0, 0.9, contentTop - 0.22, colors.text3],
    [0, 1.5, contentTop - 0.44, colors.accentInk],
    [0, 1.6, contentTop - 0.66, colors.accentInk],
    [0, 1.2, contentTop - 0.88, colors.accentInk],
    [0, 1.4, contentTop - 1.10, colors.accentInk],
    [0, 0.8, contentTop - 1.32, colors.text3],
    [0, 0.9, contentTop - 1.54, colors.text],
    [0.2, 1.6, contentTop - 1.76, colors.text],
    [0.2, 2.0, contentTop - 1.98, colors.text],
    [0.4, 1.4, contentTop - 2.20, colors.text],
    [0.4, 1.7, contentTop - 2.42, colors.text],
    [0.2, 0.8, contentTop - 2.64, colors.accentInk],
    [0, 0.6, contentTop - 2.86, colors.text3],
    [0.2, 1.5, contentTop - 3.08, colors.text],
    [0.4, 1.8, contentTop - 3.30, colors.text],
    [0.4, 1.2, contentTop - 3.52, colors.text],
  ];

  // PDF preview area lines (white page with text)
  const pdfLines: [number, number, boolean][] = [
    [1.0, contentTop - 0.2, true],
    [0.7, contentTop - 0.42, false],
    [0.6, contentTop - 0.60, false],
    [1.1, contentTop - 0.90, true],
    [1.0, contentTop - 1.12, false],
    [0.9, contentTop - 1.30, false],
    [1.05, contentTop - 1.48, false],
    [0.8, contentTop - 1.66, false],
    [1.1, contentTop - 1.96, true],
    [0.95, contentTop - 2.18, false],
    [1.0, contentTop - 2.36, false],
    [0.85, contentTop - 2.54, false],
  ];

  // Assistant chat bubbles: [width, y, isUser]
  const chatBubbles: [number, number, boolean][] = [
    [0.6, contentTop - 0.15, true],
    [0.75, contentTop - 0.55, false],
    [0.7, contentTop - 1.05, false],
    [0.55, contentTop - 1.50, true],
    [0.8, contentTop - 1.95, false],
    [0.75, contentTop - 2.50, false],
  ];

  const sidebarX = -W / 2 + sidebarW / 2 + 0.06;
  const editorX = -W / 2 + sidebarW + editorW / 2 + 0.1;
  const rightX = W / 2 - assistantW / 2 - 0.06;

  return (
    <group ref={group}>
      {/* Main window frame */}
      <RoundedBox args={[W, H, 0.05]} radius={0.06} smoothness={6}>
        <meshPhysicalMaterial
          color={colors.bg}
          roughness={0.5}
          metalness={0.05}
          transparent
          opacity={0.95}
          clearcoat={0.2}
          clearcoatRoughness={0.5}
        />
      </RoundedBox>

      {/* Top bar */}
      <mesh position={[0, H / 2 - topBar / 2 - 0.02, 0.03]}>
        <planeGeometry args={[W - 0.1, topBar]} />
        <meshStandardMaterial color={colors.bgElevated} transparent opacity={0.9} />
      </mesh>

      {/* Traffic lights */}
      {[
        { x: -W / 2 + 0.35, color: '#ff5f57' },
        { x: -W / 2 + 0.55, color: '#ffbd2e' },
        { x: -W / 2 + 0.75, color: '#28c840' },
      ].map((dot, i) => (
        <mesh key={i} position={[dot.x, H / 2 - topBar / 2 - 0.02, 0.035]}>
          <circleGeometry args={[0.05, 16]} />
          <meshStandardMaterial color={dot.color} />
        </mesh>
      ))}

      {/* Tab label */}
      <Text
        position={[-W / 2 + sidebarW + 0.6, H / 2 - topBar / 2 - 0.02, 0.035]}
        fontSize={0.1}
        color={colors.text}
        anchorX="left"
        anchorY="middle"
      >
        hw2.tex
      </Text>

      {/* Top bar right buttons area */}
      <Text
        position={[W / 2 - 0.5, H / 2 - topBar / 2 - 0.02, 0.035]}
        fontSize={0.09}
        color={colors.accent}
        anchorX="right"
        anchorY="middle"
      >
        Compile
      </Text>

      {/* Sidebar background */}
      <mesh position={[sidebarX, -topBar / 2 - 0.02, 0.028]}>
        <planeGeometry args={[sidebarW, H - topBar - 0.08]} />
        <meshStandardMaterial color={colors.bgSoft} transparent opacity={0.8} />
      </mesh>

      {/* Sidebar files */}
      {sidebarFiles.map(([indent, w, y], i) => (
        <mesh key={`sf${i}`} position={[sidebarX - sidebarW / 2 + 0.15 + indent + w / 2, y, 0.033]}>
          <planeGeometry args={[w, 0.07]} />
          <meshStandardMaterial
            color={i === 1 ? colors.text : colors.text3}
            transparent
            opacity={i === 1 ? 0.7 : 0.35}
          />
        </mesh>
      ))}

      {/* Editor panel label */}
      <mesh position={[editorX, contentTop + 0.18, 0.033]}>
        <planeGeometry args={[0.5, 0.08]} />
        <meshStandardMaterial color={colors.text3} transparent opacity={0.3} />
      </mesh>

      {/* Editor lines with line numbers */}
      {editorLines.map(([indent, w, y, color], i) => (
        <group key={`el${i}`}>
          {/* Line number */}
          <mesh position={[editorX - editorW / 2 + 0.15, y, 0.033]}>
            <planeGeometry args={[0.18, 0.055]} />
            <meshStandardMaterial color={colors.text3} transparent opacity={0.2} />
          </mesh>
          {/* Code line */}
          <mesh position={[editorX - editorW / 2 + 0.4 + indent + w / 2, y, 0.033]}>
            <planeGeometry args={[w, 0.065]} />
            <meshStandardMaterial color={color} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}

      {/* Divider between editor and right panels */}
      <mesh position={[editorX + editorW / 2 + 0.05, -topBar / 2 - 0.02, 0.033]}>
        <planeGeometry args={[0.01, H - topBar - 0.08]} />
        <meshStandardMaterial color={colors.accent} transparent opacity={0.3} />
      </mesh>

      {/* Right panel split: PDF top area, assistant bottom area */}
      {/* PDF "Preview" label */}
      <Text
        position={[rightX - assistantW / 4, contentTop + 0.18, 0.035]}
        fontSize={0.08}
        color={colors.text3}
        anchorX="center"
        anchorY="middle"
      >
        PREVIEW
      </Text>

      {/* PDF page background (lighter area) */}
      <mesh position={[rightX - assistantW / 4, contentTop - 1.3, 0.03]}>
        <planeGeometry args={[1.4, 2.8]} />
        <meshStandardMaterial color={colors.bgElevated} transparent opacity={0.5} />
      </mesh>

      {/* PDF content lines */}
      {pdfLines.map(([w, y, isHeader], i) => (
        <mesh key={`pl${i}`} position={[rightX - assistantW / 4, y, 0.035]}>
          <planeGeometry args={[w, isHeader ? 0.08 : 0.05]} />
          <meshStandardMaterial
            color={isHeader ? colors.text : colors.text2}
            transparent
            opacity={isHeader ? 0.5 : 0.25}
          />
        </mesh>
      ))}

      {/* Assistant panel label */}
      <Text
        position={[rightX + assistantW / 4, contentTop + 0.18, 0.035]}
        fontSize={0.08}
        color={colors.text3}
        anchorX="center"
        anchorY="middle"
      >
        ASSISTANT
      </Text>

      {/* Divider between PDF and assistant */}
      <mesh position={[rightX, -topBar / 2 - 0.02, 0.033]}>
        <planeGeometry args={[0.01, H - topBar - 0.08]} />
        <meshStandardMaterial color={colors.accent} transparent opacity={0.2} />
      </mesh>

      {/* Chat bubbles */}
      {chatBubbles.map(([w, y, isUser], i) => {
        const panelCenter = rightX + assistantW / 4;
        const panelHalf = assistantW / 4 - 0.1;
        const x = isUser
          ? panelCenter + panelHalf - w / 2
          : panelCenter - panelHalf + w / 2;
        return (
          <mesh key={`cb${i}`} position={[x, y, 0.035]}>
            <planeGeometry args={[w, isUser ? 0.18 : 0.3]} />
            <meshStandardMaterial
              color={isUser ? colors.accent : colors.bgElevated}
              transparent
              opacity={isUser ? 0.7 : 0.6}
            />
          </mesh>
        );
      })}

      {/* Bottom accent glow */}
      <mesh position={[0, -H / 2 + 0.02, 0.033]}>
        <planeGeometry args={[W - 0.3, 0.015]} />
        <meshStandardMaterial color={colors.accent} transparent opacity={0.5} emissive={colors.accent} emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export default function Hero3D() {
  const colors = useThemeColors();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 11], fov: 34 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 4, 6]} intensity={0.7} color={colors.accentInk} />
      <pointLight position={[-4, -3, 5]} intensity={0.35} color={colors.accent} />
      <directionalLight position={[0, 0, 5]} intensity={0.15} color="#ffffff" />
      <Suspense fallback={null}>
        <EditorMockup colors={colors} mouse={mouse} />
        <Environment preset="night" />
      </Suspense>
    </Canvas>
  );
}
