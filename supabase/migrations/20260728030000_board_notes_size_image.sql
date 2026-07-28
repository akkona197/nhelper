-- Bảng ghim: thêm kích thước tuỳ chỉnh (resize) và ảnh ghim cho mỗi note
ALTER TABLE public.board_notes
  ADD COLUMN IF NOT EXISTS width integer NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS height integer NOT NULL DEFAULT 140,
  ADD COLUMN IF NOT EXISTS image_url text;
