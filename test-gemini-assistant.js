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
  
  console.log("Logged in.");
  
  const { data, error } = await supabase.functions.invoke('gemini_assistant', {
    body: {
      action: 'qa',
      query: "Why is the risk high?",
      contextData: {
        attendancePercent: 50,
        avgGrade: 50,
        overdueFees: true,
        riskLevel: 'HIGH',
        reason: 'Poor attendance'
      }
    }
  });
  
  console.log("Error:", error);
  console.log("Data:", data);
}

test();
