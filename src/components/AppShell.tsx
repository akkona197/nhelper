import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Inbox, Sparkles, BarChart3, LogOut, Bell, Pin, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useReminders } from "@/hooks/useReminders";

const NAV = [
  { to: "/", label: "Tuần", icon: Calendar },
  { to: "/workload", label: "Workload", icon: BarChart3 },
  { to: "/inbox", label: "AI Inbox", icon: Inbox },
  { to: "/notifications", label: "Thông báo", icon: Bell },
  { to: "/board", label: "Bảng ghim", icon: Pin },
];

type ViewMode = "day" | "3days" | "week" | "month";
const COLLAPSE_KEY = (m: ViewMode) => `mt.sidebar.collapsed.${m}`;
const readCollapsed = (m: ViewMode): boolean => {
  if (typeof window === "undefined") return false;
  const scoped = localStorage.getItem(COLLAPSE_KEY(m));
  if (scoped !== null) return scoped === "1";
  // Fallback to legacy global key on first run
  return localStorage.getItem("mt.sidebar.collapsed") === "1";
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);
  const [mode, setMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "3days";
    const v = localStorage.getItem("mt.viewMode");
    return v === "day" || v === "3days" || v === "week" || v === "month" ? v : "3days";
  });
  const [collapsed, setCollapsedState] = useState<boolean>(() => readCollapsed(mode));
  useReminders();

  useEffect(() => {
    const onMode = (e: Event) => {
      const m = (e as CustomEvent).detail as ViewMode;
      if (m === "day" || m === "3days" || m === "week" || m === "month") {
        setMode(m);
        setCollapsedState(readCollapsed(m));
      }
    };
    window.addEventListener("mt:viewmode", onMode);
    return () => window.removeEventListener("mt:viewmode", onMode);
  }, []);

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    if (typeof window !== "undefined") {
      localStorage.setItem(COLLAPSE_KEY(mode), v ? "1" : "0");
    }
  };

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
    <div className="min-h-screen flex w-full">
      <aside
        className={`${collapsed ? "w-16" : "w-60"} border-r bg-sidebar flex flex-col transition-[width] duration-200 sticky top-0 h-screen`}
      >
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2 px-3 py-4`}>
          <Link
            to="/profile"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
            title="Đổi logo trong Hồ sơ"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Logo" className="size-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="size-8 rounded-lg grad-primary flex items-center justify-center shrink-0">
                <Sparkles className="size-4 text-primary-foreground" />
              </div>
            )}
            {!collapsed && <div className="font-semibold tracking-tight truncate">Master Task</div>}
          </Link>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => setCollapsed(true)}
              title="Thu gọn"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>
        {collapsed && (
          <div className="px-2 pb-2 flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCollapsed(false)}
              title="Mở rộng"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          </div>
        )}
        <nav className={`${collapsed ? "px-2" : "px-3"} flex-1 space-y-1 overflow-y-auto`}>
          {NAV.map((n) => {
            const active = loc.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                title={collapsed ? n.label : undefined}
                className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2 rounded-md ${collapsed ? "px-2" : "px-3"} py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{n.label}</span>}
                </span>
                {!collapsed && n.to === "/notifications" && unread > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-primary/20 text-primary">{unread}</span>
                )}
                {collapsed && n.to === "/notifications" && unread > 0 && (
                  <span className="absolute ml-5 -mt-4 text-[9px] font-mono px-1 rounded-md bg-primary/30 text-primary">{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={`p-3 border-t flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
          <Avatar className="size-8">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-primary/20 text-primary text-xs">{initial}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{profile?.display_name || user?.email}</div>
              <Link to="/profile" className="text-xs text-muted-foreground hover:text-foreground">Hồ sơ</Link>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} title="Đăng xuất">
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
