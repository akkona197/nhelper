import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FolderKanban,
  X,
} from "lucide-react";
import { NotesPanel } from "@/components/NotesPanel";
import {
  fmtDate,
  getWeekDays,
  getWeekStart,
  taskOccursOn,
  type InstanceRow,
  type TaskRow,
  type ProjectRow,
  type LabelRow,
} from "@/lib/scheduling";
import { TaskDialog } from "@/components/TaskDialog";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { ProjectLabelManager } from "@/components/ProjectLabelManager";
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

type ViewMode = "day" | "3days" | "week" | "month";

function WeekView() {
  const { user, profile } = useAuth();
  const greetName = profile?.display_name || user?.email?.split("@")[0] || "bạn";
  const [mode, setModeState] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "3days";
    const v = localStorage.getItem("mt.viewMode");
    return v === "day" || v === "3days" || v === "week" || v === "month" ? v : "3days";
  });
  const setMode = (m: ViewMode) => {
    setModeState(m);
    if (typeof window !== "undefined") {
      localStorage.setItem("mt.viewMode", m);
      window.dispatchEvent(new CustomEvent("mt:viewmode", { detail: m }));
    }
  };
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mt:viewmode", { detail: mode }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [anchor, setAnchor] = useState(() => new Date());

  const days = useMemo(() => {
    if (mode === "day") return [anchor];
    if (mode === "3days") return [addDays(anchor, -1), anchor, addDays(anchor, 1)];
    if (mode === "week") return getWeekDays(getWeekStart(anchor));
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
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [taskLabels, setTaskLabels] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesCtx, setNotesCtx] = useState<{ task: TaskRow; date: Date; instance?: InstanceRow } | null>(null);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [dragOverTask, setDragOverTask] = useState<string | null>(null);

  // Resizable week columns (persisted in localStorage)
  const [colWidths, setColWidths] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem("mt.colWidths");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === 7) return arr;
      }
    } catch {}
    return Array(7).fill(220);
  });
  useEffect(() => {
    try { localStorage.setItem("mt.colWidths", JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);
  function startResize(idx: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[idx];
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(140, Math.min(600, startW + (ev.clientX - startX)));
      setColWidths((prev) => {
        const c = [...prev];
        c[idx] = next;
        return c;
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function assignProjectToTask(taskId: string, projectId: string) {
    const { error } = await supabase.from("tasks").update({ project_id: projectId }).eq("id", taskId);
    if (error) return toast.error(error.message);
    toast.success("Đã gán dự án");
    reload();
  }
  async function assignLabelToTask(taskId: string, labelId: string) {
    if (!user) return;
    if ((taskLabels[taskId] ?? []).includes(labelId)) {
      toast("Nhãn đã có trên task này");
      return;
    }
    const { error } = await supabase
      .from("task_labels")
      .insert({ task_id: taskId, label_id: labelId, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Đã gán nhãn");
    reload();
  }

  const taskDropHandlers = (taskId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (
        e.dataTransfer.types.includes("application/x-assign-project") ||
        e.dataTransfer.types.includes("application/x-assign-label")
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        if (dragOverTask !== taskId) setDragOverTask(taskId);
      }
    },
    onDragLeave: () => {
      if (dragOverTask === taskId) setDragOverTask(null);
    },
    onDrop: (e: React.DragEvent) => {
      const pid = e.dataTransfer.getData("application/x-assign-project");
      const lid = e.dataTransfer.getData("application/x-assign-label");
      if (!pid && !lid) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOverTask(null);
      if (pid) assignProjectToTask(taskId, pid);
      if (lid) assignLabelToTask(taskId, lid);
    },
  });

  const dragHandlers = (dayStr: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("application/x-task")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverDay !== dayStr) setDragOverDay(dayStr);
      }
    },
    onDragLeave: () => {
      if (dragOverDay === dayStr) setDragOverDay(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverDay(null);
      const raw = e.dataTransfer.getData("application/x-task");
      if (!raw) return;
      try {
        const payload = JSON.parse(raw);
        const [y, m, d] = dayStr.split("-").map(Number);
        moveTaskToDate(payload, new Date(y, m - 1, d));
      } catch {}
    },
  });

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const startStr = fmtDate(days[0]);
    const endStr = fmtDate(days[days.length - 1]);
    const [{ data: t }, { data: ins }, { data: p }, { data: l }, { data: tl }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase
        .from("task_instances")
        .select("*")
        .gte("scheduled_date", startStr)
        .lte("scheduled_date", endStr),
      supabase.from("projects").select("*").order("created_at"),
      supabase.from("labels").select("*").order("created_at"),
      supabase.from("task_labels").select("task_id, label_id"),
    ]);
    setTasks((t as TaskRow[]) ?? []);
    setInstances((ins as InstanceRow[]) ?? []);
    setProjects((p as ProjectRow[]) ?? []);
    setLabels((l as LabelRow[]) ?? []);
    const map: Record<string, string[]> = {};
    (tl ?? []).forEach((r) => {
      (map[r.task_id] ||= []).push(r.label_id);
    });
    setTaskLabels(map);
    setLoading(false);
  }, [user, days]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Auto-roll overdue one-off tasks to today (once per session)
  const rolledRef = useRef(false);
  useEffect(() => {
    if (!user || rolledRef.current) return;
    rolledRef.current = true;
    (async () => {
      const today = fmtDate(new Date());
      const { data: overdue } = await supabase
        .from("task_instances")
        .select("id, task_id, scheduled_date, is_done, tasks!inner(recurrence)")
        .lt("scheduled_date", today)
        .eq("is_done", false)
        .eq("tasks.recurrence", "none");
      if (overdue && overdue.length > 0) {
        const ids = overdue.map((r: any) => r.id);
        const { error } = await supabase
          .from("task_instances")
          .update({ scheduled_date: today })
          .in("id", ids);
        if (!error) {
          toast.success(`Đã dời ${overdue.length} task quá hạn về hôm nay`);
          reload();
        }
      }
    })();
  }, [user, reload]);

  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const labelById = useMemo(() => Object.fromEntries(labels.map((l) => [l.id, l])), [labels]);

  function passesFilter(task: TaskRow): boolean {
    if (projectFilter && task.project_id !== projectFilter) return false;
    if (labelFilter && !(taskLabels[task.id] ?? []).includes(labelFilter)) return false;
    return true;
  }

  const itemsByDay = useMemo(() => {
    const map: Record<string, Array<{ task: TaskRow; instance?: InstanceRow }>> = {};
    days.forEach((d) => (map[fmtDate(d)] = []));
    tasks.forEach((task) => {
      if (!passesFilter(task)) return;
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
      if (!passesFilter(task)) return;
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
  }, [tasks, instances, days, projectFilter, labelFilter, taskLabels]);

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

  async function moveTaskToDate(
    payload: { taskId: string; instanceId?: string; recurrence: string; fromDate: string },
    toDate: Date
  ) {
    if (!user) return;
    const toStr = fmtDate(toDate);
    if (payload.fromDate === toStr) return;
    if (payload.recurrence !== "none") {
      toast.error("Task lặp lại không thể kéo — hãy sửa lịch lặp trong dialog.");
      return;
    }
    if (payload.instanceId) {
      const { error } = await supabase
        .from("task_instances")
        .update({ scheduled_date: toStr })
        .eq("id", payload.instanceId);
      if (error) return toast.error(error.message);
    } else {
      const task = tasks.find((t) => t.id === payload.taskId);
      if (!task) return;
      const { error } = await supabase.from("task_instances").insert({
        user_id: user.id,
        task_id: task.id,
        scheduled_date: toStr,
        scheduled_time: task.start_time,
        estimate_minutes: task.estimate_minutes,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Đã chuyển sang " + format(toDate, "dd/MM"));
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
    else if (mode === "3days") setAnchor(addDays(anchor, dir * 3));
    else if (mode === "week") setAnchor(addWeeks(anchor, dir));
    else setAnchor(addMonths(anchor, dir));
  }

  const today = new Date();
  const rangeLabel =
    mode === "day"
      ? format(anchor, "EEEE, dd MMM yyyy", { locale: vi })
      : mode === "week" || mode === "3days"
        ? `${format(days[0], "dd MMM", { locale: vi })} – ${format(days[days.length - 1], "dd MMM yyyy", { locale: vi })}`
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
      <header className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Xin chào, <span className="text-grad">{greetName}</span>
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 p-1 rounded-lg bg-secondary border border-border">
            <ModeBtn v="day" label="Ngày" />
            <ModeBtn v="3days" label="3 ngày" />
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
          <Button variant="outline" onClick={() => setManagerOpen(true)}>
            <FolderKanban className="size-4 mr-1.5" /> Dự án & Nhãn
          </Button>
          <Button onClick={() => openCreate()} className="grad-primary text-primary-foreground">
            <Plus className="size-4 mr-1.5" /> Task mới
          </Button>
        </div>
      </header>

      {(projects.length > 0 || labels.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4 text-xs">
          {projects.length > 0 && <span className="text-muted-foreground">Dự án:</span>}
          {projects.map((p) => {
            const active = projectFilter === p.id;
            return (
              <button
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData("application/x-assign-project", p.id);
                }}
                onClick={() => setProjectFilter(active ? null : p.id)}
                title="Kéo thả vào task để gán dự án"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors cursor-grab active:cursor-grabbing"
                style={{
                  borderColor: p.color,
                  background: active ? p.color : "transparent",
                  color: active ? "#fff" : "inherit",
                }}
              >
                <span className="size-1.5 rounded-full" style={{ background: active ? "#fff" : p.color }} />
                {p.name}
              </button>
            );
          })}
          {labels.length > 0 && <span className="text-muted-foreground ml-2">Nhãn:</span>}
          {labels.map((l) => {
            const active = labelFilter === l.id;
            return (
              <button
                key={l.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData("application/x-assign-label", l.id);
                }}
                onClick={() => setLabelFilter(active ? null : l.id)}
                title="Kéo thả vào task để gán nhãn"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border transition-colors cursor-grab active:cursor-grabbing"
                style={{
                  borderColor: l.color,
                  background: active ? l.color : "transparent",
                  color: active ? "#fff" : l.color,
                }}
              >
                {l.name}
              </button>
            );
          })}
          {(projectFilter || labelFilter) && (
            <button
              onClick={() => { setProjectFilter(null); setLabelFilter(null); }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" /> Bỏ lọc
            </button>
          )}
        </div>
      )}

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
          dragHandlers={dragHandlers}
          dragOverDay={dragOverDay}
        />
      ) : (
        <div
          className={
            mode === "day"
              ? "grid grid-cols-1 gap-3 max-w-2xl mx-auto"
              : "flex gap-3 overflow-x-auto pb-2"
          }
        >
          {days.map((d, idx) => {
            const dStr = fmtDate(d);
            const isToday = isSameDay(d, today);
            const items = itemsByDay[dStr] ?? [];
            const totalMin = items.reduce((s, it) => s + (it.instance?.estimate_minutes ?? it.task.estimate_minutes), 0);
            return (
              <div
                key={dStr}
                {...dragHandlers(dStr)}
                style={mode !== "day" ? { width: colWidths[idx], flex: "0 0 auto" } : undefined}
                className={`relative surface rounded-xl border p-3 flex flex-col transition-colors ${
                  mode === "day" ? "min-h-[420px]" : "min-h-[280px]"
                } ${isToday ? "ring-1 ring-primary/60 glow" : ""} ${
                  dragOverDay === dStr ? "ring-2 ring-primary bg-primary/5" : ""
                }`}
              >
                {mode !== "day" && (
                  <div
                    onMouseDown={(e) => startResize(idx, e)}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
                    title="Kéo để chỉnh độ rộng cột"
                  />
                )}
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
                  {items.map(({ task, instance }) => {
                    const project = task.project_id ? projectById[task.project_id] : null;
                    const taskLabelIds = taskLabels[task.id] ?? [];
                    return (
                      <div
                        key={`${task.id}-${dStr}`}
                        draggable={task.recurrence === "none"}
                        onDragStart={(e) => {
                          if (task.recurrence !== "none") return;
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData(
                            "application/x-task",
                            JSON.stringify({
                              taskId: task.id,
                              instanceId: instance?.id,
                              recurrence: task.recurrence,
                              fromDate: dStr,
                            })
                          );
                        }}
                        {...taskDropHandlers(task.id)}
                        className={`group rounded-md border border-border/60 bg-card/60 px-2 py-1.5 border-l-2 ${PRIORITY_BG[task.priority]} ${
                          instance?.is_done ? "opacity-50" : ""
                        } ${task.recurrence === "none" ? "cursor-grab active:cursor-grabbing" : ""} ${
                          dragOverTask === task.id ? "ring-2 ring-primary bg-primary/10" : ""
                        }`}
                        style={project ? { borderLeftColor: project.color } : undefined}
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
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono mt-0.5 flex-wrap">
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
                              {project && (
                                <span
                                  className="px-1.5 py-px rounded"
                                  style={{ background: project.color + "22", color: project.color }}
                                >
                                  {project.name}
                                </span>
                              )}
                              {taskLabelIds.map((id) => {
                                const l = labelById[id];
                                if (!l) return null;
                                return (
                                  <span
                                    key={id}
                                    className="px-1.5 py-px rounded-full border"
                                    style={{ borderColor: l.color, color: l.color }}
                                  >
                                    {l.name}
                                  </span>
                                );
                              })}
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
                    );
                  })}
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
        projects={projects}
        labels={labels}
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
      <ProjectLabelManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onChanged={reload}
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
  dragHandlers,
  dragOverDay,
}: {
  days: Date[];
  anchor: Date;
  today: Date;
  itemsByDay: Record<string, Array<{ task: TaskRow; instance?: InstanceRow }>>;
  onDayClick: (d: Date) => void;
  onAdd: (d: Date) => void;
  dragHandlers: (dayStr: string) => {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
  };
  dragOverDay: string | null;
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
              {...dragHandlers(dStr)}
              className={`group min-h-[110px] border-r border-b border-border p-1.5 flex flex-col cursor-pointer transition-colors ${
                inMonth ? "bg-card/30 hover:bg-card/60" : "bg-background/40 text-muted-foreground/60"
              } ${isToday ? "ring-1 ring-primary/60 ring-inset" : ""} ${
                dragOverDay === dStr ? "ring-2 ring-primary bg-primary/10" : ""
              }`}
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
