import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CalendarDays, Repeat, Flag, Timer, Bell } from "lucide-react";
import { DOW_SHORT, PRIORITY_LABEL, type TaskRow } from "@/lib/scheduling";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { RichEditor } from "@/components/RichEditor";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskRow | null;
  onSaved?: () => void;
};

export function TaskDetailDialog({ open, onOpenChange, task, onSaved }: Props) {
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef("");

  useEffect(() => {
    if (!open || !task) return;
    const v = (task as TaskRow & { instructions?: string | null }).instructions ?? "";
    setInstructions(v);
    lastSaved.current = v;
    setStatus("idle");
  }, [open, task]);

  async function flush(val: string) {
    if (!task || val === lastSaved.current) return;
    setStatus("saving");
    const { error } = await supabase.from("tasks").update({ instructions: val || null } as never).eq("id", task.id);
    if (!error) {
      lastSaved.current = val;
      setStatus("saved");
      onSaved?.();
      setTimeout(() => setStatus("idle"), 1500);
    } else {
      setStatus("idle");
    }
  }

  function onChange(html: string) {
    setInstructions(html);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(html), 1200);
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      if (timer.current) clearTimeout(timer.current);
      flush(instructions);
    }
    onOpenChange(v);
  }

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-xl">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Flag className="size-3" /> {PRIORITY_LABEL[task.priority]}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Timer className="size-3" /> {task.estimate_minutes} phút
            </Badge>
            {task.start_time && (
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" /> {task.start_time.slice(0, 5)}
              </Badge>
            )}
            {task.recurrence !== "none" && (
              <Badge variant="outline" className="gap-1">
                <Repeat className="size-3" />
                {task.recurrence === "daily"
                  ? "Hằng ngày"
                  : `Hằng tuần: ${task.recurrence_days.map((d) => DOW_SHORT[d]).join(", ")}`}
              </Badge>
            )}
            {task.deadline && (
              <Badge variant="outline" className="gap-1">
                <CalendarDays className="size-3" />
                {format(new Date(task.deadline), "dd/MM HH:mm", { locale: vi })}
              </Badge>
            )}
            {task.reminder_minutes != null && (
              <Badge variant="outline" className="gap-1">
                <Bell className="size-3" /> Nhắc trước {task.reminder_minutes}p
              </Badge>
            )}
          </div>

          {task.description && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Mô tả
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hướng dẫn làm task
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {status === "saving" ? "Đang lưu..." : status === "saved" ? "Đã lưu ✓" : "Tự lưu"}
              </div>
            </div>
            <RichEditor
              value={instructions}
              onChange={onChange}
              placeholder="Ghi các bước, checklist, link, dán ảnh (Ctrl+V)... áp dụng cho mọi lần lặp."
              minHeight={220}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
