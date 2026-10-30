// Explica en palabras por qué una ruta es (o no) buena para el estilo elegido, con lo que dicen los datos de
// OpenStreetMap y BRouter. No inventa lo que los datos no dicen: no hay datos de delitos ni del ambiente real.

import { categoria, tieneCiclovia } from './tranquilidad.js';
import { nombreLugar } from './plazas.js';
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

// Cómo se llama cada color según el estilo (para la barra, la leyenda y los textos).
export const TEXTOS_ESTILO = {
  tranquilo: {
    buena: 'tranquilas',
    media: 'intermedias',
    mala: 'avenidas o ruidosas',
    porque: { buena: 'Verde: tranquila para caminar.', media: 'Amarillo: intermedia, con algo de tráfico.', mala: 'Rojo: ruidosa o junto a una avenida grande.' },
    rojos: 'ruidosos',
    evita: { mala: 'avenidas o calles ruidosas', media: 'calles con tránsito medio' },
    limites: 'La app sabe el tipo de calle, el ruido estimado y el verde cercano. No sabe el ambiente real ni la seguridad.',
  },
  vida: {
    buena: 'calles con movimiento',
    media: 'calles más calmas',
    mala: 'tramos aislados',
    porque: { buena: 'Verde: calle con movimiento (avenida con vereda o paseo peatonal).', media: 'Amarillo: calle más calma.', mala: 'Rojo: tramo aislado (pasaje, sendero o callejón).' },
    rojos: 'aislados (pasajes, senderos o callejones)',
    evita: { mala: 'tramos aislados', media: 'calles poco transitadas' },
    limites: 'La app sabe el tipo de calle y cuánto comercio hay registrado. No sabe cuánta gente pasa de verdad ni la seguridad.',
  },
  noche: {
    buena: 'calles iluminadas o principales',
    media: 'calles sin dato de luz',
    mala: 'tramos oscuros o callejones',
    porque: { buena: 'Verde: iluminada o calle principal con movimiento.', media: 'Amarillo: sin dato de iluminación.', mala: 'Rojo: sin luz, callejón, sendero o escaleras.' },
    rojos: 'sin luz, por callejones o senderos',
    evita: { mala: 'tramos oscuros o callejones', media: 'calles sin dato de iluminación' },
    limites:
      'La app usa la iluminación registrada en OpenStreetMap (solo ~30 % de las calles tiene el dato) y el tipo de calle. ' +
      'No hay datos de delitos por calle: confía también en lo que ves.',
  },
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
const textos = (estilo) => TEXTOS_ESTILO[estilo] || TEXTOS_ESTILO.tranquilo;

export function nombreCalle(tags) {
  if (tags.highway === 'footway' && tags.footway === 'sidewalk') return 'vereda';
  if (tags.highway === 'footway' && tags.footway === 'crossing') return 'cruce peatonal';
  return NOMBRES_CALLE[(tags.highway || '').replace(/_link$/, '')] || 'calle';
}

// Lo que se muestra al tocar un tramo del mapa.
export function describirTramo(tags, modo, estilo = 'tranquilo') {
  const cat = categoria(tags, modo, estilo);
  const porque =
    modo === 'bici'
      ? { buena: 'Verde: buena para pedalear.', media: 'Amarillo: con algo de tráfico.', mala: 'Rojo: difícil en bici.' }[cat]
      : textos(estilo).porque[cat];
  const detalles = [porque];
  const ruido = Number(tags.estimated_noise_class || 0);
  if (ruido) detalles.push(`Ruido estimado: ${RUIDO[ruido]}.`);
  if (tags.lit === 'yes') detalles.push('Iluminada.');
  else if (tags.lit === 'no') detalles.push('Sin iluminación registrada.');
  else if (estilo === 'noche') detalles.push('Sin dato de iluminación.');
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

// Lista de lugares sin nombres repetidos (un parque puede venir en varios pedazos en el mapa).
function listarLugares(todos, maximo = 4) {
  const vistos = new Set();
  const lugares = todos.filter((l) => !vistos.has(nombreLugar(l)) && vistos.add(nombreLugar(l)));
  const resto = lugares.length - maximo;
  if (resto <= 0) return listar(lugares.map(nombreLugar));
  return `${lugares.slice(0, maximo).map(nombreLugar).join(', ')} y ${resto} más`;
}

// Tramos seguidos de la misma categoría se cuentan como un solo bloque ("2 tramos ruidosos").
function bloques(tramos, modo, cat, estilo) {
  let n = 0;
  let metros = 0;
  let anterior = false;
  const calles = new Set();
  for (const t of tramos) {
    const es = categoria(t.tags, modo, estilo) === cat;
    if (es) {
      metros += t.metros;
      calles.add((t.tags.highway || '').replace(/_link$/, ''));
      if (!anterior) n++;
    }
    anterior = es;
  }
  return { n, metros, calles };
}

// Frases que explican una opción. Usa `opcion.extras` (lugares, comercio, luz, novedad, servicios).
export function resumir(opcion, { pasarPor = {} } = {}) {
  const estilo = opcion.estilo || 'tranquilo';
  const t = textos(estilo);
  const extras = opcion.extras || {};
  const frases = [];
  const partesPie = opcion.partes.filter((p) => p.modo === 'pie');
  const tramosPie = partesPie.flatMap((p) => p.ruta.tramos);
  const totalPie = tramosPie.reduce((s, x) => s + x.metros, 0);

  if (opcion.plaza) {
    frases.push(
      opcion.repetida > 0.3
        ? `Vas hasta ${nombreLugar(opcion.plaza)} y vuelves en parte por las mismas calles.`
        : `Vas hasta ${nombreLugar(opcion.plaza)} y vuelves por otras calles.`,
    );
  }
  if (extras.interes?.length) frases.push(`Pasa por lugares interesantes: ${listarLugares(extras.interes)}.`);
  const plazas = (extras.plazas || []).filter((l) => l !== opcion.plaza);
  if (plazas.length) frases.push(`Pasa por ${listarLugares(plazas)}.`);

  if (totalPie > 0) {
    const grupos = GRUPOS.map(([nombre, patron]) => ({
      nombre,
      metros: tramosPie.filter((x) => patron.test(x.tags.highway || '')).reduce((s, x) => s + x.metros, 0),
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

    if (estilo === 'noche') {
      frases.push(
        `El ${Math.round((extras.iluminada || 0) * 100)} % del camino tiene iluminación registrada en el mapa ` +
          '(el resto no tiene dato, no necesariamente está oscuro).',
      );
    } else if (estilo === 'tranquilo') {
      const verde = tramosPie.filter((x) => Number(x.tags.estimated_forest_class || 0) >= 3).reduce((s, x) => s + x.metros, 0);
      if (porcentaje(verde, totalPie) >= 15) frases.push(`El ${porcentaje(verde, totalPie)} % del camino tiene áreas verdes cerca.`);
    }
    if ((estilo === 'vida' || pasarPor.comercio) && extras.comercio >= 5) {
      frases.push(`Pasas cerca de unos ${extras.comercio} locales registrados (tiendas, cafés, restoranes).`);
    }

    const rojos = bloques(tramosPie, 'pie', 'mala', estilo);
    if (rojos.n) {
      const motivo =
        estilo === 'tranquilo'
          ? `, ${[...rojos.calles].some((c) => /^(primary|secondary|trunk)$/.test(c)) ? 'junto a avenidas grandes' : 'cerca de calles con mucho tráfico'}`
          : '';
      frases.push(
        `${rojos.n === 1 ? 'Hay un tramo' : `Hay ${rojos.n} tramos`} ${t.rojos} (en rojo, ${formatearDistancia(rojos.metros)} en total)${motivo}. ` +
          'La app los usa solo cuando no encuentra otra forma razonable de seguir.',
      );
    } else {
      frases.push(`No pasa por tramos ${t.rojos.split(' (')[0]}.`);
    }
  }

  if (extras.novedad !== null && extras.novedad !== undefined) {
    frases.push(`El ${Math.round(extras.novedad * 100)} % de la ruta va por calles que no tienes marcadas como conocidas.`);
  }

  const servicios = extras.servicios || [];
  if (servicios.length) {
    const agua = servicios.filter((s) => s.tipo === 'agua').length;
    const banos = servicios.filter((s) => s.tipo === 'baño').length;
    const partes = [agua && `${agua} ${agua === 1 ? 'bebedero' : 'bebederos'}`, banos && `${banos} ${banos === 1 ? 'baño público' : 'baños públicos'}`].filter(Boolean);
    frases.push(`Cerca de la ruta hay ${listar(partes)} (marcados en el mapa; puede haber más sin registrar).`);
  }

  const partesBici = opcion.partes.filter((p) => p.modo === 'bici');
  if (partesBici.length) {
    const tramos = partesBici.flatMap((p) => p.ruta.tramos);
    const total = tramos.reduce((s, x) => s + x.metros, 0);
    const ciclovia = tramos.filter((x) => tieneCiclovia(x.tags)).reduce((s, x) => s + x.metros, 0);
    frases.push(`En bici, el ${porcentaje(ciclovia, total)} % va por ciclovía.`);
    const rojos = bloques(tramos, 'bici', 'mala');
    if (rojos.n) frases.push(`${formatearDistancia(rojos.metros)} van por calles sin ciclovía, peatonales o con mucho tráfico (en rojo).`);
  }
  return frases;
}

// Compara la opción con el camino más corto entre los mismos puntos. `corto` = { metros, evaluacion }, `ruta` =
// { metros, evaluacion } del tramo que se compara y `factor` = 2 cuando el camino corto se hace de ida y vuelta.
export function textoComparacion({ corto, ruta, factor = 1, destino = '', etiqueta = 'Esta ruta', estilo = 'tranquilo' }) {
  const t = textos(estilo);
  const metrosCorto = corto.metros * factor;
  const malaCorto = corto.evaluacion.metros.mala * factor;
  const mediaCorto = corto.evaluacion.metros.media * factor;
  const pctMala = (e) => porcentaje(e.metros.mala, e.total);
  const frases = [
    `El camino más corto${destino}${factor === 2 ? ', yendo y volviendo por las mismas calles,' : ''} mide ` +
      `${formatearDistancia(metrosCorto)} y va ${pctMala(corto.evaluacion)} % por ${t.evita.mala}.`,
    `${etiqueta} mide ${formatearDistancia(ruta.metros)} y va ${pctMala(ruta.evaluacion)} % por ${t.evita.mala}.`,
  ];
  const evitaMala = malaCorto - ruta.evaluacion.metros.mala;
  const evitaMedia = mediaCorto - ruta.evaluacion.metros.media;
  const extra = ruta.metros - metrosCorto;
  if (evitaMala > 50 || evitaMedia > 200) {
    const evita = [
      evitaMala > 50 && `${formatearDistancia(evitaMala)} de ${t.evita.mala}`,
      evitaMedia > 200 && `${formatearDistancia(evitaMedia)} de ${t.evita.media}`,
    ].filter(Boolean);
    frases.push(
      extra > 30
        ? `O sea: caminas ${formatearDistancia(extra)} más para evitar ${listar(evita)}.`
        : `O sea: evitas ${listar(evita)} sin caminar más.`,
    );
  } else {
    frases.push('El camino corto ya era bastante bueno para este estilo.');
  }
  if (extra > 300) frases.push('Parte del largo extra es para cumplir la duración que pediste.');
  return frases;
}
