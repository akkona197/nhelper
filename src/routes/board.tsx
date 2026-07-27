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

const NOTE_W = 200;

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

function BoardPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<BoardNote[]>([]);
  const [loading, setLoading] = useState(true);
  const boardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await db
      .from("board_notes")
      .select("id, body, color, pin, x, y, rotation")
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

  async function addNote() {
    if (!user) return;
    const count = notes.length;
    const color = COLOR_KEYS[count % COLOR_KEYS.length];
    const pin = PIN_KEYS[count % PIN_KEYS.length];
    const x = 32 + (count % 6) * 36;
    const y = 32 + (count % 6) * 32;
    const rotation = Math.round((Math.random() * 6 - 3) * 10) / 10;
    const { data, error } = await db
      .from("board_notes")
      .insert({ user_id: user.id, body: "", color, pin, x, y, rotation })
      .select("id, body, color, pin, x, y, rotation")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotes((n) => [...n, data as BoardNote]);
  }

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

  // Kéo thả note bằng đầu ghim
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
      const nx = Math.max(0, Math.min(r.width - NOTE_W, ev.clientX - r.left - offX));
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

  return (
    <div className="p-6">
      <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Pin className="size-6 text-primary" /> Bảng ghim
          </h1>
          <p className="text-sm text-muted-foreground">
            Ghim lại các thông báo cần thiết. Kéo đầu ghim để di chuyển, bấm vào giấy để sửa nội dung.
          </p>
        </div>
        <Button onClick={addNote} className="gap-1.5">
          <Plus className="size-4" /> Thêm ghi chú
        </Button>
      </header>

      {/* Khung nhôm + bảng nỉ xanh */}
      <div className="rounded-2xl p-2.5 bg-gradient-to-b from-neutral-300 to-neutral-400 shadow-xl">
        <div
          ref={boardRef}
          className="relative rounded-lg overflow-hidden"
          style={{
            minHeight: "70vh",
            background:
              "radial-gradient(circle at 30% 20%, #2563eb 0%, #1e40af 55%, #1e3a8a 100%)",
            boxShadow: "inset 0 2px 24px rgba(0,0,0,0.35)",
          }}
        >
          {/* Vân nỉ */}
          <div
            className="absolute inset-0 opacity-[0.12] pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 3px)",
            }}
          />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
              Đang tải bảng ghim...
            </div>
          )}
          {!loading && notes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-2">
              <Pin className="size-8" />
              <div className="text-sm">Chưa có ghi chú nào. Bấm “Thêm ghi chú” để ghim thông báo đầu tiên.</div>
            </div>
          )}

          {notes.map((n) => {
            const c = COLORS[n.color] ?? COLORS.yellow;
            const pinColor = PINS[n.pin] ?? PINS.red;
            return (
              <div
                key={n.id}
                className="absolute group"
                style={{
                  left: n.x,
                  top: n.y,
                  width: NOTE_W,
                  transform: `rotate(${n.rotation}deg)`,
                }}
              >
                {/* Đầu ghim = tay kéo */}
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
                  className="rounded-sm shadow-lg pt-4 pb-2 px-3"
                  style={{
                    background: c.bg,
                    color: c.text,
                    border: `1px solid ${c.border}`,
                    boxShadow: "0 6px 14px rgba(0,0,0,0.25)",
                  }}
                >
                  <textarea
                    value={n.body}
                    onChange={(e) =>
                      setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, body: e.target.value } : x)))
                    }
                    onBlur={(e) => updateNote(n.id, { body: e.target.value })}
                    placeholder="Viết thông báo..."
                    rows={4}
                    className="w-full resize-none bg-transparent outline-none text-sm leading-snug placeholder:opacity-50"
                    style={{ color: c.text }}
                  />

                  {/* Thanh công cụ khi hover */}
                  <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {COLOR_KEYS.map((ck) => (
                      <button
                        key={ck}
                        onClick={() => updateNote(n.id, { color: ck })}
                        title={COLORS[ck].label}
                        className={`size-3.5 rounded-full border ${n.color === ck ? "ring-2 ring-black/40" : ""}`}
                        style={{ background: COLORS[ck].bg, borderColor: COLORS[ck].border }}
                      />
                    ))}
                    <button
                      onClick={() => removeNote(n.id)}
                      title="Xoá ghi chú"
                      className="ml-auto text-black/40 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
