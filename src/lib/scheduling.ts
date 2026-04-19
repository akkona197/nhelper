import { format, startOfWeek, addDays } from "date-fns";

export type Recurrence = "none" | "daily" | "weekly";
export type Priority = "low" | "medium" | "high";

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: Priority;
  estimate_minutes: number;
  recurrence: Recurrence;
  recurrence_days: number[];
  start_time: string | null; // "HH:MM:SS"
  recurrence_start_date: string | null;
  recurrence_end_date: string | null;
  deadline: string | null;
  reminder_minutes: number | null;
  color: string | null;
};

export type InstanceRow = {
  id: string;
  task_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  estimate_minutes: number;
  is_done: boolean;
  completed_at: string | null;
  notes: string | null;
};

export const WEEK_STARTS_ON = 1; // Monday

export function getWeekStart(d: Date) {
  return startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON });
}

export function getWeekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function fmtDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function dayLabel(d: Date) {
  return format(d, "EEE");
}

/**
 * Decide whether a recurring task should occur on a given date.
 */
export function taskOccursOn(task: TaskRow, date: Date): boolean {
  if (task.recurrence === "none") return false;
  const dStr = fmtDate(date);
  if (task.recurrence_start_date && dStr < task.recurrence_start_date) return false;
  if (task.recurrence_end_date && dStr > task.recurrence_end_date) return false;
  if (task.recurrence === "daily") return true;
  if (task.recurrence === "weekly") {
    const dow = date.getDay(); // 0 Sun..6 Sat
    return task.recurrence_days?.includes(dow) ?? false;
  }
  return false;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

export const DOW_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
