import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Pin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type BoardNote = {
  id: string;
  body: string;
  color: string;
  pin: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  image_url: string | null;
};

const db = supabase as unknown as { from: (t: string) => any };

export const Route = createFileRoute("/board")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <BoardPage />
      </AppShell>
    </RequireAuth>
  ),
});

const SELECT_COLS = "id, body, color, pin, x, y, rotation, width, height, image_url";
const MIN_W = 140;
const MIN_H = 90;
const STYLE_KEY = "mt.board.style";

// Màu giấy note: nền, chữ, viền
const COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  yellow: { bg: "#fef9c3", text: "#713f12", border: "#fde047", label: "Vàng" },
  pink: { bg: "#fbcfe8", text: "#831843", border: "#f9a8d4", label: "Hồng" },
  white: { bg: "#ffffff", text: "#1f2937", border: "#e5e7eb", label: "Trắng" },
  green: { bg: "#bbf7d0", text: "#14532d", border: "#86efac", label: "Xanh lá" },
  blue: { bg: "#bae6fd", text: "#0c4a6e", border: "#7dd3fc", label: "Xanh dương" },
  orange: { bg: "#fed7aa", text: "#7c2d12", border: "#fdba74", label: "Cam" },
};
const COLOR_KEYS = Object.keys(COLORS);

// Màu đầu ghim
const PINS: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
};
const PIN_KEYS = Object.keys(PINS);

// 6 kiểu bảng (lưu localStorage)
type StyleDef = { label: string; background: string; felt: boolean; emptyText: string; swatch: string; hologram?: boolean };
const BOARD_STYLES: Record<string, StyleDef> = {
  blue: { label: "Xanh dương", background: "radial-gradient(circle at 30% 20%, #2563eb 0%, #1e40af 55%, #1e3a8a 100%)", felt: true, emptyText: "text-white/80", swatch: "#1e40af" },
  green: { label: "Xanh lá", background: "radial-gradient(circle at 30% 20%, #16a34a 0%, #15803d 55%, #14532d 100%)", felt: true, emptyText: "text-white/80", swatch: "#15803d" },
  cork: { label: "Nút bần", background: "radial-gradient(circle at 30% 20%, #d8b384 0%, #c69c6d 55%, #a97c50 100%)", felt: false, emptyText: "text-black/60", swatch: "#c69c6d" },
  slate: { label: "Xám đá", background: "radial-gradient(circle at 30% 20%, #334155 0%, #1e293b 55%, #0f172a 100%)", felt: true, emptyText: "text-white/80", swatch: "#1e293b" },
  purple: { label: "Tím than", background: "radial-gradient(circle at 30% 20%, #7c3aed 0%, #6d28d9 55%, #4c1d95 100%)", felt: true, emptyText: "text-white/80", swatch: "#6d28d9" },
  hologram: { label: "Hologram", background: "", felt: false, emptyText: "text-white/90", swatch: "linear-gradient(125deg,#0ea5e9,#8b5cf6,#ec4899,#22d3ee)", hologram: true },
};
const STYLE_KEYS = Object.keys(BOARD_STYLES);

// Nén ảnh dán vào (giảm dung lượng), trả về data URL + kích thước hiển thị
function processImage(file: File): Promise<{ url: string; w: number; h: number }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const cw = Math.max(1, Math.round(img.width * scale));
        const ch = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve({ url: src, w: 220, h: 160 });
        ctx.drawImage(img, 0, 0, cw, ch);
        const url = canvas.toDataURL("image/jpeg", 0.82);
        // Kích thước note: rộng ~230, cao theo tỉ lệ
        const dispW = 230;
        const dispH = Math.round(dispW * (ch / cw)) + 28; // +28 cho chỗ gõ chú thích
        resolve({ url, w: dispW, h: Math.max(MIN_H, Math.min(420, dispH)) });
      };
      img.onerror = () => resolve({ url: src, w: 220, h: 160 });
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function BoardPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<BoardNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [boardStyle, setBoardStyle] = useState<string>(() => {
    if (typeof window === "undefined") return "blue";
    const s = localStorage.getItem(STYLE_KEY);
    return s && BOARD_STYLES[s] ? s : "blue";
  });
  const boardRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<BoardNote[]>([]);
  notesRef.current = notes;

  const style = BOARD_STYLES[boardStyle] ?? BOARD_STYLES.blue;

  function changeStyle(k: string) {
    setBoardStyle(k);
    if (typeof window !== "undefined") localStorage.setItem(STYLE_KEY, k);
  }

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await db
      .from("board_notes")
      .select(SELECT_COLS)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotes((data ?? []) as BoardNote[]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Đóng popup phóng to ảnh bằng phím Esc
  useEffect(() => {
    if (!zoomUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomUrl(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomUrl]);

  const addNote = useCallback(
    async (extra?: Partial<BoardNote>) => {
      if (!user) return;
      const count = notesRef.current.length;
      const base = {
        user_id: user.id,
        body: "",
        color: COLOR_KEYS[count % COLOR_KEYS.length],
        pin: PIN_KEYS[count % PIN_KEYS.length],
        x: 32 + (count % 6) * 36,
        y: 32 + (count % 6) * 32,
        rotation: Math.round((Math.random() * 6 - 3) * 10) / 10,
        width: 200,
        height: 140,
        image_url: null,
      };
      const { data, error } = await db
        .from("board_notes")
        .insert({ ...base, ...extra })
        .select(SELECT_COLS)
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setNotes((n) => [...n, data as BoardNote]);
    },
    [user],
  );

  async function updateNote(id: string, patch: Partial<BoardNote>) {
    setNotes((n) => n.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await db.from("board_notes").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function removeNote(id: string) {
    setNotes((n) => n.filter((x) => x.id !== id));
    const { error } = await db.from("board_notes").delete().eq("id", id);
    if (error) toast.error(error.message);
  }

  // Ctrl+V dán ảnh: có textarea đang focus -> gắn vào note đó; không -> tạo note ảnh mới
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
      const imgItem = items.find((it) => it.type.startsWith("image/"));
      if (!imgItem) return; // để dán chữ hoạt động bình thường
      const file = imgItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      const { url, w, h } = await processImage(file);
      const active = document.activeElement as HTMLElement | null;
      const noteId = active && active.tagName === "TEXTAREA" ? active.dataset.noteId : undefined;
      if (noteId) {
        updateNote(noteId, { image_url: url });
      } else {
        await addNote({ image_url: url, width: w, height: h, color: "white" });
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addNote]);

  // Kéo di chuyển note bằng đầu ghim
  function startDrag(note: BoardNote, e: React.PointerEvent) {
    e.preventDefault();
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const offX = e.clientX - rect.left - note.x;
    const offY = e.clientY - rect.top - note.y;
    let last = { x: note.x, y: note.y };
    const onMove = (ev: PointerEvent) => {
      const r = board.getBoundingClientRect();
      const nx = Math.max(0, Math.min(r.width - note.width, ev.clientX - r.left - offX));
      const ny = Math.max(0, Math.min(r.height - 48, ev.clientY - r.top - offY));
      last = { x: Math.round(nx), y: Math.round(ny) };
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, x: last.x, y: last.y } : n)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      db.from("board_notes").update({ x: last.x, y: last.y }).eq("id", note.id).then(() => {});
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Kéo góc dưới-phải để đổi kích cỡ
  function startResize(note: BoardNote, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const startW = note.width;
    const startH = note.height;
    let last = { w: startW, h: startH };
    const onMove = (ev: PointerEvent) => {
      const nw = Math.max(MIN_W, Math.min(560, startW + (ev.clientX - sx)));
      const nh = Math.max(MIN_H, Math.min(640, startH + (ev.clientY - sy)));
      last = { w: Math.round(nw), h: Math.round(nh) };
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, width: last.w, height: last.h } : n)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      db.from("board_notes").update({ width: last.w, height: last.h }).eq("id", note.id).then(() => {});
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="p-6">
      <style>{`
        @keyframes mtHoloShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        .mt-holo { background: linear-gradient(125deg,#0ea5e9,#8b5cf6,#ec4899,#22d3ee,#0ea5e9); background-size: 300% 300%; animation: mtHoloShift 14s ease infinite; }
        .mt-holo::after { content:""; position:absolute; inset:0; pointer-events:none; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 4px); mix-blend-mode: overlay; }
      `}</style>

      <header className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Pin className="size-6 text-primary" /> Bảng ghim
          </h1>
          <p className="text-sm text-muted-foreground">
            Kéo đầu ghim để di chuyển • kéo góc dưới-phải để đổi kích cỡ • Ctrl+V để dán ảnh (vào note đang gõ hoặc ra nền để tạo note ảnh).
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-0.5">Kiểu bảng:</span>
            {STYLE_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => changeStyle(k)}
                title={BOARD_STYLES[k].label}
                className={`size-6 rounded-full border border-black/10 transition-transform hover:scale-110 ${
                  boardStyle === k ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
                }`}
                style={{ background: BOARD_STYLES[k].swatch }}
              />
            ))}
          </div>
          <Button onClick={() => addNote()} className="gap-1.5">
            <Plus className="size-4" /> Thêm ghi chú
          </Button>
        </div>
      </header>

      {/* Khung nhôm + bảng */}
      <div className="rounded-2xl p-2.5 bg-gradient-to-b from-neutral-300 to-neutral-400 shadow-xl">
        <div
          ref={boardRef}
          className={`relative rounded-lg overflow-hidden ${style.hologram ? "mt-holo" : ""}`}
          style={{
            minHeight: "70vh",
            ...(style.hologram ? {} : { background: style.background }),
            boxShadow: "inset 0 2px 24px rgba(0,0,0,0.35)",
          }}
        >
          {/* Vân nỉ */}
          {style.felt && (
            <div
              className="absolute inset-0 opacity-[0.12] pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 3px)",
              }}
            />
          )}

          {loading && (
            <div className={`absolute inset-0 flex items-center justify-center text-sm ${style.emptyText}`}>
              Đang tải bảng ghim...
            </div>
          )}
          {!loading && notes.length === 0 && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${style.emptyText}`}>
              <Pin className="size-8" />
              <div className="text-sm">Chưa có ghi chú nào. Bấm “Thêm ghi chú” hoặc Ctrl+V để dán ảnh.</div>
            </div>
          )}

          {notes.map((n) => {
            const c = COLORS[n.color] ?? COLORS.yellow;
            const pinColor = PINS[n.pin] ?? PINS.red;
            return (
              <div
                key={n.id}
                data-note
                className="absolute group"
                style={{
                  left: n.x,
                  top: n.y,
                  width: n.width,
                  height: n.height,
                  transform: `rotate(${n.rotation}deg)`,
                }}
              >
                {/* Đầu ghim = tay kéo di chuyển */}
                <div
                  onPointerDown={(e) => startDrag(n, e)}
                  title="Kéo để di chuyển"
                  className="absolute left-1/2 -top-2.5 -translate-x-1/2 z-10 cursor-grab active:cursor-grabbing"
                >
                  <div
                    className="size-5 rounded-full shadow-md ring-2 ring-black/10"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, #ffffffcc 0%, ${pinColor} 45%, ${pinColor} 100%)`,
                    }}
                  />
                </div>

                {/* Giấy note */}
                <div
                  className="h-full flex flex-col rounded-sm shadow-lg pt-4 pb-2 px-3 overflow-hidden"
                  style={{
                    background: c.bg,
                    color: c.text,
                    border: `1px solid ${c.border}`,
                    boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
                  }}
                >
                  {n.image_url && (
                    <img
                      src={n.image_url}
                      alt=""
                      draggable={false}
                      onDoubleClick={() => setZoomUrl(n.image_url)}
                      title="Nhấn đúp để phóng to"
                      className="w-full rounded-sm mb-1 select-none shrink-0 object-cover cursor-zoom-in"
                      style={{ maxHeight: "72%" }}
                    />
                  )}
                  <textarea
                    data-note-id={n.id}
                    value={n.body}
                    onChange={(e) =>
                      setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, body: e.target.value } : x)))
                    }
                    onBlur={(e) => updateNote(n.id, { body: e.target.value })}
                    placeholder={n.image_url ? "Chú thích..." : "Viết thông báo..."}
                    className="flex-1 w-full resize-none bg-transparent outline-none text-sm leading-snug placeholder:opacity-50"
                    style={{ color: c.text }}
                  />

                  {/* Thanh công cụ khi hover */}
                  <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {COLOR_KEYS.map((ck) => (
                      <button
                        key={ck}
                        onClick={() => updateNote(n.id, { color: ck })}
                        title={COLORS[ck].label}
                        className={`size-3.5 rounded-full border ${n.color === ck ? "ring-2 ring-black/40" : ""}`}
                        style={{ background: COLORS[ck].bg, borderColor: COLORS[ck].border }}
                      />
                    ))}
                    {n.image_url && (
                      <button
                        onClick={() => updateNote(n.id, { image_url: null })}
                        title="Bỏ ảnh"
                        className="text-[10px] text-black/40 hover:text-black/70"
                      >
                        bỏ ảnh
                      </button>
                    )}
                    <button
                      onClick={() => removeNote(n.id)}
                      title="Xoá ghi chú"
                      className="ml-auto text-black/40 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Góc kéo đổi kích cỡ */}
                <div
                  onPointerDown={(e) => startResize(n, e)}
                  title="Kéo để đổi kích cỡ"
                  className="absolute bottom-0 right-0 size-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 z-10"
                  style={{ background: "linear-gradient(135deg, transparent 45%, rgba(0,0,0,0.35) 45%)" }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup phóng to ảnh (nhấn đúp vào ảnh trong note) */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8"
          onClick={() => setZoomUrl(null)}
        >
          <button
            onClick={() => setZoomUrl(null)}
            title="Đóng (Esc)"
            className="absolute top-4 right-4 size-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-xl leading-none"
          >
            ✕
          </button>
          <img
            src={zoomUrl}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-md shadow-2xl select-none"
          />
        </div>
      )}
    </div>
  );
}
