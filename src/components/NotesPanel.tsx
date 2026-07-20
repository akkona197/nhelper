import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { fmtDate, type InstanceRow, type TaskRow } from "@/lib/scheduling";
import { toast } from "sonner";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskRow | null;
  date: Date | null;
  instance?: InstanceRow | null;
  onSaved?: () => void;
};

export function NotesPanel({ open, onOpenChange, task, date, instance, onSaved }: Props) {
  const { user } = useAuth();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const initialRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instanceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial = instance?.notes ?? "";
    setValue(initial);
    initialRef.current = initial;
    instanceIdRef.current = instance?.id ?? null;
    setStatus("idle");
  }, [open, instance]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function persist(next: string) {
    if (!user || !task || !date) return;
    setStatus("saving");
    try {
      if (instanceIdRef.current) {
        const { error } = await supabase
          .from("task_instances")
          .update({ notes: next || null })
          .eq("id", instanceIdRef.current);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("task_instances")
          .insert({
            user_id: user.id,
            task_id: task.id,
            scheduled_date: fmtDate(date),
            scheduled_time: task.start_time,
            estimate_minutes: task.estimate_minutes,
            notes: next || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        instanceIdRef.current = data.id;
      }
      initialRef.current = next;
      setStatus("saved");
      onSaved?.();
    } catch (e: any) {
      setStatus("idle");
      toast.error(e.message ?? "Không lưu được ghi chú");
    }
  }

  function handleChange(v: string) {
    setValue(v);
    if (v === initialRef.current) return;
    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(v), 1200);
  }

  function handleOpenChange(v: boolean) {
    if (!v && timerRef.current) {
      clearTimeout(timerRef.current);
      if (value !== initialRef.current) persist(value);
    }
    onOpenChange(v);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="truncate">{task?.title ?? "Ghi chú"}</SheetTitle>
          <SheetDescription>
            {date ? format(date, "EEEE, dd MMM yyyy", { locale: vi }) : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 flex flex-col gap-2 mt-2">
          <Textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Ghi chú cho task này... (tự lưu sau 1.2s)"
            className="flex-1 min-h-[300px] resize-none"
            autoFocus
          />
          <div className="text-[11px] text-muted-foreground font-mono h-4">
            {status === "saving" && "Đang lưu..."}
            {status === "saved" && "Đã lưu ✓"}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
