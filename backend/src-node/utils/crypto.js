// ============================================================================
// Utilidades criptográficas — todo con Web Crypto (crypto.subtle), que corre
// nativo en Cloudflare Workers sin ningún polyfill. Es la misma API que ya
// usaba tu HTML original (hashTexto, derivarPin), así que la lógica migra
// casi sin cambios.
// ============================================================================

function bytesABase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

function base64ABytes(base64) {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }

  const binario = atob(base64);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/** SHA-256 de un texto, devuelto en hex (para el hash encadenado). */
export async function sha256Hex(texto) {
  const datos = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Contenido determinístico de una evaluación para el hash encadenado.
 * Debe incluir todos los campos que, si cambiaran, deberían invalidar
 * la integridad del registro.
 */
export function contenidoEvaluacionParaHash(ev) {
  return JSON.stringify({
    id: ev.id,
    fecha: ev.fecha,
    trabajadorId: ev.trabajadorId,
    areaId: ev.areaId,
    evaluadorId: ev.evaluadorId,
    higienePorcentaje: ev.higienePorcentaje,
    uniformePorcentaje: ev.uniformePorcentaje,
    generalPorcentaje: ev.generalPorcentaje,
    hashAnterior: ev.hashAnterior || null,
  });
}

/** Deriva una clave AES-256-GCM desde una passphrase (para respaldos). */
async function derivarClaveAES(passphraseBase64) {
  const rawKey = base64ABytes(passphraseBase64);
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Cifra un objeto JSON con AES-256-GCM. Devuelve { iv, datos } en base64. */
export async function cifrarJSON(objeto, claveBase64) {
  const clave = await derivarClaveAES(claveBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new TextEncoder().encode(JSON.stringify(objeto));
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, datos);
  return {
    iv: bytesABase64(iv),
    datos: bytesABase64(new Uint8Array(cifrado)),
  };
}

/** Descifra lo generado por cifrarJSON. */
export async function descifrarJSON({ iv, datos }, claveBase64) {
  const clave = await derivarClaveAES(claveBase64);
  const ivBytes = base64ABytes(iv);
  const datosBytes = base64ABytes(datos);
  const descifrado = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    clave,
    datosBytes
  );
  return JSON.parse(new TextDecoder().decode(descifrado));
}

/** Genera una clave AES-256 aleatoria en base64 (para usar como BACKUP_ENCRYPTION_KEY). */
export async function generarClaveAESBase64() {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return bytesABase64(key);
}

/** Genera un hash salteado para el PIN usando PBKDF2 nativo. Devuelve 'saltBase64:hashBase64'. */
export async function derivarPin(pin, saltBytes = null) {
  const enc = new TextEncoder();
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  return `${bytesABase64(salt)}:${bytesABase64(new Uint8Array(hashBuffer))}`;
}

/** Verifica si un PIN coincide con su hash generado por derivarPin. */
export async function verificarPin(pin, hashAlmacenado) {
  if (!hashAlmacenado || !hashAlmacenado.includes(':')) return false;
  const [saltBase64] = hashAlmacenado.split(':');
  const saltBytes = base64ABytes(saltBase64);
  const hashIntento = await derivarPin(pin, saltBytes);
  return hashIntento === hashAlmacenado;
}
