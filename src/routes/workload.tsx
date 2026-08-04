import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  fmtDate,
  getWeekDays,
  getWeekStart,
  taskOccursOn,
  WEEK_STARTS_ON,
  type InstanceRow,
  type TaskRow,
} from "@/lib/scheduling";
import { addWeeks, differenceInCalendarWeeks, format, getWeek } from "date-fns";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, TrendingUp, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";

export const Route = createFileRoute("/workload")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <Workload />
      </AppShell>
    </RequireAuth>
  ),
});

function Workload() {
  const { user } = useAuth();
  const [anchor, setAnchor] = useState(new Date());
  const weekStart = useMemo(() => getWeekStart(anchor), [anchor]);
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const navLabel = useMemo(() => {
    const dw = differenceInCalendarWeeks(anchor, new Date(), { weekStartsOn: WEEK_STARTS_ON });
    if (dw === 0) return "Tuần này";
    if (dw === -1) return "Tuần trước";
    if (dw === 1) return "Tuần sau";
    return `Tuần ${getWeek(anchor, { weekStartsOn: WEEK_STARTS_ON, firstWeekContainsDate: 1 })}`;
  }, [anchor]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [instances, setInstances] = useState<InstanceRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: t }, { data: ins }] = await Promise.all([
        supabase.from("tasks").select("*"),
        supabase
          .from("task_instances")
          .select("*")
          .gte("scheduled_date", fmtDate(days[0]))
          .lte("scheduled_date", fmtDate(days[6])),
      ]);
      setTasks((t as TaskRow[]) ?? []);
      setInstances((ins as InstanceRow[]) ?? []);
    })();
  }, [user, days]);

  const data = useMemo(() => {
    return days.map((d) => {
      const dStr = fmtDate(d);
      let minutes = 0;
      let count = 0;
      let done = 0;
      tasks.forEach((task) => {
        if (task.recurrence === "none") return;
        if (taskOccursOn(task, d)) {
          const inst = instances.find((i) => i.task_id === task.id && i.scheduled_date === dStr);
          minutes += inst?.estimate_minutes ?? task.estimate_minutes;
          count += 1;
          if (inst?.is_done) done += 1;
        }
      });
      instances.forEach((inst) => {
        const task = tasks.find((t) => t.id === inst.task_id);
        if (!task || task.recurrence !== "none" || inst.scheduled_date !== dStr) return;
        minutes += inst.estimate_minutes;
        count += 1;
        if (inst.is_done) done += 1;
      });
      return { day: format(d, "EEE", { locale: vi }), hours: +(minutes / 60).toFixed(2), count, done };
    });
  }, [tasks, instances, days]);

  const totalHours = data.reduce((s, x) => s + x.hours, 0);
  const totalCount = data.reduce((s, x) => s + x.count, 0);
  const totalDone = data.reduce((s, x) => s + x.done, 0);
  const completion = totalCount === 0 ? 0 : Math.round((totalDone / totalCount) * 100);

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workload</h1>
          <p className="text-sm text-muted-foreground">
            {format(days[0], "dd MMM", { locale: vi })} – {format(days[6], "dd MMM yyyy", { locale: vi })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(addWeeks(anchor, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" className="min-w-[92px]" onClick={() => setAnchor(new Date())} title="Về tuần này">
            {navLabel}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor(addWeeks(anchor, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat icon={<Clock className="size-4" />} label="Tổng giờ ước tính" value={`${totalHours.toFixed(1)}h`} />
        <Stat icon={<TrendingUp className="size-4" />} label="Trung bình / ngày" value={`${(totalHours / 7).toFixed(1)}h`} />
        <Stat icon={<CheckCircle2 className="size-4" />} label="Hoàn thành" value={`${completion}% (${totalDone}/${totalCount})`} />
      </div>

      <div className="surface rounded-xl border p-5">
        <h2 className="text-sm text-muted-foreground mb-4">Giờ ước tính theo ngày</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke="oklch(0.3 0.02 270 / 0.3)" vertical={false} />
              <XAxis dataKey="day" stroke="oklch(0.66 0.02 265)" tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.66 0.02 265)" tickLine={false} axisLine={false} unit="h" />
              <Tooltip
                contentStyle={{ background: "oklch(0.21 0.022 270)", border: "1px solid oklch(0.3 0.02 270)", borderRadius: 8 }}
                labelStyle={{ color: "oklch(0.96 0.01 260)" }}
              />
              <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.hours > 8 ? "oklch(0.7 0.22 20)" : d.hours > 5 ? "oklch(0.82 0.17 75)" : "oklch(0.72 0.18 285)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-xs text-muted-foreground mt-3">
          <span className="inline-block size-2 rounded-sm bg-[oklch(0.72_0.18_285)] mr-1.5" /> ≤5h
          <span className="inline-block size-2 rounded-sm bg-[oklch(0.82_0.17_75)] ml-3 mr-1.5" /> 5–8h
          <span className="inline-block size-2 rounded-sm bg-[oklch(0.7_0.22_20)] ml-3 mr-1.5" /> Quá tải
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface rounded-xl border p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
