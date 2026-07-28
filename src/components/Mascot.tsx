import { useEffect, useRef, useState } from "react";
import { usePreferences, MASCOT_SIZES } from "@/context/PreferencesContext";

const POS_KEY = "mt.mascot.pos";

type Pos = { x: number; y: number };

// Nhắc nhở dân văn phòng (đổi mỗi ~1 phút)
const REMINDERS = [
  "Uống một ngụm nước nào! 💧",
  "Đứng dậy vươn vai một chút nhé! 🙆",
  "Nhìn ra xa 20 giây cho mắt đỡ mỏi 👀",
  "Ngồi thẳng lưng lại nào 🪑",
  "Hít thở sâu, thả lỏng vai gáy 😮‍💨",
  "Đi lại vài bước cho giãn cơ 🚶",
  "Chớp mắt vài cái cho đỡ khô mắt nhé 👁️",
  "Xoay cổ tay, duỗi ngón tay chút nào ✋",
  "Nghỉ tay 1 phút rồi làm tiếp nha ☕",
  "Uống đủ nước giúp tập trung hơn đó! 💧",
  "Bạn đang làm rất tốt, cố lên nhé! 😊",
  "Thư giãn mắt: nhìn cây xanh 20 giây 🌿",
];
const CHEERS = ["Tuyệt vời! Xong một việc rồi 🎉", "Giỏi quá đi! ✨", "Yeah! Tick thêm một ô 💪", "Làm tốt lắm! 👏"];

function defaultPos(w: number): Pos {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  return { x: window.innerWidth - w - 24, y: window.innerHeight - w - 40 };
}

export function Mascot() {
  const { mascotOn, mascotSize } = usePreferences();
  const W = MASCOT_SIZES[mascotSize]?.w ?? 116;

  const [pos, setPos] = useState<Pos>(() => {
    if (typeof window === "undefined") return { x: 24, y: 24 };
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw) as Pos;
    } catch {}
    return defaultPos(116);
  });
  const [bubble, setBubble] = useState<string | null>(null);
  const [anim, setAnim] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const leftPupil = useRef<SVGGElement>(null);
  const rightPupil = useRef<SVGGElement>(null);
  const dragging = useRef(false);
  const bubbleTimer = useRef<number | undefined>(undefined);

  function say(text: string, ms = 8000) {
    setBubble(text);
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  }

  // Con ngươi nhìn theo chuột
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
          const ang = Math.atan2(e.clientY - ey, e.clientX - ex);
          const dist = Math.min(3.6, Math.hypot(e.clientX - ex, e.clientY - ey) / 28);
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

  // Nhắc nhở mỗi ~1 phút + lời chào ban đầu
  useEffect(() => {
    if (!mascotOn) return;
    const hi = window.setTimeout(() => say("Chào bạn, mình là Bé Lúa! Cùng làm việc nhé 🌾", 7000), 4000);
    const iv = window.setInterval(() => {
      if (dragging.current) return;
      say(REMINDERS[Math.floor(Math.random() * REMINDERS.length)]);
    }, 60000);
    return () => {
      window.clearTimeout(hi);
      window.clearInterval(iv);
      window.clearTimeout(bubbleTimer.current);
    };
  }, [mascotOn]);

  // Nhảy ăn mừng khi hoàn thành task
  useEffect(() => {
    const onDone = () => {
      setAnim("mascot-jump");
      window.setTimeout(() => setAnim(""), 700);
      say(CHEERS[Math.floor(Math.random() * CHEERS.length)], 5000);
    };
    window.addEventListener("mt:taskdone", onDone);
    return () => window.removeEventListener("mt:taskdone", onDone);
  }, []);

  // Lắc/nhún nhẹ định kỳ (như chớp mắt/cựa quậy)
  useEffect(() => {
    if (!mascotOn) return;
    const iv = window.setInterval(() => {
      if (dragging.current || anim) return;
      setAnim("mascot-wiggle");
      window.setTimeout(() => setAnim(""), 800);
    }, 18000);
    return () => window.clearInterval(iv);
  }, [mascotOn, anim]);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    dragging.current = true;
    const offX = e.clientX - pos.x;
    const offY = e.clientY - pos.y;
    let last = pos;
    const onMove = (ev: PointerEvent) => {
      last = {
        x: Math.max(0, Math.min(window.innerWidth - W, ev.clientX - offX)),
        y: Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - offY)),
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

  if (!mascotOn) return null;

  return (
    <div
      ref={rootRef}
      className="fixed z-40 select-none touch-none"
      style={{ left: pos.x, top: pos.y, width: W }}
    >
      {bubble && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] animate-in fade-in slide-in-from-bottom-1 duration-300">
          <div className="relative rounded-2xl bg-card border shadow-lg px-3 py-2 text-xs text-center text-foreground">
            {bubble}
            <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px size-2 rotate-45 bg-card border-b border-r" />
          </div>
        </div>
      )}

      <div
        onPointerDown={startDrag}
        title="Bé Lúa — kéo tớ đi chỗ khác nhé!"
        className={`cursor-grab active:cursor-grabbing mascot-float ${anim}`}
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

          <g id="mEar">
            <path d="M0 0 C -7 -14 -7 -32 0 -60 C 7 -32 7 -14 0 0 Z" fill="url(#mWheat)" stroke="#9a6412" strokeWidth="2.4" strokeLinejoin="round" />
            <path d="M0 -10 L0 -52" stroke="#9a6412" strokeWidth="1.3" opacity="0.45" fill="none" />
          </g>
          <use href="#mEar" transform="translate(100 96) rotate(-2) scale(1.06)" />
          <use href="#mEar" transform="translate(92 96) rotate(-24) scale(0.98)" />
          <use href="#mEar" transform="translate(108 96) rotate(22) scale(0.98)" />
          <use href="#mEar" transform="translate(84 100) rotate(-44) scale(0.85)" />
          <use href="#mEar" transform="translate(116 100) rotate(40) scale(0.85)" />

          <path d="M42 118 C 34 158 40 196 72 202 C 90 205 110 205 128 202 C 160 196 166 158 158 118 Z" fill="url(#mSack)" stroke="#7a4a1e" strokeWidth="3" strokeLinejoin="round" />
          <path d="M44 190 L26 202 L48 200 Z" fill="#b57c46" stroke="#7a4a1e" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M156 190 L174 202 L152 200 Z" fill="#b57c46" stroke="#7a4a1e" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M32 112 C 60 94 140 94 168 112 C 158 128 150 132 100 132 C 50 132 42 128 32 112 Z" fill="url(#mRim)" stroke="#7a4a1e" strokeWidth="3" strokeLinejoin="round" />

          <ellipse cx="64" cy="168" rx="8" ry="5" fill="#f28c6b" opacity="0.75" />
          <ellipse cx="136" cy="168" rx="8" ry="5" fill="#f28c6b" opacity="0.75" />

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

          <path d="M86 170 Q100 184 114 170" fill="none" stroke="#5a3a1a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="58" cy="150" r="1.4" fill="#7a4a1e" opacity="0.4" />
          <circle cx="142" cy="150" r="1.4" fill="#7a4a1e" opacity="0.4" />
        </svg>
      </div>
    </div>
  );
}
