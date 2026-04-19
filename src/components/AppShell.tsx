import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Inbox, Sparkles, BarChart3, LogOut, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Tuần", icon: Calendar },
  { to: "/workload", label: "Workload", icon: BarChart3 },
  { to: "/inbox", label: "AI Inbox", icon: Inbox },
  { to: "/notifications", label: "Thông báo", icon: Bell },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [user, loc.pathname]);

  const initial = (profile?.display_name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r bg-sidebar flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="size-8 rounded-lg grad-primary flex items-center justify-center">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <div className="font-semibold tracking-tight">Tempo</div>
        </div>
        <nav className="px-3 flex-1 space-y-1">
          {NAV.map((n) => {
            const active = loc.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4" />
                  {n.label}
                </span>
                {n.to === "/notifications" && unread > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-primary/20 text-primary">{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t flex items-center gap-2">
          <Avatar className="size-8">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-primary/20 text-primary text-xs">{initial}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{profile?.display_name || user?.email}</div>
            <Link to="/profile" className="text-xs text-muted-foreground hover:text-foreground">Hồ sơ</Link>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} title="Đăng xuất">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
