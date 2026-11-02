// Búsqueda de direcciones con Nominatim (OpenStreetMap). Sus reglas de uso piden como máximo una
// consulta por segundo y no buscar mientras se escribe: por eso solo se busca al apretar "Buscar".

const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
// Caja aproximada del Gran Santiago, para priorizar resultados cercanos.
const CAJA_SANTIAGO = '-70.85,-33.30,-70.45,-33.65';

let ultima = 0;

export async function buscarDireccion(texto) {
  const espera = 1100 - (Date.now() - ultima);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();
  const params = new URLSearchParams({
    q: texto,
    format: 'jsonv2',
    countrycodes: 'cl',
    viewbox: CAJA_SANTIAGO,
    limit: '6',
    'accept-language': 'es',
  });
  const resp = await fetch(`${URL_NOMINATIM}?${params}`);
  if (!resp.ok) throw new Error(`La búsqueda falló (${resp.status}).`);
  const resultados = await resp.json();
  return resultados.map((r) => ({
    nombre: r.display_name,
    corto: r.name || r.display_name.split(',')[0],
    punto: [Number(r.lat), Number(r.lon)],
  }));
}

// Lugares con ese nombre o de ese tipo cerca de `punto` (unos 3 km a la redonda), para los trámites que no están en
// los datos de la app ("correo", "notaría", una tienda en particular). Las mismas reglas: una consulta al apretar.
export async function buscarCerca(texto, punto, radio = 0.027) {
  const espera = 1100 - (Date.now() - ultima);
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();
  const [lat, lon] = punto;
  const params = new URLSearchParams({
    q: texto,
    format: 'jsonv2',
    countrycodes: 'cl',
    viewbox: [lon - radio, lat + radio, lon + radio, lat - radio].map((x) => x.toFixed(5)).join(','),
    bounded: '1',
    limit: '8',
    'accept-language': 'es',
  });
  const resp = await fetch(`${URL_NOMINATIM}?${params}`);
  if (!resp.ok) throw new Error(`La búsqueda falló (${resp.status}).`);
  const resultados = await resp.json();
  return resultados.map((r) => {
    const partes = r.display_name.split(',').map((p) => p.trim());
    // "3624, Avenida Suecia" se dice "Avenida Suecia 3624".
    const [primera, segunda] = partes.slice(1, 3);
    const direccion = /^\d+[a-z]?$/i.test(primera || '') && segunda ? `${segunda} ${primera}` : [primera, segunda].filter(Boolean).join(', ');
    return { nombre: r.name || partes[0], direccion, punto: [Number(r.lat), Number(r.lon)] };
  });
}
