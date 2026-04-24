-- 00_schema.sql
CREATE TYPE user_role AS ENUM ('student', 'parent');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE');
CREATE TYPE fee_status AS ENUM ('PAID', 'PENDING', 'OVERDUE');

CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role user_role NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL
);

CREATE TABLE public.parent_student_link (
  parent_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE public.classroom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL
);

CREATE TABLE public.classroom_membership (
  classroom_id UUID REFERENCES public.classroom(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (classroom_id, user_id)
);

CREATE TABLE public.class_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classroom(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  topic TEXT NOT NULL
);

CREATE TABLE public.attendance (
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.class_session(id) ON DELETE CASCADE,
  status attendance_status NOT NULL,
  PRIMARY KEY (student_id, session_id)
);

CREATE TABLE public.assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID REFERENCES public.classroom(id) ON DELETE CASCADE,
  title TEXT NOT NULL
);

CREATE TABLE public.assignment_submission (
  assignment_id UUID REFERENCES public.assignment(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  percentage NUMERIC(5, 2) NOT NULL,
  PRIMARY KEY (assignment_id, user_id)
);

CREATE TABLE public.fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  status fee_status NOT NULL
);
