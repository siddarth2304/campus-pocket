import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const { action, query, contextData } = await req.json()
    
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') || '');
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    let prompt = '';
    
    if (action === 'generate_message') {
      prompt = `
        You are a helpful assistant in the Campus Pocket app for parents.
        Write a brief, polite message to a teacher regarding the student.
        Context: Attendance ${contextData.attendancePercent}%, Grade ${contextData.avgGrade}%. 
        Risk Level: ${contextData.riskLevel}.
        Reason: ${contextData.reason}.
        Keep it under 3 sentences.
      `;
    } else if (action === 'qa') {
       prompt = `
        You are Campus Pocket AI, helping a parent understand their child's school data.
        Student Data Context:
        - Attendance: ${contextData.attendancePercent}%
        - Average Grade: ${contextData.avgGrade}%
        - Overdue Fees: ${contextData.overdueFees ? 'Yes' : 'No'}
        - Overall Risk Level: ${contextData.riskLevel}

        Parent's Question: "${query}"

        Provide a concise, helpful answer directly addressing the parent's concern. Keep it under 4 sentences.
      `;
    }

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return new Response(JSON.stringify({ response: responseText.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error in gemini_assistant:", error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
