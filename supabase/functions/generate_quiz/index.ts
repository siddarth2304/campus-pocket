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
    const { topic, difficulty, format } = await req.json()
    
    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') || '');
    // Using the lightweight optimized model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `
      You are an expert AI teacher generating an online test.
      Generate 3 highly-accurate ${format} questions on the topic: "${topic}".
      The difficulty should be: ${difficulty}.
      
      Output ONLY a raw JSON array of objects. Do not include markdown formatting like \`\`\`json.
      Format:
      [
        {
          "question": "Question text here",
          "options": ["A", "B", "C", "D"], // only if format is MCQ
          "correct_answer": "Correct option exact string or correct subjective answer key"
        }
      ]
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const questions = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Error in generate_quiz:", error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
