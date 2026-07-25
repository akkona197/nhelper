import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePreferences, type Theme, type FontSize, type BackgroundId, BG_PRESETS } from "@/context/PreferencesContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Sun, Moon, Upload, Loader2, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <ProfilePage />
      </AppShell>
    </RequireAuth>
  ),
});

const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh tối đa 5MB");
      return;
    }
    setUploading(true);
    // Local preview immediately
    const localUrl = URL.createObjectURL(file);
    setAvatar(localUrl);

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data: signed, error: sErr } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (sErr || !signed) {
      setUploading(false);
      toast.error(sErr?.message ?? "Không tạo được URL");
      return;
    }
    const url = signed.signedUrl;
    setAvatar(url);
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("user_id", user.id);
    setUploading(false);
    if (dbErr) toast.error(dbErr.message);
    else { toast.success("Đã cập nhật ảnh đại diện"); refreshProfile(); }
  }

  const initial = (name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Hồ sơ</h1>
      <div className="surface rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="size-20">
              {avatar && <AvatarImage src={avatar} />}
              <AvatarFallback className="bg-primary/20 text-primary text-xl">{initial}</AvatarFallback>
            </Avatar>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium">{user?.email}</div>
            <div className="text-xs text-muted-foreground mb-2">User ID: {user?.id.slice(0, 8)}...</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="size-3.5 mr-1.5" />
              {uploading ? "Đang tải..." : "Chọn ảnh mới"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tên hiển thị</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>URL ảnh đại diện / Logo</Label>
          <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." />
          <p className="text-xs text-muted-foreground">Tự cập nhật khi bạn tải ảnh lên. Ảnh này cũng dùng làm logo ở thanh bên trái.</p>
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
