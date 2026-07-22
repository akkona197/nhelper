import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Trash2, Plus, Folder, Tag } from "lucide-react";
import type { LabelRow, ProjectRow } from "@/lib/scheduling";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#64748b"];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
};

export function ProjectLabelManager({ open, onOpenChange, onChanged }: Props) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [pName, setPName] = useState("");
  const [pColor, setPColor] = useState(COLORS[0]);
  const [lName, setLName] = useState("");
  const [lColor, setLColor] = useState(COLORS[1]);

  async function reload() {
    if (!user) return;
    const [{ data: p }, { data: l }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at"),
      supabase.from("labels").select("*").order("created_at"),
    ]);
    setProjects((p as ProjectRow[]) ?? []);
    setLabels((l as LabelRow[]) ?? []);
  }

  useEffect(() => {
    if (open) reload();
  }, [open]);

  async function addProject() {
    if (!user || !pName.trim()) return;
    const { error } = await supabase.from("projects").insert({ user_id: user.id, name: pName.trim(), color: pColor });
    if (error) return toast.error(error.message);
    setPName("");
    reload();
    onChanged?.();
  }

  async function addLabel() {
    if (!user || !lName.trim()) return;
    const { error } = await supabase.from("labels").insert({ user_id: user.id, name: lName.trim(), color: lColor });
    if (error) return toast.error(error.message);
    setLName("");
    reload();
    onChanged?.();
  }

  async function delProject(id: string) {
    if (!confirm("Xoá dự án này? Task thuộc dự án sẽ không còn gắn với dự án nữa.")) return;
    await supabase.from("projects").delete().eq("id", id);
    reload();
    onChanged?.();
  }
  async function delLabel(id: string) {
    if (!confirm("Xoá nhãn này?")) return;
    await supabase.from("labels").delete().eq("id", id);
    reload();
    onChanged?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quản lý dự án & nhãn</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
              <Folder className="size-4" /> Dự án
            </div>
            <div className="flex gap-2 mb-2">
              <Input placeholder="Tên dự án..." value={pName} onChange={(e) => setPName(e.target.value)} />
              <ColorPicker value={pColor} onChange={setPColor} />
              <Button size="sm" onClick={addProject}>
                <Plus className="size-3.5" />
              </Button>
            </div>
            <div className="space-y-1">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-border/50">
                  <span className="size-3 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-sm flex-1">{p.name}</span>
                  <button onClick={() => delProject(p.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {projects.length === 0 && <div className="text-xs text-muted-foreground italic">Chưa có dự án</div>}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
              <Tag className="size-4" /> Nhãn
            </div>
            <div className="flex gap-2 mb-2">
              <Input placeholder="Tên nhãn..." value={lName} onChange={(e) => setLName(e.target.value)} />
              <ColorPicker value={lColor} onChange={setLColor} />
              <Button size="sm" onClick={addLabel}>
                <Plus className="size-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => (
                <div
                  key={l.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border"
                  style={{ borderColor: l.color, color: l.color }}
                >
                  {l.name}
                  <button onClick={() => delLabel(l.id)} className="opacity-60 hover:opacity-100">
                    ×
                  </button>
                </div>
              ))}
              {labels.length === 0 && <div className="text-xs text-muted-foreground italic">Chưa có nhãn</div>}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 px-1 rounded-md border border-input bg-background">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`size-4 rounded-full transition-transform ${value === c ? "scale-125 ring-1 ring-foreground/30" : ""}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
