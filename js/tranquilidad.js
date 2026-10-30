// Clasifica cada tramo de una ruta según el tipo de calle que registra OpenStreetMap.
// Las categorías son 'buena', 'media' y 'mala', y dependen del estilo del paseo (ver "Definiciones" en CLAUDE.md):
// - tranquilo: poco ruido y verde.
// - vida: calles con gente (veredas de avenidas, paseos peatonales); lo aislado es malo.
// - noche: iluminado y transitado; callejones, senderos y calles sin luz son malos.

export const ESTILOS = {
  tranquilo: { nombre: 'Tranquilo', perfil: 'paseo-tranquilo' },
  vida: { nombre: 'Con vida', perfil: 'paseo-vida' },
  noche: { nombre: 'Noche', perfil: 'paseo-noche' },
};

const ruidoDe = (tags) => Number(tags.estimated_noise_class || 0);
const verdeDe = (tags) => Number(tags.estimated_forest_class || 0);
const esVereda = (tags) => tags.highway === 'footway' && ['sidewalk', 'crossing'].includes(tags.footway);
const callePrincipal = (h) => /^(primary|secondary|tertiary)(_link)?$/.test(h);
const aislada = (h) => /^(service|path|track|bridleway|steps)$/.test(h);

export function categoriaPie(tags) {
  const h = tags.highway || '';
  const ruido = ruidoDe(tags);
  if (/^(trunk|primary)/.test(h) || ruido >= 5) return 'mala';
  if (/^(secondary|tertiary)/.test(h) || ruido === 4) return 'media';
  if (h === 'unclassified' && ruido >= 3) return 'media';
  return 'buena';
}

export function categoriaVida(tags) {
  const h = tags.highway || '';
  if (aislada(h) || /^trunk/.test(h)) return 'mala';
  if (esVereda(tags) || callePrincipal(h) || h === 'pedestrian' || h === 'living_street') {
    return ruidoDe(tags) === 1 ? 'media' : 'buena';
  }
  return 'media';
}

export function categoriaNoche(tags) {
  const h = tags.highway || '';
  if (tags.lit === 'no') return 'mala';
  const luz = tags.lit === 'yes';
  if (aislada(h)) return luz ? 'media' : 'mala';
  if (h === 'footway' && !esVereda(tags)) return luz ? 'media' : 'mala';
  if (verdeDe(tags) >= 5 && !luz) return 'media';
  if (luz) return 'buena';
  if (esVereda(tags) || callePrincipal(h) || h === 'pedestrian') return 'buena';
  return 'media';
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

export function categoria(tags, modo, estilo = 'tranquilo') {
  if (modo === 'bici') return categoriaBici(tags);
  if (estilo === 'noche') return categoriaNoche(tags);
  if (estilo === 'vida') return categoriaVida(tags);
  return categoriaPie(tags);
}

// Suma metros por categoría y calcula un puntaje de 0 a 100 (100 = todo por calles buenas para el estilo).
export function evaluar(tramos, modo, estilo = 'tranquilo') {
  const metros = { buena: 0, media: 0, mala: 0 };
  for (const t of tramos) metros[categoria(t.tags, modo, estilo)] += t.metros;
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
