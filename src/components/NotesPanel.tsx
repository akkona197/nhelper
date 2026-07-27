import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { fmtDate, type InstanceRow, type TaskRow } from "@/lib/scheduling";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { vi } from "date-fns/locale";
import { RichEditor } from "@/components/RichEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Send } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskRow | null;
  date: Date | null;
  instance?: InstanceRow | null;
  onSaved?: () => void;
};

type NoteRow = {
  id: string;
  author_name: string;
  author_role: string | null;
  body: string;
  created_at: string;
  scheduled_date: string | null;
};

const db = supabase as unknown as {
  from: (t: string) => any;
};

const AVATAR_COLORS = [
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-violet-500",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function stamp(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `Hôm nay, ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Hôm qua, ${format(d, "HH:mm")}`;
  return format(d, "dd/MM, HH:mm", { locale: vi });
}

export function NotesPanel({ open, onOpenChange, task, date, instance, onSaved }: Props) {
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [sending, setSending] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const defaultName = profile?.display_name || user?.email?.split("@")[0] || "Tôi";

  const load = useCallback(async () => {
    if (!task) return;
    setLoading(true);
    const { data, error } = await db
      .from("task_notes")
      .select("id, author_name, author_role, body, created_at, scheduled_date")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotes((data ?? []) as NoteRow[]);
  }, [task]);

  useEffect(() => {
    if (!open) return;
    setDraft("");
    setEditorKey((k) => k + 1);
    setAuthorName(defaultName);
    setAuthorRole("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [notes, open]);

  function isEmpty(html: string) {
    return !html.replace(/<[^>]*>/g, "").trim() && !html.includes("<img");
  }

  async function send() {
    if (!user || !task || isEmpty(draft)) return;
    setSending(true);
    const { error } = await db.from("task_notes").insert({
      user_id: user.id,
      task_id: task.id,
      scheduled_date: date ? fmtDate(date) : null,
      author_name: authorName.trim() || defaultName,
      author_role: authorRole.trim() || null,
      body: draft,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    setEditorKey((k) => k + 1);
    await load();
    onSaved?.();
  }

  async function remove(id: string) {
    const { error } = await db.from("task_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setNotes((n) => n.filter((x) => x.id !== id));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Internal note
          </SheetTitle>
          <SheetDescription className="text-sm text-foreground/80">
            {task?.title ?? ""}
            {date ? ` — ${format(date, "EEEE, dd MMM yyyy", { locale: vi })}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && <div className="text-xs text-muted-foreground">Đang tải lịch sử...</div>}
          {!loading && notes.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Chưa có trao đổi nào. Viết ghi chú đầu tiên bên dưới.
            </div>
          )}

          {instance?.notes && (
            <div className="rounded-lg border border-dashed border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Ghi chú cũ của ngày này
              </div>
              <div
                className="prose prose-invert prose-sm max-w-none [&_img]:rounded-md"
                dangerouslySetInnerHTML={{ __html: instance.notes }}
              />
            </div>
          )}

          {notes.map((n) => (
            <div key={n.id} className="flex gap-3 group">
              <div
                className={`size-9 shrink-0 rounded-lg ${colorFor(n.author_name)} text-white text-xs font-bold flex items-center justify-center`}
              >
                {initials(n.author_name)}
              </div>
              <div className="flex-1 min-w-0 rounded-lg border border-border bg-secondary/30 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold truncate">{n.author_name}</span>
                  {n.author_role && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-primary/15 text-primary">
                      {n.author_role}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                    {stamp(n.created_at)}
                  </span>
                  <button
                    onClick={() => remove(n.id)}
                    title="Xóa"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div
                  className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_img]:rounded-md [&_img]:my-2 [&_img]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: n.body }}
                />
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border px-5 py-3 space-y-2">
          <div className="flex gap-2">
            <Input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Tên người viết"
              className="h-8 text-xs"
            />
            <Input
              value={authorRole}
              onChange={(e) => setAuthorRole(e.target.value)}
              placeholder="Vai trò (DEV, B.A...)"
              className="h-8 text-xs w-40"
            />
          </div>
          <RichEditor
            key={editorKey}
            value={draft}
            onChange={setDraft}
            placeholder="Viết ghi chú cho team... Ctrl+V để dán ảnh"
            minHeight={110}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={send} disabled={sending || isEmpty(draft)} className="gap-1.5">
              <Send className="size-3.5" />
              {sending ? "Đang gửi..." : "Gửi ghi chú"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
