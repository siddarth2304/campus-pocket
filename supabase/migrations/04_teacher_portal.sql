-- 04_teacher_portal.sql

-- 1. Add 'teacher' role to the user_role ENUM (if it exists as an ENUM) or just rely on TEXT role.
-- Assuming user_role might still be an ENUM in some places, we try adding it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'teacher';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Enhance classroom table
ALTER TABLE public.classroom ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.classroom ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.classroom ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.classroom ADD COLUMN IF NOT EXISTS class_code TEXT UNIQUE;

-- 3. Enhance assignment table for AI RAG tests
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS exam_type TEXT;
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS generation_mode TEXT;
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS difficulty TEXT;
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS opens_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS due_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS allow_late BOOLEAN DEFAULT false;
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS questions JSONB;

-- 4. Enhance assignment_submission table
ALTER TABLE public.assignment_submission ADD COLUMN IF NOT EXISTS answers JSONB;
ALTER TABLE public.assignment_submission ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 5. Create classroom stream tables
CREATE TABLE IF NOT EXISTS public.classroom_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classroom(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.classroom_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Setup RLS
ALTER TABLE public.classroom_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view classroom posts" ON public.classroom_posts FOR SELECT USING (true);
CREATE POLICY "Teachers can create classroom posts" ON public.classroom_posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY "Anyone can view post comments" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Seed Teacher User (teacher_priya, password)
DO $$
DECLARE
  teacher_uuid UUID := '88888888-8888-8888-8888-888888888888';
  school_uuid UUID;
BEGIN
  -- Get the first school
  SELECT id INTO school_uuid FROM public.schools LIMIT 1;

  -- Create teacher in auth.users FIRST to satisfy foreign key constraint
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', teacher_uuid, 'authenticated', 'authenticated', 'teacher_priya@demo.com', crypt('password', gen_salt('bf')), now(), '{}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (teacher_uuid::text, teacher_uuid, format('{"sub": "%s", "email": "teacher_priya@demo.com"}', teacher_uuid::text)::jsonb, 'email', now(), now(), now())
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- Insert teacher in public.users
  INSERT INTO public.users (id, username, role, school_id)
  VALUES (teacher_uuid, 'teacher_priya', 'teacher', school_uuid)
  ON CONFLICT (id) DO NOTHING;
END $$;
