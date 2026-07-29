import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import beLuaImg from "@/assets/belua.png";
import { MessageSquare, X } from "lucide-react";

const WELCOME_KEY = "mt.welcome.done";

export function Welcome() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let done = true;
    try {
      done = localStorage.getItem(WELCOME_KEY) === "1";
    } catch {}
    if (!done) {
      const t = window.setTimeout(() => setOpen(true), 700);
      return () => window.clearTimeout(t);
    }
  }, []);

  function markDone() {
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch {}
    setOpen(false);
  }

  // Đóng popup -> mở tour hướng dẫn (Bé Lúa dẫn đường)
  function startTour() {
    markDone();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("mt:tour-start")), 250);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={startTour} />
      <div className="relative w-full max-w-md rounded-2xl border bg-card text-card-foreground shadow-2xl p-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <button
          onClick={startTour}
          title="Đóng"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <img src={beLuaImg} alt="Bé Lúa" draggable={false} className="w-24 h-24 mx-auto drop-shadow-lg pointer-events-none" />

        <h2 className="mt-2 text-xl font-bold tracking-tight">Chào bạn! Mình là Bé Lúa 🌾</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Bạn là một trong những <span className="font-semibold text-foreground">người đầu tiên</span> trải nghiệm{" "}
          <span className="font-semibold text-foreground">Master Task</span>! 🎉 Sản phẩm đang trong giai đoạn hoàn thiện,
          nên mọi góp ý của bạn đều cực kỳ quý giá với tụi mình.
        </p>

        <button
          onClick={startTour}
          className="mt-5 w-full rounded-lg grad-primary text-primary-foreground font-semibold py-2.5 hover:opacity-90 transition-opacity"
        >
          Khám phá cùng Bé Lúa →
        </button>

        <Link
          to="/feedback"
          onClick={markDone}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
        >
          <MessageSquare className="size-4" /> Hoặc gửi góp ý cho tụi mình
        </Link>
      </div>
    </div>
  );
}
