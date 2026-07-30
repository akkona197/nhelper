import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Rocket } from "lucide-react";

export const Route = createFileRoute("/space")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <SpacePage />
      </AppShell>
    </RequireAuth>
  ),
});

function SpacePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="size-16 rounded-2xl grad-primary flex items-center justify-center mb-5 shadow-lg">
        <Rocket className="size-8 text-primary-foreground" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">This is your space</h1>
      <p className="mt-2 text-muted-foreground">Tính năng này đang phát triển 🚧</p>
      <p className="mt-1 text-sm text-muted-foreground">Bé Lúa đang xây, sắp ra mắt rồi nhé! 🌾</p>
    </div>
  );
}
