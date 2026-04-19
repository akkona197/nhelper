import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Sparkles, Plus, Loader2, Inbox as InboxIcon } from "lucide-react";
import { fmtDate, type Priority } from "@/lib/scheduling";

type Suggestion = {
  title: string;
  description?: string;
  priority: Priority;
  estimate_minutes: number;
  deadline?: string | null;
};

export const Route = createFileRoute("/inbox")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <InboxPage />
      </AppShell>
    </RequireAuth>
  ),
});

function InboxPage() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);

  async function parse() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-tasks", {
        body: { message: text, now: new Date().toISOString() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResults(((data as any)?.tasks ?? []) as Suggestion[]);
      if (((data as any)?.tasks ?? []).length === 0) toast("Không tìm thấy task nào trong đoạn này.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setBusy(false);
    }
  }

  function updateField<K extends keyof Suggestion>(idx: number, key: K, val: Suggestion[K]) {
    setResults((arr) => arr.map((s, i) => (i === idx ? { ...s, [key]: val } : s)));
  }

  async function addOne(s: Suggestion, idx: number) {
    if (!user) return;
    const date = s.deadline ? s.deadline.slice(0, 10) : fmtDate(new Date());
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        title: s.title,
        description: s.description ?? null,
        priority: s.priority,
        estimate_minutes: s.estimate_minutes || 30,
        recurrence: "none",
        recurrence_days: [],
        deadline: s.deadline ? new Date(s.deadline).toISOString() : null,
      })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("task_instances").insert({
      user_id: user.id,
      task_id: task.id,
      scheduled_date: date,
      estimate_minutes: s.estimate_minutes || 30,
    });
    setResults((arr) => arr.filter((_, i) => i !== idx));
    toast.success(`Đã thêm: ${s.title}`);
  }

  async function addAll() {
    for (let i = results.length - 1; i >= 0; i--) {
      await addOne(results[i], i);
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <InboxIcon className="size-6 text-primary" /> AI Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Dán tin nhắn / email người khác giao task vào đây — AI sẽ tự rút ra việc cần làm và deadline.
        </p>
      </header>

      <div className="surface rounded-xl border p-5 space-y-3">
        <Label>Nội dung</Label>
        <Textarea
          rows={6}
          placeholder="Ví dụ: Em chuẩn bị giúp anh báo cáo Q4 nhé, gửi anh trước thứ 6 tuần này. Hôm nay nhớ gọi cho khách hàng A lúc 4h chiều."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { setText(""); setResults([]); }}>Xoá</Button>
          <Button onClick={parse} disabled={busy || !text.trim()} className="grad-primary text-primary-foreground">
            {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Sparkles className="size-4 mr-1.5" />}
            Phân loại bằng AI
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm text-muted-foreground">{results.length} task được phát hiện</h2>
            <Button size="sm" onClick={addAll}>Thêm tất cả</Button>
          </div>
          <div className="space-y-3">
            {results.map((s, i) => (
              <div key={i} className="surface rounded-xl border p-4 space-y-3">
                <Input
                  value={s.title}
                  onChange={(e) => updateField(i, "title", e.target.value)}
                  className="font-medium"
                />
                {s.description && (
                  <Textarea
                    rows={2}
                    value={s.description}
                    onChange={(e) => updateField(i, "description", e.target.value)}
                  />
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Ưu tiên</Label>
                    <Select value={s.priority} onValueChange={(v) => updateField(i, "priority", v as Priority)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Cao</SelectItem>
                        <SelectItem value="medium">Trung bình</SelectItem>
                        <SelectItem value="low">Thấp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Phút</Label>
                    <Input
                      type="number"
                      value={s.estimate_minutes}
                      onChange={(e) => updateField(i, "estimate_minutes", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Deadline</Label>
                    <Input
                      type="datetime-local"
                      value={s.deadline ? s.deadline.slice(0, 16) : ""}
                      onChange={(e) => updateField(i, "deadline", e.target.value || null)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setResults((arr) => arr.filter((_, x) => x !== i))}>Bỏ</Button>
                  <Button size="sm" onClick={() => addOne(s, i)} className="grad-primary text-primary-foreground">
                    <Plus className="size-3.5 mr-1" /> Thêm vào lịch
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
