import { useEffect, useRef, useState } from "react";

const POS_KEY = "mt.mascot.pos";
const W = 116; // bề rộng linh vật (px)

type Pos = { x: number; y: number };

function defaultPos(): Pos {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  return { x: window.innerWidth - W - 24, y: window.innerHeight - 150 };
}

export function Mascot() {
  const [pos, setPos] = useState<Pos>(() => {
    if (typeof window === "undefined") return { x: 24, y: 24 };
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw) as Pos;
    } catch {}
    return defaultPos();
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const leftPupil = useRef<SVGGElement>(null);
  const rightPupil = useRef<SVGGElement>(null);
  const dragging = useRef(false);

  // Con ngươi nhìn theo chuột (dùng requestAnimationFrame, không re-render)
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (dragging.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const move = (fx: number, fy: number, g: SVGGElement | null) => {
          if (!g) return;
          const ex = r.left + r.width * fx;
          const ey = r.top + r.height * fy;
          const dx = e.clientX - ex;
          const dy = e.clientY - ey;
          const ang = Math.atan2(dy, dx);
          const dist = Math.min(3.6, Math.hypot(dx, dy) / 28);
          g.setAttribute("transform", `translate(${Math.cos(ang) * dist} ${Math.sin(ang) * dist})`);
        };
        move(0.41, 0.72, leftPupil.current);
        move(0.59, 0.72, rightPupil.current);
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    dragging.current = true;
    const offX = e.clientX - pos.x;
    const offY = e.clientY - pos.y;
    let last = pos;
    const onMove = (ev: PointerEvent) => {
      const maxX = window.innerWidth - W;
      const maxY = window.innerHeight - 40;
      last = {
        x: Math.max(0, Math.min(maxX, ev.clientX - offX)),
        y: Math.max(0, Math.min(maxY, ev.clientY - offY)),
      };
      setPos(last);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(last));
      } catch {}
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      ref={rootRef}
      onPointerDown={startDrag}
      title="Kéo tớ đi chỗ khác nhé!"
      className="fixed z-40 cursor-grab active:cursor-grabbing select-none touch-none mascot-float"
      style={{ left: pos.x, top: pos.y, width: W }}
    >
      <svg viewBox="0 0 200 210" width={W} className="drop-shadow-lg overflow-visible">
        <defs>
          <linearGradient id="mSack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ebbd82" />
            <stop offset="1" stopColor="#c88a4e" />
          </linearGradient>
          <linearGradient id="mRim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e6b878" />
            <stop offset="1" stopColor="#d19a5e" />
          </linearGradient>
          <linearGradient id="mWheat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe08a" />
            <stop offset="1" stopColor="#f0b429" />
          </linearGradient>
        </defs>

        {/* Lúa mì */}
        <g id="mEar">
          <path d="M0 0 C -7 -14 -7 -32 0 -60 C 7 -32 7 -14 0 0 Z" fill="url(#mWheat)" stroke="#9a6412" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M0 -10 L0 -52" stroke="#9a6412" strokeWidth="1.3" opacity="0.45" fill="none" />
        </g>
        <use href="#mEar" transform="translate(100 96) rotate(-2) scale(1.06)" />
        <use href="#mEar" transform="translate(92 96) rotate(-24) scale(0.98)" />
        <use href="#mEar" transform="translate(108 96) rotate(22) scale(0.98)" />
        <use href="#mEar" transform="translate(84 100) rotate(-44) scale(0.85)" />
        <use href="#mEar" transform="translate(116 100) rotate(40) scale(0.85)" />

        {/* Thân túi */}
        <path
          d="M42 118 C 34 158 40 196 72 202 C 90 205 110 205 128 202 C 160 196 166 158 158 118 Z"
          fill="url(#mSack)"
          stroke="#7a4a1e"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Tai/nút túi dưới */}
        <path d="M44 190 L26 202 L48 200 Z" fill="#b57c46" stroke="#7a4a1e" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M156 190 L174 202 L152 200 Z" fill="#b57c46" stroke="#7a4a1e" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Miệng túi gập */}
        <path
          d="M32 112 C 60 94 140 94 168 112 C 158 128 150 132 100 132 C 50 132 42 128 32 112 Z"
          fill="url(#mRim)"
          stroke="#7a4a1e"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Má hồng */}
        <ellipse cx="64" cy="168" rx="8" ry="5" fill="#f28c6b" opacity="0.75" />
        <ellipse cx="136" cy="168" rx="8" ry="5" fill="#f28c6b" opacity="0.75" />

        {/* Mắt */}
        <ellipse cx="82" cy="150" rx="12" ry="13" fill="#fff" stroke="#7a4a1e" strokeWidth="2" />
        <ellipse cx="118" cy="150" rx="12" ry="13" fill="#fff" stroke="#7a4a1e" strokeWidth="2" />
        <g ref={leftPupil}>
          <circle cx="82" cy="152" r="5.5" fill="#3a2a1a" />
          <circle cx="84" cy="150" r="1.7" fill="#fff" />
        </g>
        <g ref={rightPupil}>
          <circle cx="118" cy="152" r="5.5" fill="#3a2a1a" />
          <circle cx="120" cy="150" r="1.7" fill="#fff" />
        </g>

        {/* Miệng cười */}
        <path d="M86 170 Q100 184 114 170" fill="none" stroke="#5a3a1a" strokeWidth="3" strokeLinecap="round" />

        {/* Vài đốm nhỏ */}
        <circle cx="58" cy="150" r="1.4" fill="#7a4a1e" opacity="0.4" />
        <circle cx="142" cy="150" r="1.4" fill="#7a4a1e" opacity="0.4" />
      </svg>
    </div>
  );
}
