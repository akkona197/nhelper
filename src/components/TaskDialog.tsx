import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { DOW_SHORT, type Recurrence, type Priority, type TaskRow, fmtDate } from "@/lib/scheduling";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: Date;
  task?: TaskRow | null;
  onSaved: () => void;
};

export function TaskDialog({ open, onOpenChange, defaultDate, task, onSaved }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [estimate, setEstimate] = useState(30);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [days, setDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reminder, setReminder] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(task.priority);
      setEstimate(task.estimate_minutes);
      setRecurrence(task.recurrence);
      setDays(task.recurrence_days ?? []);
      setStartTime(task.start_time?.slice(0, 5) ?? "");
      setDeadline(task.deadline ? task.deadline.slice(0, 16) : "");
      setReminder(task.reminder_minutes ?? "");
    } else {
      setTitle(""); setDescription(""); setPriority("medium"); setEstimate(30);
      setRecurrence("none"); setDays([]); setStartTime("");
      setDeadline(defaultDate ? `${fmtDate(defaultDate)}T18:00` : "");
      setReminder("");
    }
  }, [open, task, defaultDate]);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function handleSave() {
    if (!user) return;
    if (!title.trim()) { toast.error("Cần tiêu đề"); return; }
    if (recurrence === "weekly" && days.length === 0) {
      toast.error("Chọn ít nhất 1 thứ trong tuần"); return;
    }
    setBusy(true);
    const payload = {
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      estimate_minutes: estimate,
      recurrence,
      recurrence_days: recurrence === "weekly" ? days : [],
      start_time: startTime ? `${startTime}:00` : null,
      deadline: recurrence === "none" && deadline ? new Date(deadline).toISOString() : null,
      reminder_minutes: reminder === "" ? null : Number(reminder),
    };
    let taskId = task?.id;
    if (task) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
      if (error) { toast.error(error.message); setBusy(false); return; }
    } else {
      const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setBusy(false); return; }
      taskId = data.id;
    }

    // For one-off task: create an instance on its date
    if (recurrence === "none" && taskId) {
      const date = deadline ? deadline.slice(0, 10) : (defaultDate ? fmtDate(defaultDate) : fmtDate(new Date()));
      await supabase.from("task_instances").upsert({
        user_id: user.id,
        task_id: taskId,
        scheduled_date: date,
        scheduled_time: startTime ? `${startTime}:00` : null,
        estimate_minutes: estimate,
      }, { onConflict: "task_id,scheduled_date" });
    }

    setBusy(false);
    onOpenChange(false);
    onSaved();
    toast.success(task ? "Đã cập nhật task" : "Đã thêm task");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Chỉnh sửa task" : "Thêm task mới"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tiêu đề</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Họp với khách hàng A" />
          </div>
          <div className="space-y-2">
            <Label>Mô tả</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Độ ưu tiên</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Cao</SelectItem>
                  <SelectItem value="medium">Trung bình</SelectItem>
                  <SelectItem value="low">Thấp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ước tính (phút)</Label>
              <Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Lặp lại</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không lặp (1 lần)</SelectItem>
                <SelectItem value="daily">Hằng ngày</SelectItem>
                <SelectItem value="weekly">Theo thứ trong tuần</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {recurrence === "weekly" && (
            <div className="flex flex-wrap gap-1">
              {DOW_SHORT.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    days.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Giờ bắt đầu</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            {recurrence === "none" && (
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Nhắc trước (phút)</Label>
            <Input type="number" min={0} value={reminder} onChange={(e) => setReminder(e.target.value === "" ? "" : Number(e.target.value))} placeholder="vd: 15" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button onClick={handleSave} disabled={busy} className="grad-primary text-primary-foreground">
            {busy ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
