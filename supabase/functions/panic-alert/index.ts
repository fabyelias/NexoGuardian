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

  const { incidentId, guardId, organizationId } = await req.json()

  // Get guard info
  const { data: guard } = await supabase
    .from('profiles')
    .select('first_name, last_name, badge_number')
    .eq('id', guardId)
    .single()

  // Get supervisors to notify
  const { data: supervisors } = await supabase
    .from('profiles')
    .select('id, fcm_token')
    .eq('organization_id', organizationId)
    .in('role', ['admin', 'supervisor'])
    .eq('is_active', true)

  // Create notifications for each supervisor
  if (supervisors && guard) {
    const notifications = supervisors.map((s) => ({
      organization_id: organizationId,
      user_id: s.id,
      title: '🚨 ALERTA DE PÁNICO',
      body: `${guard.first_name} ${guard.last_name} (Badge: ${guard.badge_number ?? 'N/A'}) activó el botón de pánico`,
      type: 'panic',
      reference_id: incidentId,
      reference_type: 'incident',
    }))

    await supabase.from('notifications').insert(notifications)
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
