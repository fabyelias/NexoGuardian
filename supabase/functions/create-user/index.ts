import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify caller is admin
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

  const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', caller.id)
    .single()

  if (!callerProfile || !['super_admin', 'admin'].includes(callerProfile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })
  }

  const body = await req.json()
  const { email, password, first_name, last_name, role, phone, badge_number, id_document, address } = body

  // Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name, last_name, role },
  })

  if (authError || !authUser.user) {
    return new Response(JSON.stringify({ error: authError?.message ?? 'Error creating user' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Upsert profile with org and role
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: authUser.user.id,
    organization_id: callerProfile.organization_id,
    role,
    first_name,
    last_name,
    phone: phone || null,
    badge_number: badge_number || null,
    id_document: id_document || null,
    address: address || null,
    is_active: true,
  })

  if (profileError) {
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ id: authUser.user.id, email }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
