-- 01_rls.sql
-- Enable RLS on all tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's school_id
CREATE OR REPLACE FUNCTION get_my_school_id() RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Schools
CREATE POLICY "Users can see their own school" ON public.schools
  FOR SELECT USING (id = get_my_school_id());

-- Users
CREATE POLICY "Users can see themselves" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Parents can see linked children" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_link
      WHERE parent_id = auth.uid() AND student_id = public.users.id
    )
  );

-- Parent Student Link
CREATE POLICY "Parents see own links" ON public.parent_student_link
  FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "Students see own links" ON public.parent_student_link
  FOR SELECT USING (student_id = auth.uid());

-- Classroom
CREATE POLICY "Users see classrooms in their school" ON public.classroom
  FOR SELECT USING (school_id = get_my_school_id());

-- Classroom Membership
CREATE POLICY "Users see memberships in their school" ON public.classroom_membership
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classroom
      WHERE id = classroom_id AND school_id = get_my_school_id()
    )
  );

-- Class Session
CREATE POLICY "Users see sessions in their school classrooms" ON public.class_session
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classroom
      WHERE id = classroom_id AND school_id = get_my_school_id()
    )
  );

-- Attendance
CREATE POLICY "Students see own attendance" ON public.attendance
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Parents see linked children attendance" ON public.attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_link
      WHERE parent_id = auth.uid() AND student_id = public.attendance.student_id
    )
  );

-- Assignments
CREATE POLICY "Users see assignments in their school classrooms" ON public.assignment
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classroom
      WHERE id = classroom_id AND school_id = get_my_school_id()
    )
  );

-- Assignment Submissions
CREATE POLICY "Students see own submissions" ON public.assignment_submission
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Parents see linked children submissions" ON public.assignment_submission
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_link
      WHERE parent_id = auth.uid() AND student_id = public.assignment_submission.user_id
    )
  );

-- Fees
CREATE POLICY "Students see own fees" ON public.fees
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Parents see linked children fees" ON public.fees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_link
      WHERE parent_id = auth.uid() AND student_id = public.fees.student_id
    )
  );
