import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Check, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  remind_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/notifications")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <NotifPage />
      </AppShell>
    </RequireAuth>
  ),
});

function NotifPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  async function reload() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as Notif[]) ?? []);
  }
  useEffect(() => { reload(); }, [user]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    reload();
  }
  async function remove(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    reload();
  }
  async function markAllRead() {
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    reload();
  }
  async function addManual() {
    const title = prompt("Tiêu đề thông báo?");
    if (!title || !user) return;
    await supabase.from("notifications").insert({ user_id: user.id, title });
    reload();
  }
  async function requestPerm() {
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") toast.success("Đã bật thông báo trình duyệt");
  }

  return (
    <div className="p-6 max-w-3xl">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="size-6 text-primary" /> Thông báo
          </h1>
          <p className="text-sm text-muted-foreground">Lưu lại nhắc nhở để không quên.</p>
        </div>
        <div className="flex items-center gap-2">
          {permission !== "granted" && (
            <Button variant="outline" onClick={requestPerm}>
              <BellOff className="size-4 mr-1.5" /> Bật notification
            </Button>
          )}
          <Button variant="outline" onClick={addManual}>+ Tự ghi chú</Button>
          <Button variant="ghost" onClick={markAllRead}>Đánh dấu đã đọc tất cả</Button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">Chưa có thông báo nào.</div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className={`surface rounded-lg border p-4 flex items-start gap-3 ${n.is_read ? "opacity-60" : ""}`}
            >
              <div className={`mt-1 size-2 rounded-full shrink-0 ${n.is_read ? "bg-muted-foreground/30" : "bg-primary"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
                <div className="text-[11px] font-mono text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: vi })}
                </div>
              </div>
              {!n.is_read && (
                <Button size="icon" variant="ghost" onClick={() => markRead(n.id)} title="Đánh dấu đã đọc">
                  <Check className="size-4" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => remove(n.id)} title="Xoá">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
