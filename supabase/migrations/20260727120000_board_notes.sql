-- Bảng ghim (pinboard): lưu các thông báo/ghi chú quan trọng dưới dạng giấy note trên bảng

-- Đảm bảo hàm cập nhật updated_at tồn tại (tự chủ, không phụ thuộc migration cũ)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.board_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'yellow',
  pin text NOT NULL DEFAULT 'red',
  x integer NOT NULL DEFAULT 24,
  y integer NOT NULL DEFAULT 24,
  rotation real NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_notes TO authenticated;
GRANT ALL ON public.board_notes TO service_role;
ALTER TABLE public.board_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bn select own" ON public.board_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bn insert own" ON public.board_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bn update own" ON public.board_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bn delete own" ON public.board_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_board_notes_user ON public.board_notes(user_id, created_at);
CREATE TRIGGER board_notes_updated_at BEFORE UPDATE ON public.board_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
