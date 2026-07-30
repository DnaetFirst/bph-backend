// ============================================================================
// rateLimit — límite de intentos por IP usando Cloudflare KV.
//
// Alternativa a considerar: Cloudflare tiene reglas de Rate Limiting nativas
// en el panel de Seguridad/WAF del dominio, sin escribir código. Para un caso
// simple como este (5 intentos de login / 5 min) puede ahorrarte todo este
// archivo — vale la pena revisarlo en el panel antes de asumir que hace
// falta este middleware.
//
// Nota sobre KV: es eventualmente consistente (la propagación entre
// datacenters puede tardar unos segundos). Para una traba básica contra
// fuerza bruta en un login es aceptable; no lo uses para lógica que
// necesite exactitud (ej. límites de facturación).
// ============================================================================

export function rateLimit({ kvBinding, limite = 5, ventanaSegundos = 300 }) {
  return async (req, res, next) => {
    const kv = req.env?.[kvBinding];
    if (!kv) {
      // Si el KV no está configurado, no bloqueamos el flujo — solo avisamos.
      console.warn(`rateLimit: binding "${kvBinding}" no encontrado, se omite el límite.`);
      return next();
    }

    const ip = req.headers['cf-connecting-ip'] || req.ip || 'desconocida';
    const clave = `ratelimit:${req.path}:${ip}`;

    const actual = await kv.get(clave);
    const intentos = actual ? parseInt(actual, 10) : 0;

    if (intentos >= limite) {
      return res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos.' });
    }

    await kv.put(clave, String(intentos + 1), { expirationTtl: ventanaSegundos });
    next();
  };
}
