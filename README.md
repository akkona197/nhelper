# nhelper (Master Task)

Ứng dụng web quản lý công việc cá nhân theo lịch tuần. Người dùng tạo task (một lần hoặc lặp lại), xếp lên lịch, theo dõi khối lượng công việc, và dán tin nhắn/email để AI bóc tách thành task.

Tên hiển thị trong ứng dụng: **Master Task**. Tên repo: **nhelper**. Giao diện bằng tiếng Việt.

Bản đang chạy: https://master-task.akkona197.workers.dev

## Tính năng

| Màn hình | Route | Chức năng |
|---|---|---|
| Trang chủ | `/` | Lối vào nhanh tới các màn hình |
| Lịch | `/lich` | Xem theo Ngày, 3 ngày, Tuần, Tháng. Kéo thả task giữa các ngày, kéo task vào dự án hoặc nhãn để gán, dời task quá hạn về hôm nay, chỉnh độ rộng cột |
| Workload | `/workload` | Tổng giờ ước tính theo tuần, trung bình giờ mỗi ngày (chia 6 ngày làm việc, trừ Chủ nhật), tỷ lệ hoàn thành, biểu đồ giờ ước tính theo ngày |
| AI Inbox | `/inbox` | Dán đoạn tin nhắn/email, AI trả về danh sách task đề xuất (tiêu đề, mô tả, ưu tiên, thời gian ước tính, deadline) để thêm từng task |
| Thông báo | `/notifications` | Danh sách thông báo trong ứng dụng, bật thông báo trình duyệt, đánh dấu đã đọc, xoá |
| Bảng ghim | `/board` | Giấy note kéo thả, đổi kích cỡ, đổi màu, đính kèm ảnh |
| Feedback | `/feedback` | Gửi góp ý (lỗi, ý tưởng, khác) |
| Hồ sơ | `/profile` | Thông tin cá nhân, ảnh đại diện, cá nhân hóa giao diện, hình nền |
| Đăng nhập | `/auth` | Đăng nhập và tạo tài khoản bằng Supabase Auth |

Chức năng bổ trợ:

- Task lặp lại theo ngày hoặc theo thứ trong tuần, có ngày bắt đầu và ngày kết thúc. Mỗi lần xuất hiện của task lặp được lưu thành một bản ghi riêng trong `task_instances`.
- Nhắc việc: hook `useReminders` kiểm tra mỗi phút, khi chạm mốc `reminder_minutes` thì hiện toast, gửi thông báo trình duyệt (nếu được cấp quyền) và ghi vào bảng `notifications`. Thông báo mới cũng đẩy realtime qua Supabase Realtime.
- Ghi chú theo task bằng trình soạn thảo rich text (Tiptap), có ảnh.
- Hướng dẫn lần đầu (Welcome và Tour) do nhân vật Bé Lúa dẫn đường.

## Công nghệ

- Framework: TanStack Start, TanStack Router, TanStack Query, React 19, TypeScript
- Build: Vite 7, Nitro
- UI: Tailwind CSS 4, shadcn/ui (Radix UI), lucide-react, framer-motion, Recharts, Sonner
- Editor: Tiptap
- Backend: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- AI: Cloudflare Workers AI, gọi từ Edge Function
- Hosting: Cloudflare Workers (`wrangler.jsonc`)
- Công cụ: ESLint, Prettier, Bun (`bunfig.toml`)

## Cấu trúc thư mục

```
src/
  routes/              Các màn hình (file-based routing của TanStack Router)
  components/          Component ứng dụng (AppShell, TaskDialog, NotesPanel, Tour, ...)
  components/ui/       Component shadcn/ui
  context/             AuthContext, PreferencesContext
  hooks/               useReminders, use-mobile
  integrations/supabase/  Client, middleware xác thực, types sinh tự động
  lib/scheduling.ts    Kiểu dữ liệu task và logic xác định task lặp xuất hiện vào ngày nào
supabase/
  config.toml
  functions/parse-tasks/  Edge Function bóc tách task bằng AI
  migrations/             Schema, RLS policy, trigger
.github/workflows/
  backup.yml           Sao lưu dữ liệu Supabase hằng ngày
```

## Mô hình dữ liệu

Bảng trong schema `public`: `profiles`, `projects`, `labels`, `tasks`, `task_instances`, `task_labels`, `task_notes`, `board_notes`, `notifications`, `feedback`.

Storage bucket: `avatars`, `note-images` (cả hai private, phân quyền theo thư mục `user_id`).

Kiểu enum: `task_priority` (`low`, `medium`, `high`), `recurrence_type` (`none`, `daily`, `weekly`).

Row Level Security bật cho các bảng dữ liệu người dùng. Mỗi người dùng chỉ đọc và ghi được dữ liệu có `user_id` của chính mình. Riêng `feedback`: người dùng thêm và xem được góp ý của mình, tài khoản chủ ứng dụng xem được toàn bộ. Trigger `on_feedback_insert` tự tạo task, task instance và thông báo cho chủ ứng dụng mỗi khi có góp ý mới (lỗi: ưu tiên cao, ý tưởng: trung bình, còn lại: thấp).

Trigger `on_auth_user_created` tạo bản ghi `profiles` khi có người dùng mới.

## Chạy trên máy

Yêu cầu: Bun (hoặc Node.js 22 trở lên với npm) và một project Supabase.

```bash
bun install
bun run dev
```

Các lệnh khác:

```bash
bun run build      # build production
bun run build:dev  # build với mode development
bun run preview    # chạy thử bản build
bun run lint
bun run format
```

### Biến môi trường

File `.env` ở thư mục gốc cần các biến sau:

| Biến | Dùng cho |
|---|---|
| `VITE_SUPABASE_URL` | URL project Supabase (phía trình duyệt) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (phía trình duyệt) |
| `VITE_SUPABASE_PROJECT_ID` | ID project Supabase (phía trình duyệt) |
| `SUPABASE_URL` | URL project Supabase (phía server) |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key (phía server) |
| `SUPABASE_PROJECT_ID` | ID project Supabase (phía server) |

Chỉ đặt publishable key trong `.env`. Không đưa service role key vào repo.

### Thiết lập database

Áp dụng toàn bộ file trong `supabase/migrations/` theo thứ tự tên file lên project Supabase của bạn, ví dụ bằng Supabase CLI:

```bash
supabase link --project-ref <project-id>
supabase db push
```

Lưu ý: migration `20260728050000_feedback.sql` gắn cứng email chủ ứng dụng trong policy và trigger. Đổi email này trước khi dùng cho project khác.

## Edge Function `parse-tasks`

Nhận `{ message, now }`, gọi Cloudflare Workers AI để bóc tách task, trả về `{ tasks, model }`.

- Model chính: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Model dự phòng khi lỗi: `@cf/meta/llama-3.1-8b-instruct`.
- Đầu ra ép theo JSON schema. Mỗi task gồm `title`, `description`, `priority`, `estimate_minutes`, `deadline`.
- Quy tắc gom tách: mỗi đầu việc là một task, các dòng nhãn hoặc thông tin (kênh, PIC, link, tiêu đề tuần) gộp vào mô tả, không tạo task riêng.

Secret cần đặt cho function:

```bash
supabase secrets set CF_ACCOUNT_ID=<cloudflare-account-id> CF_API_TOKEN=<token-co-quyen-workers-ai>
supabase functions deploy parse-tasks
```

Cấu hình hiện tại trong `supabase/config.toml` là `verify_jwt = false`, nghĩa là function không yêu cầu JWT và CORS cho phép mọi origin.

## Triển khai

Cấu hình Cloudflare Workers nằm trong `wrangler.jsonc` (entry `@tanstack/react-start/server-entry`, cờ `nodejs_compat`).

Khi ứng dụng chạy trên hostname kết thúc bằng `lovable.app`, ứng dụng hiển thị `MovedNotice` và chuyển người dùng sang địa chỉ Cloudflare Workers ở trên.

## Sao lưu dữ liệu

Workflow `.github/workflows/backup.yml` chạy lúc 00:00 giờ Việt Nam hằng ngày, và chạy tay được từ tab Actions. Workflow xuất các bảng `profiles`, `projects`, `labels`, `tasks`, `task_instances`, `task_labels`, `task_notes`, `board_notes`, `notifications`, `feedback` ra một file JSON, kiểm tra JSON hợp lệ bằng `jq`, rồi upload thành artifact lưu 90 ngày.

Cần đặt secret `SUPABASE_SERVICE_ROLE_KEY` trong Settings, Secrets and variables, Actions của repo.

Workflow không sao lưu file trong Storage (`avatars`, `note-images`).
