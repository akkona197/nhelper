import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
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
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
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

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-[var(--color-priority-high)]",
  medium: "bg-[var(--color-priority-medium)]",
  low: "bg-[var(--color-priority-low)]",
};

type ViewMode = "day" | "week" | "month";

function WeekView() {
  const { user, profile } = useAuth();
  const greetName = profile?.display_name || user?.email?.split("@")[0] || "bạn";
  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());

  const days = useMemo(() => {
    if (mode === "day") return [anchor];
    if (mode === "week") return getWeekDays(getWeekStart(anchor));
    // month: full weeks covering the month (Mon-start)
    const first = startOfMonth(anchor);
    const last = endOfMonth(anchor);
    const gridStart = getWeekStart(first);
    const gridEnd = getWeekStart(addDays(last, 7));
    const out: Date[] = [];
    let cur = gridStart;
    while (cur < gridEnd) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }, [mode, anchor]);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesCtx, setNotesCtx] = useState<{ task: TaskRow; date: Date; instance?: InstanceRow } | null>(null);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const startStr = fmtDate(days[0]);
    const endStr = fmtDate(days[days.length - 1]);
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

  const itemsByDay = useMemo(() => {
    const map: Record<string, Array<{ task: TaskRow; instance?: InstanceRow }>> = {};
    days.forEach((d) => (map[fmtDate(d)] = []));
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
    instances.forEach((inst) => {
      const task = tasks.find((t) => t.id === inst.task_id);
      if (!task || task.recurrence !== "none") return;
      if (map[inst.scheduled_date]) {
        map[inst.scheduled_date].push({ task, instance: inst });
      }
    });
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
    const weekStart = getWeekStart(anchor);
    const weekDays = getWeekDays(weekStart);
    const nextStart = addWeeks(weekStart, 1);
    const weekStartStr = fmtDate(weekDays[0]);
    const weekEndStr = fmtDate(weekDays[6]);
    const oneOff = instances.filter((i) => {
      const t = tasks.find((tt) => tt.id === i.task_id);
      return t?.recurrence === "none" && i.scheduled_date >= weekStartStr && i.scheduled_date <= weekEndStr;
    });
    if (oneOff.length === 0) {
      toast("Không có task 1-lần nào để nhân bản. (Task lặp tự sinh ở tuần sau.)");
      return;
    }
    const inserts = oneOff.map((i) => {
      const oldDate = new Date(i.scheduled_date);
      const offset = weekDays.findIndex((d) => isSameDay(d, oldDate));
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

  function shift(dir: -1 | 1) {
    if (mode === "day") setAnchor(addDays(anchor, dir));
    else if (mode === "week") setAnchor(addWeeks(anchor, dir));
    else setAnchor(addMonths(anchor, dir));
  }

  const today = new Date();
  const rangeLabel =
    mode === "day"
      ? format(anchor, "EEEE, dd MMM yyyy", { locale: vi })
      : mode === "week"
        ? `${format(days[0], "dd MMM", { locale: vi })} – ${format(days[6], "dd MMM yyyy", { locale: vi })}`
        : format(anchor, "MMMM yyyy", { locale: vi });

  const ModeBtn = ({ v, label }: { v: ViewMode; label: string }) => (
    <button
      onClick={() => setMode(v)}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        mode === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6">
      <header className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Xin chào, <span className="text-grad">{greetName}</span>
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 p-1 rounded-lg bg-secondary border border-border">
            <ModeBtn v="day" label="Ngày" />
            <ModeBtn v="week" label="Tuần" />
            <ModeBtn v="month" label="Tháng" />
          </div>
          <Button variant="outline" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => setAnchor(new Date())}>Hôm nay</Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
          {mode !== "month" && (
            <Button variant="outline" onClick={duplicateWeek}>
              <Copy className="size-4 mr-1.5" /> Nhân bản tuần sau
            </Button>
          )}
          <Button onClick={() => openCreate()} className="grad-primary text-primary-foreground">
            <Plus className="size-4 mr-1.5" /> Task mới
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="text-muted-foreground">Đang tải...</div>
      ) : mode === "month" ? (
        <MonthGrid
          days={days}
          anchor={anchor}
          today={today}
          itemsByDay={itemsByDay}
          onDayClick={(d) => {
            setAnchor(d);
            setMode("day");
          }}
          onAdd={openCreate}
        />
      ) : (
        <div
          className={
            mode === "day"
              ? "grid grid-cols-1 gap-3 max-w-2xl mx-auto"
              : "grid grid-cols-1 md:grid-cols-7 gap-3"
          }
        >
          {days.map((d) => {
            const dStr = fmtDate(d);
            const isToday = isSameDay(d, today);
            const items = itemsByDay[dStr] ?? [];
            const totalMin = items.reduce((s, it) => s + (it.instance?.estimate_minutes ?? it.task.estimate_minutes), 0);
            return (
              <div
                key={dStr}
                className={`surface rounded-xl border p-3 flex flex-col ${
                  mode === "day" ? "min-h-[420px]" : "min-h-[280px]"
                } ${isToday ? "ring-1 ring-primary/60 glow" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {format(d, mode === "day" ? "EEEE" : "EEE", { locale: vi })}
                    </div>
                    <div className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}>
                      {format(d, "dd/MM")}
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
                          <button
                            type="button"
                            onClick={() => { setDetailTask(task); setDetailOpen(true); }}
                            className={`block w-full text-left text-xs font-medium leading-snug truncate hover:text-primary ${instance?.is_done ? "line-through" : ""}`}
                            title="Xem chi tiết"
                          >
                            {task.title}
                          </button>
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
                        <button
                          onClick={() => {
                            setNotesCtx({ task, date: d, instance });
                            setNotesOpen(true);
                          }}
                          className={`shrink-0 text-muted-foreground hover:text-primary transition-opacity ${
                            instance?.notes ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100"
                          }`}
                          title="Ghi chú"
                        >
                          <StickyNote className="size-3.5" />
                        </button>
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
      <NotesPanel
        open={notesOpen}
        onOpenChange={setNotesOpen}
        task={notesCtx?.task ?? null}
        date={notesCtx?.date ?? null}
        instance={notesCtx?.instance}
        onSaved={reload}
      />
      <TaskDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        task={detailTask}
        onSaved={reload}
      />
    </div>
  );
}

function MonthGrid({
  days,
  anchor,
  today,
  itemsByDay,
  onDayClick,
  onAdd,
}: {
  days: Date[];
  anchor: Date;
  today: Date;
  itemsByDay: Record<string, Array<{ task: TaskRow; instance?: InstanceRow }>>;
  onDayClick: (d: Date) => void;
  onAdd: (d: Date) => void;
}) {
  const dowHeaders = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  return (
    <div className="surface rounded-xl border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-secondary/50">
        {dowHeaders.map((d) => (
          <div key={d} className="px-2 py-2 text-[11px] uppercase tracking-wider text-muted-foreground text-center font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((d) => {
          const dStr = fmtDate(d);
          const isToday = isSameDay(d, today);
          const inMonth = isSameMonth(d, anchor);
          const items = itemsByDay[dStr] ?? [];
          const doneCount = items.filter((i) => i.instance?.is_done).length;
          return (
            <div
              key={dStr}
              className={`group min-h-[110px] border-r border-b border-border p-1.5 flex flex-col cursor-pointer transition-colors ${
                inMonth ? "bg-card/30 hover:bg-card/60" : "bg-background/40 text-muted-foreground/60"
              } ${isToday ? "ring-1 ring-primary/60 ring-inset" : ""}`}
              onClick={() => onDayClick(d)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${isToday ? "text-primary" : ""}`}>{format(d, "dd")}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onAdd(d); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  title="Thêm task"
                >
                  <Plus className="size-3" />
                </button>
              </div>
              <div className="space-y-0.5 flex-1 overflow-hidden">
                {items.slice(0, 3).map(({ task, instance }) => (
                  <div
                    key={`${task.id}-${dStr}`}
                    className={`flex items-center gap-1 text-[10px] truncate ${instance?.is_done ? "opacity-50 line-through" : ""}`}
                  >
                    <span className={`size-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{items.length - 3} nữa</div>
                )}
              </div>
              {items.length > 0 && (
                <div className="text-[9px] font-mono text-muted-foreground mt-1">
                  {doneCount}/{items.length}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
