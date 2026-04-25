import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'parent1@demo.com',
    password: 'password'
  });
  
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  
  console.log("Logged in. Getting children...");
  
  const { data: links } = await supabase
      .from('parent_student_link')
      .select('student_id')
      .eq('parent_id', authData.user.id);
      
  const studentId = links[0].student_id;
  
  console.log("Testing insight_engine for student:", studentId);
  
  const { data, error } = await supabase.functions.invoke('insight_engine', {
    body: { studentId }
  });
  
  console.log("Insight Error:", error);
  console.log("Insight Data:", data);
}

test();
