import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.39.0"
import { GoogleGenerativeAI } from "npm:@google/generative-ai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { studentId } = await req.json()
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env vars');

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    const { data: attendance } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId);
      
    const { data: grades } = await supabase
      .from('assignment_submission')
      .select('percentage')
      .eq('user_id', studentId);

    const { data: fees } = await supabase
      .from('fees')
      .select('status, amount, due_date')
      .eq('student_id', studentId);

    const totalAttendance = attendance?.length || 0;
    const presentCount = attendance?.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length || 0;
    const attendancePercent = totalAttendance ? (presentCount / totalAttendance) * 100 : 100;

    const totalGrades = grades?.reduce((sum: number, g: any) => sum + Number(g.percentage), 0) || 0;
    const avgGrade = grades?.length ? totalGrades / grades.length : 100;

    const overdueFees = fees?.filter((f: any) => f.status === 'OVERDUE') || [];

    let riskLevel = 'LOW';
    let reasons = [];

    if (attendancePercent < 75) {
      riskLevel = 'HIGH';
      reasons.push(`Attendance is critically low (${attendancePercent.toFixed(1)}%)`);
    } else if (attendancePercent < 85) {
      if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
      reasons.push(`Attendance is slipping (${attendancePercent.toFixed(1)}%)`);
    }

    if (avgGrade < 60) {
      riskLevel = 'HIGH';
      reasons.push(`Average grade is failing (${avgGrade.toFixed(1)}%)`);
    } else if (avgGrade < 75) {
      if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
      reasons.push(`Average grade is below target (${avgGrade.toFixed(1)}%)`);
    }

    if (overdueFees.length > 0) {
      if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
      reasons.push(`Fees are overdue`);
    }
    
    if (reasons.length === 0) {
       reasons.push('Student is performing well.');
    }

    // --- CACHE CHECK START ---
    const { data: cacheData } = await supabase
      .from('ai_insights_cache')
      .select('insight, updated_at')
      .eq('student_id', studentId)
      .single();

    if (cacheData) {
      const cacheAgeMs = new Date().getTime() - new Date(cacheData.updated_at).getTime();
      const hoursOld = cacheAgeMs / (1000 * 60 * 60);
      
      if (hoursOld < 24) {
        // Cache hit! Return instantly without calling Gemini.
        console.log(`[Cache Hit] Returning insight for student ${studentId}. Age: ${hoursOld.toFixed(1)}h`);
        return new Response(JSON.stringify({ 
          ...cacheData.insight, 
          stats: { attendancePercent, avgGrade, overdueFees: overdueFees.length > 0 } 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }
    // --- CACHE CHECK END ---

    console.log(`[Cache Miss] Generating new insight via Gemini for student ${studentId}`);
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') || '');
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `
      You are an AI assistant for a school app called Campus Pocket.
      Analyze this student's performance:
      - Risk Level: ${riskLevel}
      - Attendance: ${attendancePercent.toFixed(1)}%
      - Average Grade: ${avgGrade.toFixed(1)}%
      - Overdue Fees: ${overdueFees.length > 0 ? 'Yes' : 'No'}
      - Rule Engine Reasons: ${reasons.join(', ')}

      Provide a JSON output ONLY with these exact fields:
      {
        "risk_level": "LOW" | "MEDIUM" | "HIGH",
        "reason": "A 1-2 sentence explanation tailored for the parent",
        "recommendations": ["Actionable step 1", "Actionable step 2"]
      }
      Do not include any Markdown formatting like \`\`\`json.
    `;

    let result;
    let insight;
    try {
      result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      insight = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("Gemini Error or Parse Error (Possibly Rate Limit):", e.message);
      
      let fallbackReason = reasons.join(', ');
      if (fallbackReason === 'Student is performing well.') {
        fallbackReason = "Based on their current stats, the student is on track. Keep encouraging their good habits.";
      } else {
        fallbackReason = "We noticed some areas that need attention based on recent data: " + fallbackReason;
      }
      
      insight = {
         risk_level: riskLevel,
         reason: fallbackReason,
         recommendations: [
           "Review the recent attendance history.",
           "Check the latest assignment scores.",
           "Ensure all pending fees are cleared."
         ]
      };
    }

    // --- UPSERT CACHE ---
    try {
      await supabase
        .from('ai_insights_cache')
        .upsert({ 
          student_id: studentId, 
          insight: insight, 
          updated_at: new Date().toISOString() 
        });
    } catch (cacheErr) {
      console.error("Failed to save cache:", cacheErr);
    }

    return new Response(JSON.stringify({ ...insight, stats: { attendancePercent, avgGrade, overdueFees: overdueFees.length > 0 } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error in insight_engine:", error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
