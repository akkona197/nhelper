
-- Projects
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects select own" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects insert own" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects update own" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects delete own" ON public.projects FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Labels
CREATE TABLE public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#22c55e',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labels TO authenticated;
GRANT ALL ON public.labels TO service_role;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "labels select own" ON public.labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "labels insert own" ON public.labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "labels update own" ON public.labels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "labels delete own" ON public.labels FOR DELETE USING (auth.uid() = user_id);

-- Task <-> Label junction
CREATE TABLE public.task_labels (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  PRIMARY KEY (task_id, label_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_labels TO authenticated;
GRANT ALL ON public.task_labels TO service_role;
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_labels select own" ON public.task_labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "task_labels insert own" ON public.task_labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_labels delete own" ON public.task_labels FOR DELETE USING (auth.uid() = user_id);

-- Add project_id to tasks
ALTER TABLE public.tasks ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Storage policies for note-images bucket (private, user-scoped by folder)
CREATE POLICY "note-images select own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "note-images insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "note-images update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "note-images delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);
