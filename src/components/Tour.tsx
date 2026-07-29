import { useEffect, useLayoutEffect, useRef, useState } from "react";
import beLuaImg from "@/assets/belua.png";

const DONE_KEY = "mt.tour.done";

type Step = { sel: string; title: string; body: string };

// Lời dẫn theo giọng Bé Lúa (người hướng dẫn)
const STEPS: Step[] = [
  { sel: '[data-tour="nav-/"]', title: "Trang chủ", body: "Đây là Trang chủ — nơi mình chào bạn, có câu động lực và lối tắt tới mọi mục nha! 🏠" },
  { sel: '[data-tour="nav-/lich"]', title: "Tuần / Lịch", body: "Vào đây để xem và kéo-thả công việc theo Ngày / 3 ngày / Tuần. Tick ô tròn là mình nhảy ăn mừng đó! 🗓️" },
  { sel: '[data-tour="nav-/workload"]', title: "Workload", body: "Chỗ này giúp bạn xem khối lượng công việc để cân bằng thời gian trong tuần. 📊" },
  { sel: '[data-tour="nav-/inbox"]', title: "AI Inbox", body: "Bạn dán tin nhắn vào đây, AI sẽ tự bóc tách thành công việc giúp bạn. 🤖" },
  { sel: '[data-tour="nav-/board"]', title: "Bảng ghim", body: "Ghim thông báo quan trọng, dán ảnh bằng Ctrl+V, đổi màu bảng tuỳ thích. 📌" },
  { sel: '[data-tour="nav-/feedback"]', title: "Gửi feedback", body: "Có lỗi hay ý tưởng gì, gửi ở đây nhé — sẽ tự thành việc để đội ngũ xử lý dần. 💬" },
  { sel: '[data-tour="nav-/notifications"]', title: "Thông báo", body: "Các nhắc nhở và cập nhật quan trọng của bạn nằm ở đây. 🔔" },
  { sel: '[data-tour="profile"]', title: "Hồ sơ & cá nhân hoá", body: "Vào Hồ sơ để đổi giao diện, font chữ, màu, nền động... và cả mình nữa! 🎨" },
  { sel: '[data-tour="mascot"]', title: "Bé Lúa 🌾", body: "Còn đây là mình! Mình nhắc uống nước, vươn vai và cổ vũ khi bạn xong việc. Bấm vào mình bất cứ lúc nào nha! 💛" },
];

function firstExistingFrom(start: number, dir: 1 | -1): number | null {
  for (let i = start; i >= 0 && i < STEPS.length; i += dir) {
    if (document.querySelector(STEPS[i].sel)) return i;
  }
  return null;
}

export function Tour() {
  const [idx, setIdx] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tip, setTip] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });
  const tipRef = useRef<HTMLDivElement>(null);

  function finish() {
    setIdx(null);
    setRect(null);
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {}
  }
  function goto(next: number | null) {
    if (next === null) return finish();
    setIdx(next);
  }

  // Bắt đầu tour khi có sự kiện (từ popup chào mừng hoặc nút xem lại trong Hồ sơ)
  useEffect(() => {
    const onStart = () => {
      const first = firstExistingFrom(0, 1);
      if (first !== null) setIdx(first);
    };
    window.addEventListener("mt:tour-start", onStart);
    return () => window.removeEventListener("mt:tour-start", onStart);
  }, []);

  // Đo vị trí phần tử mục tiêu
  useEffect(() => {
    if (idx === null) return;
    const el = document.querySelector(STEPS[idx].sel) as HTMLElement | null;
    if (!el) {
      goto(firstExistingFrom(idx + 1, 1));
      return;
    }
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "Enter" || e.key === "ArrowRight") goto(firstExistingFrom(idx + 1, 1));
      else if (e.key === "ArrowLeft") goto(firstExistingFrom(idx - 1, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Đặt vị trí tooltip quanh mục tiêu
  useLayoutEffect(() => {
    if (!rect || !tipRef.current) return;
    const tw = tipRef.current.offsetWidth;
    const th = tipRef.current.offsetHeight;
    const gap = 14;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left: number;
    let top: number;
    if (rect.right + gap + tw <= vw) {
      left = rect.right + gap;
      top = rect.top + rect.height / 2 - th / 2;
    } else if (rect.left - gap - tw >= 0) {
      left = rect.left - gap - tw;
      top = rect.top + rect.height / 2 - th / 2;
    } else if (rect.bottom + gap + th <= vh) {
      left = rect.left + rect.width / 2 - tw / 2;
      top = rect.bottom + gap;
    } else {
      left = rect.left + rect.width / 2 - tw / 2;
      top = rect.top - gap - th;
    }
    left = Math.max(12, Math.min(vw - tw - 12, left));
    top = Math.max(12, Math.min(vh - th - 12, top));
    setTip({ left, top });
  }, [rect, idx]);

  if (idx === null || !rect) return null;

  const step = STEPS[idx];
  const pad = 8;
  const prev = firstExistingFrom(idx - 1, -1);
  const next = firstExistingFrom(idx + 1, 1);
  const stepNo = STEPS.slice(0, idx + 1).filter((s) => document.querySelector(s.sel)).length;
  const total = STEPS.filter((s) => document.querySelector(s.sel)).length;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      {/* Spotlight: khoanh sáng phần tử, làm tối xung quanh */}
      <div
        className="absolute rounded-xl transition-all duration-200 ease-out"
        style={{
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 3px var(--color-primary), 0 0 0 9999px rgba(0,0,0,0.62)",
        }}
      />

      {/* Tooltip */}
      <div
        ref={tipRef}
        className="absolute w-[288px] max-w-[86vw] pointer-events-auto rounded-xl border bg-card text-card-foreground shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200"
        style={{ left: tip.left, top: tip.top }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <img src={beLuaImg} alt="Bé Lúa" draggable={false} className="size-8 shrink-0 pointer-events-none" />
          <div className="text-sm font-semibold">{step.title}</div>
        </div>
        <div className="text-sm text-muted-foreground leading-snug">{step.body}</div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={finish} className="text-xs text-muted-foreground hover:text-foreground">
            Bỏ qua
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {stepNo}/{total}
            </span>
            {prev !== null && (
              <button
                onClick={() => goto(prev)}
                className="text-xs rounded-md border border-border px-2.5 py-1 hover:bg-secondary"
              >
                Trước
              </button>
            )}
            <button
              onClick={() => goto(next)}
              className="text-xs font-semibold rounded-md bg-primary text-primary-foreground px-3 py-1 hover:opacity-90"
            >
              {next === null ? "Xong" : "Tiếp"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
