-- Feedback: người dùng gửi góp ý; trigger tự đổ về task list + thông báo của owner
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name text,
  reporter_email text,
  kind text NOT NULL DEFAULT 'other',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fb insert own" ON public.feedback;
CREATE POLICY "fb insert own" ON public.feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fb select own" ON public.feedback;
CREATE POLICY "fb select own" ON public.feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fb owner select all" ON public.feedback;
CREATE POLICY "fb owner select all" ON public.feedback FOR SELECT TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'akkona197@gmail.com');

CREATE OR REPLACE FUNCTION public.handle_new_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  new_task_id uuid;
  prio public.task_priority;
  label text;
  clean text;
BEGIN
  SELECT id INTO owner_id FROM auth.users WHERE lower(email) = 'akkona197@gmail.com' LIMIT 1;
  IF owner_id IS NULL THEN
    RETURN new;
  END IF;

  prio := CASE new.kind WHEN 'bug' THEN 'high'::public.task_priority
                        WHEN 'idea' THEN 'medium'::public.task_priority
                        ELSE 'low'::public.task_priority END;
  label := CASE new.kind WHEN 'bug' THEN '[Feedback/Lỗi] '
                         WHEN 'idea' THEN '[Feedback/Ý tưởng] '
                         ELSE '[Feedback] ' END;
  clean := left(replace(replace(new.message, chr(10), ' '), chr(13), ' '), 70);

  INSERT INTO public.tasks (user_id, title, description, priority, recurrence, estimate_minutes)
  VALUES (owner_id, label || clean,
          'Từ: ' || coalesce(new.reporter_name, '?') || ' (' || coalesce(new.reporter_email, '?') || ')' || chr(10) || chr(10) || new.message,
          prio, 'none', 15)
  RETURNING id INTO new_task_id;

  INSERT INTO public.task_instances (user_id, task_id, scheduled_date, estimate_minutes)
  VALUES (owner_id, new_task_id, current_date, 15);

  INSERT INTO public.notifications (user_id, title, body, task_id)
  VALUES (owner_id, 'Feedback mới từ ' || coalesce(new.reporter_name, 'người dùng'), left(new.message, 140), new_task_id);

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_feedback_insert ON public.feedback;
CREATE TRIGGER on_feedback_insert AFTER INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_feedback();
