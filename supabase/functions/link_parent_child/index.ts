import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { studentUsername, studentPassword } = await req.json()
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: parentUser }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !parentUser) {
      throw new Error('Unauthorized parent')
    }

    const studentEmail = `${studentUsername}@demo.com`

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: studentEmail,
      password: studentPassword
    })

    if (signInError || !signInData.user) {
      throw new Error('Invalid student credentials')
    }

    const studentId = signInData.user.id

    const { error: insertError } = await supabaseAdmin
      .from('parent_student_link')
      .insert({ parent_id: parentUser.id, student_id: studentId })

    if (insertError && insertError.code !== '23505') {
       throw insertError
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Child linked successfully', studentId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
