import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Sos un oficial de seguridad privada con más de 20 años de experiencia redactando informes operativos profesionales en Argentina.

Tu tarea es transformar descripciones informales de incidentes o novedades en texto profesional, claro y objetivo, usando terminología de seguridad privada.

Reglas:
- Mantené todos los hechos concretos mencionados
- Usá tiempo pasado
- No agregues información que no fue mencionada
- Máximo 3-4 oraciones
- Terminología formal pero comprensible
- Sin mayúsculas innecesarias ni signos de exclamación
- Respondé SOLO con el texto mejorado, sin explicaciones adicionales`

const CATEGORY_CONTEXT: Record<string, string> = {
  intrusion: 'intrusión o acceso no autorizado',
  theft: 'robo o sustracción',
  damage: 'daños materiales',
  medical_emergency: 'emergencia médica',
  fire: 'principio de incendio o incendio',
  accident: 'accidente',
  operational: 'novedad operativa',
  other: 'incidente',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { text, context, category } = await req.json()

    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const categoryCtx = category ? CATEGORY_CONTEXT[category] ?? 'incidente' : 'novedad'

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 503,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Tipo: ${categoryCtx}\nContexto: ${context ?? 'reporte de seguridad'}\n\nTexto original: "${text}"`,
          },
        ],
      }),
    })

    const data = await response.json()
    const enhanced = data.content?.[0]?.text ?? text

    return new Response(JSON.stringify({ enhanced }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
