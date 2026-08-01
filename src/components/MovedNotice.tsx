import { useEffect, useRef, useState } from "react";
import beLuaImg from "@/assets/belua.png";

const NEW_URL = "https://master-task.akkona197.workers.dev";

export function MovedNotice() {
  const boxRef = useRef<HTMLDivElement>(null);
  const leftPupil = useRef<SVGGElement>(null);
  const rightPupil = useRef<SVGGElement>(null);
  const [sorry, setSorry] = useState(false);

  // Con ngươi nhìn theo chuột
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = boxRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const move = (fx: number, fy: number, g: SVGGElement | null) => {
          if (!g) return;
          const ex = r.left + r.width * fx;
          const ey = r.top + r.height * fy;
          const ang = Math.atan2(e.clientY - ey, e.clientX - ex);
          const dist = Math.min(22, Math.hypot(e.clientX - ex, e.clientY - ey) / 7);
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-background text-foreground">
      <div
        ref={boxRef}
        onClick={() => setSorry(true)}
        title="Bấm vào Bé Lúa"
        className="relative w-40 h-40 mb-4 cursor-pointer select-none"
      >
        <img src={beLuaImg} alt="Bé Lúa" draggable={false} className="w-40 h-40 drop-shadow-lg pointer-events-none" />
        {/* Đôi mắt to nhìn theo chuột */}
        <svg viewBox="0 0 1024 1024" className="absolute inset-0 pointer-events-none" width={160} height={160}>
          <ellipse cx="458" cy="698" rx="48" ry="56" fill="#fdf6ec" stroke="#4a3320" strokeWidth="6" />
          <ellipse cx="642" cy="698" rx="48" ry="56" fill="#fdf6ec" stroke="#4a3320" strokeWidth="6" />
          <g ref={leftPupil}>
            <circle cx="458" cy="706" r="25" fill="#2a1c10" />
            <circle cx="467" cy="696" r="9" fill="#fff" />
          </g>
          <g ref={rightPupil}>
            <circle cx="642" cy="706" r="25" fill="#2a1c10" />
            <circle cx="651" cy="696" r="9" fill="#fff" />
          </g>
        </svg>
      </div>

      {sorry && (
        <div className="mb-3 rounded-2xl border bg-card shadow px-4 py-2 text-sm font-medium text-foreground animate-in fade-in zoom-in-95 duration-200">
          Bé Lúa xin lỗi vì sự bất tiện này 🙏
        </div>
      )}

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bé Lúa đã chuyển nhà! 🌾</h1>
      <p className="mt-3 text-muted-foreground max-w-md">
        Master Task đã dời sang địa chỉ mới. Trang cũ này không còn dùng nữa nhé.
      </p>

      <a
        href={NEW_URL}
        className="mt-6 inline-flex items-center gap-2 rounded-xl grad-primary text-primary-foreground font-semibold px-6 py-3 text-lg shadow-lg hover:opacity-90 transition-opacity"
      >
        Đi tới trang mới →
      </a>

      <p className="mt-4 text-sm text-muted-foreground">
        Đăng nhập bằng <b className="text-foreground">email và mật khẩu cũ</b> của bạn.
      </p>
      <p className="mt-1 text-xs text-muted-foreground break-all">master-task.akkona197.workers.dev</p>
    </div>
  );
}
