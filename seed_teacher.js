const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedTeacher() {
  console.log("Starting Teacher Seed Process...");

  // 1. Official Supabase Auth Signup
  console.log("Signing up teacher via Auth API...");
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'teacher_priya_real@demo.com',
    password: 'password',
  });

  if (authError) {
    console.error("Auth Error:", authError.message);
    return;
  }

  console.log("Successfully created Auth User:", authData.user.id);

  // 2. Get first school
  const { data: schoolData, error: schoolError } = await supabase
    .from('schools')
    .select('id')
    .limit(1)
    .single();

  if (schoolError || !schoolData) {
    console.error("Failed to fetch school:", schoolError);
    return;
  }

  // 3. Insert into public.users using the newly authenticated session
  console.log("Inserting into public.users...");
  const { error: profileError } = await supabase
    .from('users')
    .insert([
      {
        id: authData.user.id,
        username: 'teacher_priya_real',
        role: 'teacher',
        school_id: schoolData.id
      }
    ]);

  if (profileError) {
    console.error("Profile Error:", profileError.message);
    return;
  }

  console.log("SUCCESS! Teacher 'teacher_priya_real@demo.com' is fully seeded and linked!");
}

seedTeacher();
