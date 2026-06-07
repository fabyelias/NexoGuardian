import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify caller is admin
  const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS })

  const { data: callerProfile } = await supabase
    .from('profiles').select('role, organization_id').eq('id', caller.id).single()

  if (!callerProfile || !['super_admin', 'admin'].includes(callerProfile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })
  }

  const { userId } = await req.json()
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: CORS })

  // Verify target belongs to same org
  const { data: targetProfile } = await supabase
    .from('profiles').select('organization_id, role').eq('id', userId).maybeSingle()

  if (!targetProfile || targetProfile.organization_id !== callerProfile.organization_id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS })
  }

  // Prevent deleting other admins unless super_admin
  if (targetProfile.role === 'admin' && callerProfile.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Solo un super admin puede eliminar administradores' }), { status: 403, headers: CORS })
  }

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: CORS })

  return new Response(JSON.stringify({ success: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
})
