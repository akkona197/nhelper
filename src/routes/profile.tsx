import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePreferences, type Theme, type FontSize, type BackgroundId, BG_PRESETS, FONTS, ACCENTS, TEXT_COLORS, ANIM_BG_PREVIEW } from "@/context/PreferencesContext";
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
  const { user } = useAuth();
  const {
    theme, fontSize, fontFamily, accent, textColor, glass, background, backgroundUrl,
    setTheme, setFontSize, setFontFamily, setAccent, setTextColor, setGlass, setBackground, setBackgroundUrl,
  } = usePreferences();
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [bgUploading, setBgUploading] = useState(false);

  const themes: { v: Theme; label: string; icon: typeof Sun }[] = [
    { v: "light", label: "Sáng", icon: Sun },
    { v: "dark", label: "Tối", icon: Moon },
  ];
  const sizes: { v: FontSize; label: string; sample: string }[] = [
    { v: "sm", label: "Nhỏ", sample: "14px" },
    { v: "md", label: "Vừa", sample: "16px" },
    { v: "lg", label: "Lớn", sample: "18px" },
  ];
  const backgrounds: { v: BackgroundId; label: string; preview: string }[] = [
    { v: "default", label: "Mặc định", preview: BG_PRESETS.default },
    { v: "aurora", label: "Aurora", preview: BG_PRESETS.aurora },
    { v: "sunset", label: "Sunset", preview: BG_PRESETS.sunset },
    { v: "ocean", label: "Ocean", preview: BG_PRESETS.ocean },
    { v: "minimal", label: "Trơn", preview: BG_PRESETS.minimal },
    { v: "hologram", label: "Hologram ✨", preview: ANIM_BG_PREVIEW.hologram },
    { v: "holopastel", label: "Hologram Pastel ✨", preview: ANIM_BG_PREVIEW.holopastel },
    { v: "nebula", label: "Nebula ⟳", preview: ANIM_BG_PREVIEW.nebula },
    { v: "waves", label: "Sóng ⟳", preview: ANIM_BG_PREVIEW.waves },
  ];

  async function onPickBg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("Vui lòng chọn file ảnh");
    if (file.size > 8 * 1024 * 1024) return toast.error("Ảnh tối đa 8MB");
    setBgUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/background-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setBgUploading(false); return toast.error(upErr.message); }
    const { data: signed, error: sErr } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
    setBgUploading(false);
    if (sErr || !signed) return toast.error(sErr?.message ?? "Không tạo được URL");
    setBackgroundUrl(signed.signedUrl);
    setBackground("custom");
    toast.success("Đã cập nhật hình nền");
  }

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
      <div className="space-y-2">
        <Label>Kiểu chữ (font)</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(FONTS).map(([k, f]) => (
            <button
              key={k}
              onClick={() => setFontFamily(k)}
              className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                fontFamily === k ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}
              style={{ fontFamily: f.stack }}
              title={f.label}
            >
              <div className="text-base leading-tight">Ag</div>
              <div className="text-xs truncate">{f.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Màu giao diện</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button
              key={k}
              onClick={() => setAccent(k)}
              title={a.label}
              className={`size-8 rounded-full border transition-transform hover:scale-110 ${
                accent === k ? "ring-2 ring-offset-2 ring-offset-background ring-primary" : "border-black/10"
              }`}
              style={{ background: a.swatch }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Màu chữ</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TEXT_COLORS).map(([k, c]) => (
            <button
              key={k}
              onClick={() => setTextColor(k)}
              title={c.label}
              className={`size-8 rounded-full border grid place-items-center text-xs font-bold transition-transform hover:scale-110 ${
                textColor === k ? "ring-2 ring-offset-2 ring-offset-background ring-primary" : "border-black/10"
              }`}
              style={{ background: c.swatch, color: k === "white" || k === "default" ? "#111" : "#fff" }}
            >
              A
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Template</Label>
        <button
          onClick={() => setGlass(!glass)}
          className={`w-full flex items-center justify-between rounded-md border px-4 py-3 text-sm transition-colors ${
            glass ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex flex-col items-start">
            <span className="font-medium">Trong suốt (kính mờ)</span>
            <span className="text-xs opacity-70">Panel mờ để nhìn xuyên thấy hình nền — đẹp nhất khi dùng cùng nền động/ảnh.</span>
          </span>
          <span className={`shrink-0 ml-3 inline-flex h-6 w-11 items-center rounded-full transition-colors ${glass ? "bg-primary" : "bg-muted-foreground/30"}`}>
            <span className={`inline-block size-5 rounded-full bg-white transition-transform ${glass ? "translate-x-5" : "translate-x-0.5"}`} />
          </span>
        </button>
      </div>
      <div className="space-y-2">
        <Label>Hình nền</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {backgrounds.map(({ v, label, preview }) => (
            <button
              key={v}
              onClick={() => setBackground(v)}
              className={`rounded-md border overflow-hidden transition-all ${
                background === v ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
              }`}
              title={label}
            >
              <div className="h-14 w-full" style={{ background: preview }} />
              <div className="text-xs py-1 text-center truncate px-1">{label}</div>
            </button>
          ))}
          <button
            onClick={() => backgroundUrl && setBackground("custom")}
            className={`rounded-md border overflow-hidden transition-all ${
              background === "custom" ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
            }`}
            title="Tùy chỉnh"
          >
            <div
              className="h-14 w-full flex items-center justify-center bg-muted"
              style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {!backgroundUrl && <ImageIcon className="size-4 text-muted-foreground" />}
            </div>
            <div className="text-xs py-1 text-center">Tùy chỉnh</div>
          </button>
        </div>
        <div className="flex gap-2 items-center pt-1">
          <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={onPickBg} />
          <Button variant="outline" size="sm" onClick={() => bgFileRef.current?.click()} disabled={bgUploading}>
            {bgUploading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Upload className="size-3.5 mr-1.5" />}
            {bgUploading ? "Đang tải..." : "Tải ảnh nền"}
          </Button>
          <Input
            value={backgroundUrl}
            onChange={(e) => setBackgroundUrl(e.target.value)}
            placeholder="hoặc dán URL ảnh nền..."
            className="flex-1"
          />
        </div>
      </div>
    </div>
  );
}
