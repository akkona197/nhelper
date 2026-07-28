import { useEffect, useRef, useState } from "react";
import { usePreferences, MASCOT_SIZES } from "@/context/PreferencesContext";
import beLuaImg from "@/assets/belua.png";

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
  const dragging = useRef(false);
  const bubbleTimer = useRef<number | undefined>(undefined);

  function say(text: string, ms = 8000) {
    setBubble(text);
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms);
  }

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
        <img
          src={beLuaImg}
          alt="Bé Lúa"
          draggable={false}
          width={W}
          height={W}
          className="drop-shadow-lg pointer-events-none"
        />
      </div>
    </div>
  );
}
