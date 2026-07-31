import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, CalendarClock, Trash2, PartyPopper } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { fmtDate } from "@/lib/scheduling";

const db = supabase as unknown as { from: (t: string) => any };

type Row = {
  id: string;
  task_id: string;
  scheduled_date: string;
  title: string;
  priority: string;
};

const DOT: Record<string, string> = {
  high: "bg-[var(--color-priority-high)]",
  medium: "bg-[var(--color-priority-medium)]",
  low: "bg-[var(--color-priority-low)]",
};

export function OverdueSheet({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const today = fmtDate(new Date());
    const { data, error } = await db
      .from("task_instances")
      .select("id, task_id, scheduled_date, tasks!inner(title, priority)")
      .lt("scheduled_date", today)
      .eq("is_done", false)
      .order("scheduled_date", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const mapped: Row[] = (data ?? []).map((r: any) => ({
      id: r.id,
      task_id: r.task_id,
      scheduled_date: r.scheduled_date,
      title: r.tasks?.title ?? "(không tên)",
      priority: r.tasks?.priority ?? "medium",
    }));
    setRows(mapped);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function afterChange(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    onChanged?.();
  }

  async function markDone(id: string) {
    const { error } = await db
      .from("task_instances")
      .update({ is_done: true, completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mt:taskdone"));
    afterChange(id);
  }

  async function moveToToday(id: string) {
    const { error } = await db.from("task_instances").update({ scheduled_date: fmtDate(new Date()) }).eq("id", id);
    if (error) return toast.error(error.message);
    afterChange(id);
  }

  async function remove(id: string) {
    const { error } = await db.from("task_instances").delete().eq("id", id);
    if (error) return toast.error(error.message);
    afterChange(id);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            Quá hạn chưa xong
            {rows.length > 0 && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive">{rows.length}</span>
            )}
          </SheetTitle>
          <SheetDescription>Task ở những ngày đã qua mà chưa tick hoàn thành. Dọn dần nhé!</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2">
          {loading && <div className="text-xs text-muted-foreground">Đang tải...</div>}
          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16 gap-2 text-muted-foreground">
              <PartyPopper className="size-8 text-primary" />
              <div className="text-sm">Tuyệt vời! Không còn task quá hạn nào.</div>
            </div>
          )}

          {rows.map((r) => {
            const d = new Date(r.scheduled_date);
            const daysAgo = differenceInCalendarDays(new Date(), d);
            return (
              <div key={r.id} className="surface rounded-lg border p-3 flex items-start gap-3">
                <span className={`mt-1.5 size-2 rounded-full shrink-0 ${DOT[r.priority] ?? DOT.medium}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {format(d, "EEE, dd/MM/yyyy", { locale: vi })}
                    {daysAgo > 0 ? ` • quá ${daysAgo} ngày` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="size-8" title="Đánh dấu hoàn thành" onClick={() => markDone(r.id)}>
                    <Check className="size-4 text-emerald-500" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" title="Dời về hôm nay" onClick={() => moveToToday(r.id)}>
                    <CalendarClock className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" title="Xoá" onClick={() => remove(r.id)}>
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
