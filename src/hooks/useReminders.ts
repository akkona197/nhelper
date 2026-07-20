import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { fmtDate, taskOccursOn, type InstanceRow, type TaskRow } from "@/lib/scheduling";

/**
 * Polls upcoming tasks every minute and triggers reminder if `reminder_minutes`
 * before the scheduled time has just been crossed. Pushes a browser notification
 * (if permitted), an in-app toast, and writes to the notifications table.
 */
export function useReminders() {
  const { user } = useAuth();
  const fired = useRef<Set<string>>(new Set());
  const seenNotif = useRef<Set<string>>(new Set());

  // Realtime popup for new notifications rows
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as { id: string; title: string; body: string | null };
          if (seenNotif.current.has(n.id)) return;
          seenNotif.current.add(n.id);
          toast(n.title, { description: n.body ?? undefined, duration: 6000 });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function tick() {
      const today = new Date();
      const dStr = fmtDate(today);
      const tomorrowStr = fmtDate(new Date(today.getTime() + 86400000));
      const [{ data: tasksData }, { data: insData }] = await Promise.all([
        supabase.from("tasks").select("*"),
        supabase
          .from("task_instances")
          .select("*")
          .gte("scheduled_date", dStr)
          .lte("scheduled_date", tomorrowStr),
      ]);
      if (cancelled) return;
      const tasks = (tasksData as TaskRow[]) ?? [];
      const instances = (insData as InstanceRow[]) ?? [];
      const now = new Date();

      const checks: Array<{ task: TaskRow; when: Date; key: string; instance?: InstanceRow }> = [];
      tasks.forEach((task) => {
        if (task.reminder_minutes == null) return;
        // recurring: check today & tomorrow
        if (task.recurrence !== "none") {
          [today, new Date(today.getTime() + 86400000)].forEach((d) => {
            if (!taskOccursOn(task, d)) return;
            const t = task.start_time;
            if (!t) return;
            const [hh, mm] = t.split(":").map(Number);
            const when = new Date(d);
            when.setHours(hh, mm, 0, 0);
            const inst = instances.find((i) => i.task_id === task.id && i.scheduled_date === fmtDate(d));
            checks.push({ task, when, key: `${task.id}:${fmtDate(d)}`, instance: inst });
          });
        } else if (task.deadline) {
          checks.push({ task, when: new Date(task.deadline), key: `${task.id}:deadline` });
        }
      });

      for (const c of checks) {
        if (c.instance?.is_done) continue;
        if (fired.current.has(c.key)) continue;
        const remindAt = new Date(c.when.getTime() - (c.task.reminder_minutes ?? 0) * 60_000);
        if (now >= remindAt && now <= c.when) {
          fired.current.add(c.key);
          const body = `Lúc ${c.when.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} • còn ~${Math.max(0, Math.round((c.when.getTime() - now.getTime()) / 60000))}'`;
          toast(c.task.title, { description: body });
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(c.task.title, { body });
            } catch {}
          }
          await supabase.from("notifications").insert({
            user_id: user!.id,
            title: `Sắp tới: ${c.task.title}`,
            body,
            task_id: c.task.id,
            remind_at: remindAt.toISOString(),
          });
        }
      }
    }

    tick();
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);
}
