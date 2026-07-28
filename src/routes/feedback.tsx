import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, Bug, Lightbulb, MessageCircle, Send, CheckCircle2 } from "lucide-react";

const db = supabase as unknown as { from: (t: string) => any };

export const Route = createFileRoute("/feedback")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <FeedbackPage />
      </AppShell>
    </RequireAuth>
  ),
});

type Kind = "bug" | "idea" | "other";
const KINDS: { v: Kind; label: string; icon: typeof Bug; hint: string }[] = [
  { v: "bug", label: "Báo lỗi", icon: Bug, hint: "Có gì đó chạy sai" },
  { v: "idea", label: "Góp ý / Ý tưởng", icon: Lightbulb, hint: "Đề xuất cải tiến" },
  { v: "other", label: "Khác", icon: MessageCircle, hint: "Bất cứ điều gì" },
];

function FeedbackPage() {
  const { user, profile } = useAuth();
  const [kind, setKind] = useState<Kind>("bug");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setName(profile?.display_name || user?.email?.split("@")[0] || "");
  }, [profile, user]);

  async function submit() {
    if (!user) return;
    if (!message.trim()) {
      toast.error("Bạn hãy nhập nội dung góp ý");
      return;
    }
    setSending(true);
    const { error } = await db.from("feedback").insert({
      user_id: user.id,
      reporter_name: name.trim() || null,
      reporter_email: user.email ?? null,
      kind,
      message: message.trim(),
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMessage("");
    setDone(true);
    toast.success("Cảm ơn bạn đã góp ý!");
  }

  if (done) {
    return (
      <div className="p-6 max-w-xl">
        <div className="surface rounded-xl border p-10 text-center space-y-4">
          <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-semibold">Đã gửi góp ý!</h1>
          <p className="text-sm text-muted-foreground">
            Cảm ơn bạn. Góp ý đã được chuyển tới đội phát triển để xử lý dần.
          </p>
          <Button variant="outline" onClick={() => setDone(false)}>
            Gửi góp ý khác
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <MessageSquare className="size-6 text-primary" /> Gửi feedback
        </h1>
        <p className="text-sm text-muted-foreground">
          Báo lỗi hoặc góp ý để sản phẩm tốt hơn. Mỗi góp ý sẽ được ghi nhận để xử lý dần.
        </p>
      </header>

      <div className="surface rounded-xl border p-6 space-y-5">
        <div className="space-y-2">
          <Label>Loại góp ý</Label>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map(({ v, label, icon: Icon, hint }) => (
              <button
                key={v}
                onClick={() => setKind(v)}
                className={`rounded-md border px-3 py-3 text-center transition-colors ${
                  kind === v ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5 mx-auto mb-1" />
                <div className="text-sm font-medium">{label}</div>
                <div className="text-[11px] opacity-70">{hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tên của bạn</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên hiển thị" />
        </div>

        <div className="space-y-2">
          <Label>Nội dung</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              kind === "bug"
                ? "Mô tả lỗi: bạn làm gì, kết quả ra sao, ở màn hình nào..."
                : "Bạn muốn góp ý điều gì?"
            }
            rows={6}
          />
          <p className="text-xs text-muted-foreground">Gửi từ: {user?.email}</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={submit} disabled={sending || !message.trim()} className="gap-1.5 grad-primary text-primary-foreground">
            <Send className="size-4" />
            {sending ? "Đang gửi..." : "Gửi góp ý"}
          </Button>
        </div>
      </div>
    </div>
  );
}
