CREATE TABLE public.task_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  scheduled_date date,
  author_name text NOT NULL DEFAULT 'Tôi',
  author_role text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_notes TO authenticated;
GRANT ALL ON public.task_notes TO service_role;
ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tn select own" ON public.task_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tn insert own" ON public.task_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tn update own" ON public.task_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tn delete own" ON public.task_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_task_notes_task ON public.task_notes(task_id, created_at);
CREATE TRIGGER task_notes_updated_at BEFORE UPDATE ON public.task_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();