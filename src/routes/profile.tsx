import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePreferences, type Theme, type FontSize } from "@/context/PreferencesContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Sun, Moon } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <ProfilePage />
      </AppShell>
    </RequireAuth>
  ),
});

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setAvatar(profile.avatar_url ?? "");
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, avatar_url: avatar || null })
      .eq("user_id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Đã lưu"); refreshProfile(); }
  }

  const initial = (name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Hồ sơ</h1>
      <div className="surface rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {avatar && <AvatarImage src={avatar} />}
            <AvatarFallback className="bg-primary/20 text-primary text-lg">{initial}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{user?.email}</div>
            <div className="text-xs text-muted-foreground">User ID: {user?.id.slice(0, 8)}...</div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tên hiển thị</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>URL ảnh đại diện / Logo</Label>
          <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." />
          <p className="text-xs text-muted-foreground">Ảnh này cũng dùng làm logo ở thanh bên trái.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy} className="grad-primary text-primary-foreground">
            {busy ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>

      <PreferencesCard />
    </div>
  );
}

function PreferencesCard() {
  const { theme, fontSize, setTheme, setFontSize } = usePreferences();
  const themes: { v: Theme; label: string; icon: typeof Sun }[] = [
    { v: "light", label: "Sáng", icon: Sun },
    { v: "dark", label: "Tối", icon: Moon },
  ];
  const sizes: { v: FontSize; label: string; sample: string }[] = [
    { v: "sm", label: "Nhỏ", sample: "14px" },
    { v: "md", label: "Vừa", sample: "16px" },
    { v: "lg", label: "Lớn", sample: "18px" },
  ];
  return (
    <div className="surface rounded-xl border p-6 space-y-5 mt-6">
      <h2 className="text-lg font-semibold">Cá nhân hóa</h2>
      <div className="space-y-2">
        <Label>Giao diện</Label>
        <div className="flex gap-2">
          {themes.map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setTheme(v)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm transition-colors ${
                theme === v ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Cỡ chữ</Label>
        <div className="flex gap-2">
          {sizes.map(({ v, label, sample }) => (
            <button
              key={v}
              onClick={() => setFontSize(v)}
              className={`flex-1 rounded-md border px-4 py-3 transition-colors ${
                fontSize === v ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs opacity-70">{sample}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
