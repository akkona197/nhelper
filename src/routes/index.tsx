import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, format, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Check,
  Clock,
  CalendarDays,
  Pencil,
  Trash2,
  StickyNote,
} from "lucide-react";
import { NotesPanel } from "@/components/NotesPanel";
import {
  fmtDate,
  getWeekDays,
  getWeekStart,
  taskOccursOn,
  type InstanceRow,
  type TaskRow,
} from "@/lib/scheduling";
import { TaskDialog } from "@/components/TaskDialog";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <WeekView />
      </AppShell>
    </RequireAuth>
  ),
});

const PRIORITY_BG: Record<string, string> = {
  high: "border-l-[var(--color-priority-high)]",
  medium: "border-l-[var(--color-priority-medium)]",
  low: "border-l-[var(--color-priority-low)]",
};

function WeekView() {
  const { user } = useAuth();
  const [anchor, setAnchor] = useState(() => new Date());
  const weekStart = useMemo(() => getWeekStart(anchor), [anchor]);
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const startStr = fmtDate(days[0]);
    const endStr = fmtDate(days[6]);
    const [{ data: t }, { data: ins }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase
        .from("task_instances")
        .select("*")
        .gte("scheduled_date", startStr)
        .lte("scheduled_date", endStr),
    ]);
    setTasks((t as TaskRow[]) ?? []);
    setInstances((ins as InstanceRow[]) ?? []);
    setLoading(false);
  }, [user, days]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Build per-day list of items
  const itemsByDay = useMemo(() => {
    const map: Record<string, Array<{ task: TaskRow; instance?: InstanceRow }>> = {};
    days.forEach((d) => (map[fmtDate(d)] = []));
    // Recurring tasks (daily/weekly) — show as virtual items unless instance exists
    tasks.forEach((task) => {
      if (task.recurrence === "none") return;
      days.forEach((d) => {
        if (taskOccursOn(task, d)) {
          const dStr = fmtDate(d);
          const inst = instances.find((i) => i.task_id === task.id && i.scheduled_date === dStr);
          map[dStr].push({ task, instance: inst });
        }
      });
    });
    // One-off (instances only)
    instances.forEach((inst) => {
      const task = tasks.find((t) => t.id === inst.task_id);
      if (!task || task.recurrence !== "none") return;
      if (map[inst.scheduled_date]) {
        map[inst.scheduled_date].push({ task, instance: inst });
      }
    });
    // Sort by time
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => {
        const ta = a.instance?.scheduled_time || a.task.start_time || "99:99";
        const tb = b.instance?.scheduled_time || b.task.start_time || "99:99";
        return ta.localeCompare(tb);
      })
    );
    return map;
  }, [tasks, instances, days]);

  async function toggleDone(task: TaskRow, date: Date, current?: InstanceRow) {
    if (!user) return;
    const dStr = fmtDate(date);
    if (current) {
      await supabase
        .from("task_instances")
        .update({
          is_done: !current.is_done,
          completed_at: !current.is_done ? new Date().toISOString() : null,
        })
        .eq("id", current.id);
    } else {
      await supabase.from("task_instances").insert({
        user_id: user.id,
        task_id: task.id,
        scheduled_date: dStr,
        scheduled_time: task.start_time,
        estimate_minutes: task.estimate_minutes,
        is_done: true,
        completed_at: new Date().toISOString(),
      });
    }
    reload();
  }

  async function deleteTask(task: TaskRow) {
    if (!confirm(`Xoá task "${task.title}"?`)) return;
    await supabase.from("tasks").delete().eq("id", task.id);
    toast.success("Đã xoá");
    reload();
  }

  async function duplicateWeek() {
    if (!user) return;
    const nextStart = addWeeks(weekStart, 1);
    // Copy non-recurring instances of the current week into next week (same day-of-week offset).
    const oneOff = instances.filter((i) => {
      const t = tasks.find((tt) => tt.id === i.task_id);
      return t?.recurrence === "none";
    });
    if (oneOff.length === 0) {
      toast("Không có task 1-lần nào để nhân bản. (Task lặp tự sinh ở tuần sau.)");
      return;
    }
    const inserts = oneOff.map((i) => {
      const oldDate = new Date(i.scheduled_date);
      const offset = days.findIndex((d) => isSameDay(d, oldDate));
      const newDate = addDays(nextStart, offset >= 0 ? offset : 0);
      return {
        user_id: user.id,
        task_id: i.task_id,
        scheduled_date: fmtDate(newDate),
        scheduled_time: i.scheduled_time,
        estimate_minutes: i.estimate_minutes,
      };
    });
    const { error } = await supabase
      .from("task_instances")
      .upsert(inserts, { onConflict: "task_id,scheduled_date" });
    if (error) toast.error(error.message);
    else {
      toast.success(`Đã nhân bản ${inserts.length} task sang tuần sau`);
      setAnchor(nextStart);
    }
  }

  function openCreate(date?: Date) {
    setEditing(null);
    setDefaultDate(date);
    setDialogOpen(true);
  }
  function openEdit(task: TaskRow) {
    setEditing(task);
    setDefaultDate(undefined);
    setDialogOpen(true);
  }

  const today = new Date();

  return (
    <div className="p-6">
      <header className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lịch tuần</h1>
          <p className="text-sm text-muted-foreground">
            {format(days[0], "dd MMM", { locale: vi })} – {format(days[6], "dd MMM yyyy", { locale: vi })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(addWeeks(anchor, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => setAnchor(new Date())}>Hôm nay</Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor(addWeeks(anchor, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" onClick={duplicateWeek}>
            <Copy className="size-4 mr-1.5" /> Nhân bản tuần sau
          </Button>
          <Button onClick={() => openCreate()} className="grad-primary text-primary-foreground">
            <Plus className="size-4 mr-1.5" /> Task mới
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="text-muted-foreground">Đang tải...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {days.map((d) => {
            const dStr = fmtDate(d);
            const isToday = isSameDay(d, today);
            const items = itemsByDay[dStr] ?? [];
            const totalMin = items.reduce((s, it) => s + (it.instance?.estimate_minutes ?? it.task.estimate_minutes), 0);
            return (
              <div
                key={dStr}
                className={`surface rounded-xl border p-3 min-h-[280px] flex flex-col ${
                  isToday ? "ring-1 ring-primary/60 glow" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {format(d, "EEE", { locale: vi })}
                    </div>
                    <div className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}>
                      {format(d, "dd")}
                    </div>
                  </div>
                  <button
                    onClick={() => openCreate(d)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Thêm task vào ngày này"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mb-2">
                  {(totalMin / 60).toFixed(1)}h • {items.length} task
                </div>
                <div className="space-y-1.5 flex-1">
                  {items.map(({ task, instance }) => (
                    <div
                      key={`${task.id}-${dStr}`}
                      className={`group rounded-md border border-border/60 bg-card/60 px-2 py-1.5 border-l-2 ${PRIORITY_BG[task.priority]} ${
                        instance?.is_done ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <button
                          onClick={() => toggleDone(task, d, instance)}
                          className={`mt-0.5 size-4 shrink-0 rounded border flex items-center justify-center ${
                            instance?.is_done
                              ? "bg-success border-success"
                              : "border-border hover:border-primary"
                          }`}
                        >
                          {instance?.is_done && <Check className="size-3 text-background" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-medium leading-snug truncate ${instance?.is_done ? "line-through" : ""}`}>
                            {task.title}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5">
                            {(instance?.scheduled_time || task.start_time) && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="size-2.5" />
                                {(instance?.scheduled_time || task.start_time)?.slice(0, 5)}
                              </span>
                            )}
                            <span>{instance?.estimate_minutes ?? task.estimate_minutes}m</span>
                            {task.recurrence !== "none" && (
                              <span className="px-1 rounded bg-primary/15 text-primary">↻</span>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground">
                            ⋯
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(task)}>
                              <Pencil className="size-3.5 mr-2" /> Sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteTask(task)} className="text-destructive">
                              <Trash2 className="size-3.5 mr-2" /> Xoá
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/60 italic mt-2">Trống</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={defaultDate}
        task={editing}
        onSaved={reload}
      />
    </div>
  );
}
