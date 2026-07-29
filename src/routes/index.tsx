import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, BarChart3, Sparkles, Pin, Bell, User, MessageSquare, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <Home />
      </AppShell>
    </RequireAuth>
  ),
});

// Câu quote động lực ngắn nổi tiếng — làm việc, học tập, kỷ luật, kiên trì
const QUOTES: { text: string; author: string }[] = [
  { text: "Kỷ luật là cầu nối giữa mục tiêu và thành tựu.", author: "Jim Rohn" },
  { text: "Thành công là tổng của những nỗ lực nhỏ, lặp lại mỗi ngày.", author: "Robert Collier" },
  { text: "Cách để bắt đầu là ngừng nói và bắt tay vào làm.", author: "Walt Disney" },
  { text: "Có công mài sắt, có ngày nên kim.", author: "Tục ngữ Việt Nam" },
  { text: "Đừng đếm ngày trôi qua, hãy làm cho mỗi ngày đáng giá.", author: "Muhammad Ali" },
  { text: "Học như thể bạn sẽ sống mãi, sống như thể bạn sẽ ra đi ngày mai.", author: "Mahatma Gandhi" },
  { text: "Kiên trì không phải một chặng dài, mà là nhiều chặng ngắn nối tiếp nhau.", author: "Walter Elliot" },
  { text: "Tôi có thể chấp nhận thất bại, nhưng không thể chấp nhận việc không cố gắng.", author: "Michael Jordan" },
  { text: "Chất lượng không phải là hành động, mà là một thói quen.", author: "Aristotle" },
  { text: "Kỷ luật bản thân là làm điều cần làm, ngay cả khi bạn không muốn.", author: "Khuyết danh" },
  { text: "Thành công là đi từ thất bại này đến thất bại khác mà không mất nhiệt huyết.", author: "Winston Churchill" },
  { text: "Ước mơ không thành nhờ phép màu, mà nhờ mồ hôi, quyết tâm và nỗ lực.", author: "Colin Powell" },
  { text: "Việc hôm nay chớ để ngày mai.", author: "Tục ngữ" },
  { text: "Đừng chờ đợi. Thời điểm sẽ không bao giờ vừa vặn hoàn hảo.", author: "Napoleon Hill" },
  { text: "Tương lai thuộc về những ai tin vào vẻ đẹp trong ước mơ của mình.", author: "Eleanor Roosevelt" },
  { text: "Không phải vì việc khó mà ta ngại làm; chính vì ta ngại làm nên việc mới khó.", author: "Seneca" },
];

type CardDef = { to: string; label: string; icon: typeof Calendar; tile: string; iconColor: string };
const CARDS: CardDef[] = [
  { to: "/lich", label: "Lịch làm việc", icon: Calendar, tile: "bg-blue-500/15", iconColor: "text-blue-500" },
  { to: "/workload", label: "Khối lượng công việc", icon: BarChart3, tile: "bg-purple-500/15", iconColor: "text-purple-500" },
  { to: "/inbox", label: "AI Inbox", icon: Sparkles, tile: "bg-emerald-500/15", iconColor: "text-emerald-500" },
  { to: "/board", label: "Bảng ghim", icon: Pin, tile: "bg-amber-500/15", iconColor: "text-amber-500" },
  { to: "/notifications", label: "Thông báo", icon: Bell, tile: "bg-rose-500/15", iconColor: "text-rose-500" },
  { to: "/feedback", label: "Gửi feedback", icon: MessageSquare, tile: "bg-indigo-500/15", iconColor: "text-indigo-500" },
  { to: "/profile", label: "Hồ sơ của tôi", icon: User, tile: "bg-teal-500/15", iconColor: "text-teal-500" },
];

function greeting(hour: number): string {
  if (hour >= 5 && hour < 11) return "Morning glow! Hôm nay định “chốt đơn” những gì đây,";
  if (hour >= 11 && hour < 14) return "Chào buổi trưa! Nạp năng lượng rồi chiến tiếp nào,";
  if (hour >= 14 && hour < 18) return "Chiều rồi! Ráng thêm chút nữa là về đích,";
  if (hour >= 18 && hour < 22) return "Buổi tối an lành! Nhìn lại một ngày của mình nhé,";
  return "Khuya rồi đó! Nghỉ ngơi sớm để mai bừng năng lượng,";
}

function Home() {
  const { user, profile } = useAuth();
  const name = profile?.display_name || user?.email?.split("@")[0] || "bạn";
  const initial = name.charAt(0).toUpperCase();
  const hello = useMemo(() => greeting(new Date().getHours()), []);

  // Câu quote: chọn ngẫu nhiên mỗi lần tải trang (F5 sẽ đổi câu)
  const [qi] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const quote = QUOTES[qi];

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-14">
      <div className="w-full max-w-4xl">
        {/* Lời chào */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="size-14 ring-2 ring-primary/30">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-primary/20 text-primary text-lg font-semibold">{initial}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-muted-foreground text-sm sm:text-base">{hello}</div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              {name} ơi! <span className="text-2xl">🌾</span>
            </h1>
          </div>
        </div>

        {/* Câu quote động lực */}
        <div className="rounded-2xl border bg-muted/40 px-6 py-6 text-center mb-10">
          <blockquote key={qi} className="animate-in fade-in duration-700">
            <p className="text-base sm:text-lg font-medium italic text-foreground/90">“{quote.text}”</p>
            <footer className="mt-2 text-sm text-muted-foreground">— {quote.author} —</footer>
          </blockquote>
        </div>

        {/* Lưới thẻ điều hướng */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.to}
                to={c.to}
                className="group surface rounded-xl border p-4 flex items-center gap-3 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${c.tile}`}>
                  <Icon className={`size-5 ${c.iconColor}`} />
                </div>
                <span className="font-medium flex-1 min-w-0 truncate">{c.label}</span>
                <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
