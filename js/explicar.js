// Explica en palabras por qué una ruta es (o no) tranquila, con lo que dicen los datos de OpenStreetMap y BRouter.
// No inventa lo que los datos no dicen: ambiente, belleza, comercio, gente y seguridad quedan fuera.

import { categoria, tieneCiclovia } from './tranquilidad.js';
import { lugaresEnRuta, nombreLugar } from './plazas.js';
import { formatearDistancia } from './duracion.js';

const NOMBRES_CALLE = {
  residential: 'calle residencial',
  living_street: 'calle de convivencia (prioridad para peatones)',
  service: 'pasaje o calle de servicio',
  footway: 'vereda o paseo peatonal',
  path: 'sendero',
  pedestrian: 'calle peatonal',
  steps: 'escaleras',
  track: 'camino de tierra',
  bridleway: 'sendero',
  cycleway: 'ciclovía',
  unclassified: 'calle menor',
  tertiary: 'calle de tránsito medio',
  secondary: 'avenida',
  primary: 'avenida principal',
  trunk: 'autopista urbana o vía expresa',
};

const RUIDO = {
  1: 'muy silenciosa',
  2: 'silenciosa',
  3: 'con algo de ruido',
  4: 'ruidosa',
  5: 'muy ruidosa',
  6: 'muy ruidosa, con tráfico intenso al lado',
};

const GRUPOS = [
  ['calles residenciales y pasajes', /^(residential|living_street|service)$/],
  ['veredas, senderos y paseos peatonales', /^(footway|path|pedestrian|steps|track|bridleway)$/],
  ['ciclovías', /^cycleway$/],
  ['calles de tránsito medio', /^(tertiary|tertiary_link|unclassified)$/],
  ['avenidas', /^(secondary|secondary_link|primary|primary_link|trunk|trunk_link)$/],
];

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);

export function nombreCalle(tags) {
  return NOMBRES_CALLE[(tags.highway || '').replace(/_link$/, '')] || 'calle';
}

// Lo que se muestra al tocar un tramo del mapa.
export function describirTramo(tags, modo) {
  const cat = categoria(tags, modo);
  const porque = {
    buena: modo === 'bici' ? 'Verde: buena para pedalear.' : 'Verde: tranquila para caminar.',
    media: 'Amarillo: intermedia, con algo de tráfico.',
    mala: modo === 'bici' ? 'Rojo: difícil en bici.' : 'Rojo: ruidosa o junto a una avenida grande.',
  }[cat];
  const detalles = [porque];
  const ruido = Number(tags.estimated_noise_class || 0);
  if (ruido) detalles.push(`Ruido estimado: ${RUIDO[ruido]}.`);
  if (Number(tags.estimated_forest_class || 0) >= 3) detalles.push('Hay áreas verdes cerca.');
  if (modo === 'bici') {
    detalles.push(tieneCiclovia(tags) ? 'Tiene ciclovía.' : 'Sin ciclovía.');
    if (tags.highway === 'pedestrian') detalles.push('Calle peatonal: suele haber gente y a veces no se permite la bici.');
  }
  return { titulo: mayuscula(nombreCalle(tags)), detalle: detalles.join(' '), categoria: cat };
}

function listar(nombres) {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

// Tramos seguidos de la misma categoría se cuentan como un solo bloque ("2 tramos ruidosos").
function bloques(tramos, modo, cat) {
  let n = 0;
  let metros = 0;
  let anterior = false;
  const calles = new Set();
  for (const t of tramos) {
    const es = categoria(t.tags, modo) === cat;
    if (es) {
      metros += t.metros;
      calles.add((t.tags.highway || '').replace(/_link$/, ''));
      if (!anterior) n++;
    }
    anterior = es;
  }
  return { n, metros, calles };
}

// Frases que explican una opción. `lugares` es la lista de plazas y parques (puede venir vacía).
export function resumir(opcion, lugares = []) {
  const frases = [];
  const partesPie = opcion.partes.filter((p) => p.modo === 'pie');
  const tramosPie = partesPie.flatMap((p) => p.ruta.tramos);
  const totalPie = tramosPie.reduce((s, t) => s + t.metros, 0);

  if (opcion.plaza) {
    frases.push(
      opcion.repetida > 0.3
        ? `Vas hasta ${nombreLugar(opcion.plaza)} y vuelves en parte por las mismas calles.`
        : `Vas hasta ${nombreLugar(opcion.plaza)} y vuelves por otras calles.`,
    );
  }

  const enRuta = lugaresEnRuta(opcion.partes.flatMap((p) => p.ruta.coords), lugares).filter(
    (l) => l.nombre && l !== opcion.plaza,
  );
  if (enRuta.length) {
    const resto = enRuta.length - 4;
    frases.push(
      `Pasa por ${listar(enRuta.slice(0, 4).map(nombreLugar))}${resto > 0 ? ` y ${resto} ${resto === 1 ? 'lugar' : 'lugares'} más` : ''}.`,
    );
  }

  if (totalPie > 0) {
    const grupos = GRUPOS.map(([nombre, patron]) => ({
      nombre,
      metros: tramosPie.filter((t) => patron.test(t.tags.highway || '')).reduce((s, t) => s + t.metros, 0),
    }))
      .filter((g) => porcentaje(g.metros, totalPie) >= 10)
      .sort((a, b) => b.metros - a.metros);
    if (grupos.length) {
      const [g1, g2] = grupos;
      frases.push(
        `A pie vas sobre todo por ${g1.nombre} (${porcentaje(g1.metros, totalPie)} %)` +
          (g2 ? ` y ${g2.nombre} (${porcentaje(g2.metros, totalPie)} %).` : '.'),
      );
    }

    const verde = tramosPie.filter((t) => Number(t.tags.estimated_forest_class || 0) >= 3).reduce((s, t) => s + t.metros, 0);
    if (porcentaje(verde, totalPie) >= 15) frases.push(`El ${porcentaje(verde, totalPie)} % del camino tiene áreas verdes cerca.`);

    const rojos = bloques(tramosPie, 'pie', 'mala');
    if (rojos.n) {
      const avenidas = [...rojos.calles].some((c) => /^(primary|secondary|trunk)$/.test(c));
      frases.push(
        `${rojos.n === 1 ? 'Hay un tramo ruidoso' : `Hay ${rojos.n} tramos ruidosos`} (en rojo, ${formatearDistancia(rojos.metros)} en total), ` +
          `${avenidas ? 'junto a avenidas grandes' : 'cerca de calles con mucho tráfico'}. ` +
          'La app los usa solo cuando no encuentra otra forma razonable de seguir.',
      );
    } else {
      frases.push('No pasa por tramos ruidosos.');
    }
  }

  const partesBici = opcion.partes.filter((p) => p.modo === 'bici');
  if (partesBici.length) {
    const tramos = partesBici.flatMap((p) => p.ruta.tramos);
    const total = tramos.reduce((s, t) => s + t.metros, 0);
    const ciclovia = tramos.filter((t) => tieneCiclovia(t.tags)).reduce((s, t) => s + t.metros, 0);
    frases.push(`En bici, el ${porcentaje(ciclovia, total)} % va por ciclovía.`);
    const rojos = bloques(tramos, 'bici', 'mala');
    if (rojos.n) frases.push(`${formatearDistancia(rojos.metros)} van por calles sin ciclovía, peatonales o con mucho tráfico (en rojo).`);
  }
  return frases;
}

// Compara la opción con el camino más corto entre los mismos puntos. `corto` = { metros, evaluacion }, `ruta` =
// { metros, evaluacion } del tramo que se compara y `factor` = 2 cuando el camino corto se hace de ida y vuelta.
export function textoComparacion({ corto, ruta, factor = 1, destino = '', etiqueta = 'Esta ruta' }) {
  const metrosCorto = corto.metros * factor;
  const malaCorto = corto.evaluacion.metros.mala * factor;
  const mediaCorto = corto.evaluacion.metros.media * factor;
  const pctMala = (e) => porcentaje(e.metros.mala, e.total);
  const frases = [
    `El camino más corto${destino}${factor === 2 ? ', yendo y volviendo por las mismas calles,' : ''} mide ` +
      `${formatearDistancia(metrosCorto)} y va ${pctMala(corto.evaluacion)} % por avenidas o calles ruidosas.`,
    `${etiqueta} mide ${formatearDistancia(ruta.metros)} y va ${pctMala(ruta.evaluacion)} % por tramos ruidosos.`,
  ];
  const evitaMala = malaCorto - ruta.evaluacion.metros.mala;
  const evitaMedia = mediaCorto - ruta.evaluacion.metros.media;
  const extra = ruta.metros - metrosCorto;
  if (evitaMala > 50 || evitaMedia > 200) {
    const evita = [
      evitaMala > 50 && `${formatearDistancia(evitaMala)} de avenidas o calles ruidosas`,
      evitaMedia > 200 && `${formatearDistancia(evitaMedia)} de calles con tránsito medio`,
    ].filter(Boolean);
    frases.push(
      extra > 30
        ? `O sea: caminas ${formatearDistancia(extra)} más para evitar ${listar(evita)}.`
        : `O sea: evitas ${listar(evita)} sin caminar más.`,
    );
  } else {
    frases.push('El camino corto ya era bastante tranquilo.');
  }
  if (extra > 300) frases.push('Parte del largo extra es para cumplir la duración que pediste.');
  return frases;
}
