import beLuaImg from "@/assets/belua.png";

const NEW_URL = "https://master-task.akkona197.workers.dev";

export function MovedNotice() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-background text-foreground">
      <img src={beLuaImg} alt="Bé Lúa" className="w-32 h-32 mb-4 drop-shadow-lg select-none" draggable={false} />
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bé Lúa đã chuyển nhà! 🌾</h1>
      <p className="mt-3 text-muted-foreground max-w-md">
        Master Task đã dời sang địa chỉ mới. Trang cũ này không còn dùng nữa nhé.
      </p>

      <a
        href={NEW_URL}
        className="mt-6 inline-flex items-center gap-2 rounded-xl grad-primary text-primary-foreground font-semibold px-6 py-3 text-lg shadow-lg hover:opacity-90 transition-opacity"
      >
        Đi tới trang mới →
      </a>

      <p className="mt-4 text-sm text-muted-foreground">
        Đăng nhập bằng <b className="text-foreground">email và mật khẩu cũ</b> của bạn.
      </p>
      <p className="mt-1 text-xs text-muted-foreground break-all">master-task.akkona197.workers.dev</p>
    </div>
  );
}
