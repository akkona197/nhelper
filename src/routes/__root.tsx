import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { PreferencesProvider } from "@/context/PreferencesContext";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-grad">404</h1>
        <p className="mt-4 text-muted-foreground">Trang không tồn tại.</p>
        <a href="/" className="mt-6 inline-block text-primary hover:underline">Về trang chủ</a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Master Task — Lịch tuần & quản lý task" },
      { name: "description", content: "Thời khoá biểu tuần, task lặp lại, deadline, reminder và workload — tất cả ở một nơi." },
      { property: "og:title", content: "Master Task — Lịch tuần & quản lý task" },
      { name: "twitter:title", content: "Master Task — Lịch tuần & quản lý task" },
      { property: "og:description", content: "Thời khoá biểu tuần, task lặp lại, deadline, reminder và workload — tất cả ở một nơi." },
      { name: "twitter:description", content: "Thời khoá biểu tuần, task lặp lại, deadline, reminder và workload — tất cả ở một nơi." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7e4632fa-77b8-4fbb-aea6-16b3efe16aac/id-preview-b20ce10b--f1837782-2934-43e2-92fe-cc60bbc72808.lovable.app-1776618804767.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7e4632fa-77b8-4fbb-aea6-16b3efe16aac/id-preview-b20ce10b--f1837782-2934-43e2-92fe-cc60bbc72808.lovable.app-1776618804767.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </PreferencesProvider>
  );
}
