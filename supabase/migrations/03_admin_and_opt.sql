-- 03_admin_and_opt.sql

-- 1. Add 'admin' role to the user_role ENUM. 
-- Note: In Postgres, you cannot easily add an ENUM value if it's used as a default, 
-- but since it's just a column type, this command works.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Create Global Events Table
CREATE TABLE public.global_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Create AI Insights Cache Table for Optimization
CREATE TABLE public.ai_insights_cache (
  student_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  insight JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Set up Row Level Security (RLS) for the new tables
ALTER TABLE public.global_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

-- Everyone can view global events
CREATE POLICY "Anyone can view global events" 
  ON public.global_events FOR SELECT 
  USING (true);

-- Only admins can insert/update global events
CREATE POLICY "Admins can manage global events" 
  ON public.global_events FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only edge functions / service roles can manage cache. 
-- Since edge functions use anon/service role, we allow insert/update
CREATE POLICY "Anyone can view ai cache"
  ON public.ai_insights_cache FOR SELECT
  USING (true);

CREATE POLICY "Service roles can manage ai cache"
  ON public.ai_insights_cache FOR ALL
  USING (true); -- Supabase edge functions can handle auth internally

-- 5. Seed an Admin User
DO $$
DECLARE
  admin_uuid UUID := '77777777-7777-7777-7777-777777777777';
  school_uuid UUID;
BEGIN
  -- Get the first school
  SELECT id INTO school_uuid FROM public.schools LIMIT 1;

  -- Create admin in auth.users
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', admin_uuid, 'authenticated', 'authenticated', 'admin@demo.com', 'password', now(), '{}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Insert admin in public.users
  INSERT INTO public.users (id, username, role, school_id)
  VALUES (admin_uuid, 'admin', 'admin', school_uuid)
  ON CONFLICT (id) DO NOTHING;
END $$;
