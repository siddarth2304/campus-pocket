-- 02_seed.sql
DO $$
DECLARE
  school_uuid UUID;
  parent1_uuid UUID := '11111111-1111-1111-1111-111111111111';
  parent2_uuid UUID := '22222222-2222-2222-2222-222222222222';
  student1_uuid UUID := '33333333-3333-3333-3333-333333333333';
  student2_uuid UUID := '44444444-4444-4444-4444-444444444444';
  student3_uuid UUID := '55555555-5555-5555-5555-555555555555';
  student4_uuid UUID := '66666666-6666-6666-6666-666666666666';
  class1_uuid UUID;
  class2_uuid UUID;
  session1_uuid UUID;
  assign1_uuid UUID;
BEGIN
  -- Insert a school
  INSERT INTO public.schools (name) VALUES ('Springfield High') RETURNING id INTO school_uuid;

  -- Create Users in auth.users
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  VALUES 
  ('00000000-0000-0000-0000-000000000000', parent1_uuid, 'authenticated', 'authenticated', 'parent1@demo.com', 'password', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', parent2_uuid, 'authenticated', 'authenticated', 'parent2@demo.com', 'password', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', student1_uuid, 'authenticated', 'authenticated', 'student1@demo.com', 'password', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', student2_uuid, 'authenticated', 'authenticated', 'student2@demo.com', 'password', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', student3_uuid, 'authenticated', 'authenticated', 'student3@demo.com', 'password', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', student4_uuid, 'authenticated', 'authenticated', 'student4@demo.com', 'password', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', '');

  -- Insert users
  INSERT INTO public.users (id, username, role, school_id) VALUES
  (parent1_uuid, 'parent1', 'parent', school_uuid),
  (parent2_uuid, 'parent2', 'parent', school_uuid),
  (student1_uuid, 'student1', 'student', school_uuid),
  (student2_uuid, 'student2', 'student', school_uuid),
  (student3_uuid, 'student3', 'student', school_uuid),
  (student4_uuid, 'student4', 'student', school_uuid);

  -- Parent-Student links
  INSERT INTO public.parent_student_link (parent_id, student_id) VALUES
  (parent1_uuid, student1_uuid),
  (parent1_uuid, student2_uuid),
  (parent2_uuid, student3_uuid),
  (parent2_uuid, student4_uuid);

  -- Classrooms
  INSERT INTO public.classroom (name, school_id) VALUES ('Math 101', school_uuid) RETURNING id INTO class1_uuid;
  INSERT INTO public.classroom (name, school_id) VALUES ('Science 101', school_uuid) RETURNING id INTO class2_uuid;

  -- Memberships
  INSERT INTO public.classroom_membership (classroom_id, user_id, role) VALUES
  (class1_uuid, student1_uuid, 'student'),
  (class1_uuid, student2_uuid, 'student'),
  (class2_uuid, student3_uuid, 'student'),
  (class2_uuid, student4_uuid, 'student');

  -- Class Sessions
  INSERT INTO public.class_session (classroom_id, date, topic) VALUES (class1_uuid, '2023-10-01', 'Algebra Basics') RETURNING id INTO session1_uuid;

  -- Attendance
  INSERT INTO public.attendance (student_id, session_id, status) VALUES
  (student1_uuid, session1_uuid, 'PRESENT'),
  (student2_uuid, session1_uuid, 'ABSENT');

  -- Assignments
  INSERT INTO public.assignment (classroom_id, title) VALUES (class1_uuid, 'Midterm') RETURNING id INTO assign1_uuid;

  -- Grades
  INSERT INTO public.assignment_submission (assignment_id, user_id, percentage) VALUES
  (assign1_uuid, student1_uuid, 85.5),
  (assign1_uuid, student2_uuid, 60.0);

  -- Fees
  INSERT INTO public.fees (student_id, amount, due_date, status) VALUES
  (student1_uuid, 1000.00, '2023-11-01', 'PAID'),
  (student2_uuid, 1000.00, '2023-11-01', 'OVERDUE');

END $$;
