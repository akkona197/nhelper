import { useEffect, useRef, useState } from "react";
import { usePreferences, MASCOT_SIZES } from "@/context/PreferencesContext";
import beLuaImg from "@/assets/belua.png";

const POS_KEY = "mt.mascot.pos";

type Pos = { x: number; y: number };

// Nhắc nhở dân văn phòng (đổi mỗi ~1 phút và khi click)
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
  "Thư giãn mắt: nhìn cây xanh 20 giây 🌿",
];
const ENCOURAGE = [
  "Bạn đang làm rất tốt, cố lên nhé! 😊",
  "Từng bước nhỏ cũng là tiến bộ 💪",
  "Tin ở bản thân nha, bạn làm được! ✨",
  "Kiên trì chút nữa thôi là xong! 🌟",
  "Mình luôn ở đây cổ vũ bạn 🌾",
];
const CLICK_MSGS = [...REMINDERS, ...ENCOURAGE];
const CHEERS = ["Tuyệt vời! Xong một việc rồi 🎉", "Giỏi quá đi! ✨", "Yeah! Tick thêm một ô 💪", "Làm tốt lắm! 👏"];

function pick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

  // Con ngươi nhìn theo chuột (đôi mắt vẽ đè lên ảnh)
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
          const dist = Math.min(20, Math.hypot(e.clientX - ex, e.clientY - ey) / 8);
          g.setAttribute("transform", `translate(${Math.cos(ang) * dist} ${Math.sin(ang) * dist})`);
        };
        move(0.449, 0.684, leftPupil.current);
        move(0.625, 0.684, rightPupil.current);
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
      say(pick(REMINDERS));
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
      say(pick(CHEERS), 5000);
    };
    window.addEventListener("mt:taskdone", onDone);
    return () => window.removeEventListener("mt:taskdone", onDone);
  }, []);

  // Lắc/nhún nhẹ định kỳ
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
    const startX = e.clientX;
    const startY = e.clientY;
    const offX = e.clientX - pos.x;
    const offY = e.clientY - pos.y;
    let last = pos;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) moved = true;
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
      if (moved) {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(last));
        } catch {}
      } else {
        // Click (không kéo) -> hiện câu nhắc nhở/động viên
        setAnim("mascot-wiggle");
        window.setTimeout(() => setAnim(""), 800);
        say(pick(CLICK_MSGS), 6000);
      }
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
        title="Bé Lúa — kéo tớ đi, hoặc bấm để nghe lời nhắn nhé!"
        className={`relative cursor-grab active:cursor-grabbing mascot-float ${anim}`}
        style={{ width: W, height: W }}
      >
        <img
          src={beLuaImg}
          alt="Bé Lúa"
          draggable={false}
          width={W}
          height={W}
          className="drop-shadow-lg pointer-events-none block"
        />
        {/* Đôi mắt động vẽ đè lên ảnh */}
        <svg viewBox="0 0 1024 1024" className="absolute inset-0 pointer-events-none" width={W} height={W}>
          <ellipse cx="458" cy="698" rx="44" ry="52" fill="#fdf6ec" stroke="#4a3320" strokeWidth="6" />
          <ellipse cx="642" cy="698" rx="44" ry="52" fill="#fdf6ec" stroke="#4a3320" strokeWidth="6" />
          <g ref={leftPupil}>
            <circle cx="458" cy="704" r="23" fill="#2a1c10" />
            <circle cx="466" cy="695" r="8" fill="#fff" />
          </g>
          <g ref={rightPupil}>
            <circle cx="642" cy="704" r="23" fill="#2a1c10" />
            <circle cx="650" cy="695" r="8" fill="#fff" />
          </g>
        </svg>
      </div>
    </div>
  );
}
