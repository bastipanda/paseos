// Clasifica cada tramo de una ruta según el tipo de calle que registra OpenStreetMap.
// Las categorías son 'buena', 'media' y 'mala'. Ver "Definiciones" en CLAUDE.md.

const ruidoDe = (tags) => Number(tags.estimated_noise_class || 0);

export function categoriaPie(tags) {
  const h = tags.highway || '';
  const ruido = ruidoDe(tags);
  if (/^(trunk|primary)/.test(h) || ruido >= 5) return 'mala';
  if (/^(secondary|tertiary)/.test(h) || ruido === 4) return 'media';
  if (h === 'unclassified' && ruido >= 3) return 'media';
  return 'buena';
}

export function tieneCiclovia(tags) {
  return (
    tags.highway === 'cycleway' ||
    tags.bicycle === 'designated' ||
    /^(lane|track|opposite|opposite_lane|opposite_track)$/.test(tags.cycleway || '')
  );
}

export function categoriaBici(tags) {
  const h = tags.highway || '';
  const ruido = ruidoDe(tags);
  if (tieneCiclovia(tags)) return 'buena';
  const biciPermitida = ['yes', 'permissive'].includes(tags.bicycle);
  if (h === 'pedestrian' || h === 'steps') return 'mala';
  if (h === 'footway' && !biciPermitida) return 'mala';
  if (/^(trunk|primary|secondary)/.test(h)) return 'mala';
  if (/^tertiary/.test(h) || h === 'unclassified' || h === 'footway' || h === 'path' || ruido >= 4) return 'media';
  return 'buena';
}

export function categoria(tags, modo) {
  return modo === 'bici' ? categoriaBici(tags) : categoriaPie(tags);
}

// Suma metros por categoría y calcula un puntaje de 0 a 100 (100 = todo por calles buenas).
export function evaluar(tramos, modo) {
  const metros = { buena: 0, media: 0, mala: 0 };
  for (const t of tramos) metros[categoria(t.tags, modo)] += t.metros;
  const total = metros.buena + metros.media + metros.mala;
  const puntaje = total > 0 ? Math.round(((metros.buena + 0.5 * metros.media) / total) * 100) : 0;
  return { metros, total, puntaje };
}

// Junta las evaluaciones de varios tramos ponderando por largo.
export function combinar(evaluaciones) {
  const metros = { buena: 0, media: 0, mala: 0 };
  for (const e of evaluaciones) for (const k of Object.keys(metros)) metros[k] += e.metros[k];
  const total = metros.buena + metros.media + metros.mala;
  const puntaje = total > 0 ? Math.round(((metros.buena + 0.5 * metros.media) / total) * 100) : 0;
  return { metros, total, puntaje };
}
