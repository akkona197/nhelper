import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DONE_KEY = "mt.tour.done";

type Step = { sel: string; title: string; body: string };

const STEPS: Step[] = [
  { sel: '[data-tour="nav-/"]', title: "Trang chủ", body: "Lời chào, câu động lực và lối tắt tới mọi mục đều ở đây." },
  { sel: '[data-tour="nav-/lich"]', title: "Tuần / Lịch", body: "Xem và kéo-thả công việc theo Ngày, 3 ngày hoặc Tuần. Tick ô tròn để đánh dấu hoàn thành." },
  { sel: '[data-tour="nav-/workload"]', title: "Workload", body: "Theo dõi khối lượng công việc để cân bằng thời gian trong tuần." },
  { sel: '[data-tour="nav-/inbox"]', title: "AI Inbox", body: "Dán tin nhắn vào đây, AI sẽ tự bóc tách thành công việc cho bạn." },
  { sel: '[data-tour="nav-/board"]', title: "Bảng ghim", body: "Ghim thông báo quan trọng, dán ảnh bằng Ctrl+V, đổi màu bảng tuỳ thích." },
  { sel: '[data-tour="nav-/feedback"]', title: "Gửi feedback", body: "Báo lỗi hoặc góp ý — mỗi phản hồi sẽ tự chuyển thành việc để đội ngũ xử lý dần." },
  { sel: '[data-tour="nav-/notifications"]', title: "Thông báo", body: "Các nhắc nhở và cập nhật quan trọng sẽ xuất hiện ở đây." },
  { sel: '[data-tour="profile"]', title: "Hồ sơ & cá nhân hoá", body: "Đổi giao diện sáng/tối, font chữ, màu, nền động, và cả linh vật Bé Lúa." },
  { sel: '[data-tour="mascot"]', title: "Bé Lúa 🌾", body: "Mình nhắc uống nước, vươn vai và cổ vũ khi bạn xong việc. Bấm vào mình bất cứ lúc nào nhé!" },
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

  // Tự chạy cho người mới + nghe sự kiện xem lại
  useEffect(() => {
    let t: number | undefined;
    const start = () => {
      const first = firstExistingFrom(0, 1);
      if (first !== null) setIdx(first);
    };
    const done = (() => {
      try {
        return localStorage.getItem(DONE_KEY) === "1";
      } catch {
        return true;
      }
    })();
    if (!done) t = window.setTimeout(start, 1400);
    const onStart = () => start();
    window.addEventListener("mt:tour-start", onStart);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mt:tour-start", onStart);
    };
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
        <div className="text-sm font-semibold mb-1">{step.title}</div>
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
