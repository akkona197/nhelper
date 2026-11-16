import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, WEEK_STARTS_ON } from "@/lib/scheduling";

async function readAll<Row extends { id: string }>(
  readPage: (after: string) => PromiseLike<{ data: Row[] | null; error: unknown }>,
) {
  const rows: Row[] = [];
  let after = "00000000-0000-0000-0000-000000000000";
  while (true) {
    const { data, error } = await readPage(after);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
    after = data[data.length - 1].id;
  }
}

function noteText(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html.replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])>/gi, "$&\n");
  template.content.querySelectorAll("script, style").forEach((node) => node.remove());
  template.content.querySelectorAll("img").forEach((node) => {
    node.replaceWith(node.getAttribute("alt") || "[Hình ảnh]");
  });
  return template.content.textContent?.trim() ?? "";
}

function csvCell(value: string | number) {
  let cell = String(value);
  if (/^\s*[=+@\-＝＋＠－]|^[\t\r\n]/u.test(cell)) cell = "'" + cell;
  return '"' + cell.replaceAll('"', '""') + '"';
}

export async function downloadWorkloadCsv(userId: string) {
  const [tasks, instances, notes] = await Promise.all([
    readAll((after) =>
      supabase
        .from("tasks")
        .select("id,title,start_time,estimate_minutes")
        .eq("user_id", userId)
        .gt("id", after)
        .order("id")
        .limit(500),
    ),
    readAll((after) =>
      supabase
        .from("task_instances")
        .select(
          "id,task_id,scheduled_date,scheduled_time,estimate_minutes,is_done,completed_at,notes",
        )
        .eq("user_id", userId)
        .gt("id", after)
        .order("id")
        .limit(500),
    ),
    readAll((after) =>
      supabase
        .from("task_notes")
        .select("id,task_id,scheduled_date,created_at,body")
        .eq("user_id", userId)
        .gt("id", after)
        .order("id")
        .limit(500),
    ),
  ]);

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const instancesByDate = new Map(
    instances.map((instance) => [`${instance.task_id}/${instance.scheduled_date}`, instance]),
  );
  const notedInstances = new Set<string>();
  type Instance = (typeof instances)[number];
  const rows: (string | number)[][] = [];

  function addRow(
    taskId: string,
    date: string | null,
    instance: Instance | undefined,
    createdAt: string | null,
    note: string | null,
  ) {
    const task = tasksById.get(taskId);
    const weekDate = date ?? (createdAt ? fmtDate(parseISO(createdAt)) : "");
    rows.push([
      date ?? "",
      weekDate
        ? format(parseISO(weekDate), "YYYY-'W'ww", {
            weekStartsOn: WEEK_STARTS_ON,
            firstWeekContainsDate: 1,
            useAdditionalWeekYearTokens: true,
          })
        : "",
      (instance ? instance.scheduled_time : task?.start_time) ?? "",
      task?.title ?? "",
      instance?.estimate_minutes ?? task?.estimate_minutes ?? "",
      instance ? (instance.is_done ? "Đã hoàn thành" : "Chưa hoàn thành") : "",
      instance?.completed_at
        ? format(parseISO(instance.completed_at), "yyyy-MM-dd HH:mm:ss xxx")
        : "",
      createdAt ? format(parseISO(createdAt), "yyyy-MM-dd HH:mm:ss xxx") : "",
      note ? noteText(note) : "",
    ]);
  }

  for (const note of notes) {
    const instance = instancesByDate.get(`${note.task_id}/${note.scheduled_date}`);
    if (instance) notedInstances.add(instance.id);
    addRow(note.task_id, note.scheduled_date, instance, note.created_at, note.body);
  }
  for (const instance of instances) {
    if (instance.notes || !notedInstances.has(instance.id)) {
      addRow(instance.task_id, instance.scheduled_date, instance, null, instance.notes);
    }
  }
  if (!rows.length) return false;

  rows.sort(
    (a, b) =>
      String(b[0] || b[7]).localeCompare(String(a[0] || a[7])) ||
      String(b[7]).localeCompare(String(a[7])),
  );
  rows.unshift([
    "Ngày lên lịch",
    "Tuần",
    "Giờ lên lịch",
    "Tên task",
    "Workload (phút ước tính)",
    "Trạng thái",
    "Thời điểm hoàn thành",
    "Thời điểm ghi chú",
    "Ghi chú",
  ]);
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `workload-${fmtDate(new Date())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
