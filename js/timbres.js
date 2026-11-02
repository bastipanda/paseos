// Timbres del Pasaporte: cada tipo de lugar tiene la forma de lo que es (plaza = copa de árbol, cerro = montaña,
// juegos = volantín…), como los timbres de estación de Japón. Se dibujan en SVG: entintado (timbrado, con tu foto),
// pendiente (llegaste y falta tu foto) o punteado (lo que falta, como silueta). El color de la tinta sale del tipo
// (`data-tipo` y la variable --tipo de la hoja de estilos). La misma forma sirve de ícono del tipo.

// Escapa texto para meterlo en el SVG (este módulo no importa nada, así se puede probar en Node).
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Borde ondulado de una roseta (las atracciones), con `n` ondas.
function roseta(n = 14, r = 29, R = 36) {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    const x = 40 + r * Math.cos(a);
    const y = 40 + r * Math.sin(a);
    if (i === 0) {
      d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
      continue;
    }
    const m = a - Math.PI / n;
    d += ` Q${(40 + R * Math.cos(m)).toFixed(1)} ${(40 + R * Math.sin(m)).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

// Cada forma en un cuadro de 80 × 80: `trazo` es el borde, `extra` líneas finas de adorno y `texto` dónde cabe lo
// escrito (centro vertical y ancho).
export const FORMAS = {
  plaza: { trazo: 'M40 6a27 27 0 1 1 0 54a27 27 0 1 1 0-54Z M35 60v13h10v-13', texto: { y: 33, ancho: 40 } },
  parque: { trazo: 'M40 5C68 20 70 56 40 75C10 56 12 20 40 5Z', extra: 'M40 66V58', texto: { y: 40, ancho: 34 } },
  juegos: { trazo: 'M40 4L70 34L40 64L10 34Z', extra: 'M40 64q-6 5 0 9q6 4 0 7', texto: { y: 34, ancho: 32 } },
  museo: { trazo: 'M8 27L40 7L72 27Z M13 27V64H67V27 M6 71H74', extra: 'M19 32v27 M61 32v27', texto: { y: 46, ancho: 36 } },
  mirador: { trazo: 'M4 40Q40 4 76 40Q40 76 4 40Z', texto: { y: 40, ancho: 44 } },
  cerro: { trazo: 'M5 71L30 22L40 36L51 13L75 71Z', texto: { y: 57, ancho: 46 } },
  historia: { trazo: 'M12 74V34a28 28 0 0 1 56 0V74Z', extra: 'M18 74V36a22 22 0 0 1 44 0V74', texto: { y: 49, ancho: 38 } },
  arte: { trazo: 'M7 11H73V69H7Z', extra: 'M13 17H67V63H13Z M7 11l6 6 M73 11l-6 6 M7 69l6-6 M73 69l-6-6', texto: { y: 40, ancho: 46 } },
  cultura: { trazo: 'M7 18H73V34a6 6 0 0 0 0 12V62H7V46a6 6 0 0 0 0-12Z', extra: 'M60 22v36', texto: { y: 40, ancho: 44 } },
  atraccion: { trazo: roseta(), extra: 'M40 15a25 25 0 1 1 0 50a25 25 0 1 1 0-50', texto: { y: 40, ancho: 38 } },
};

// La tinta de cada tipo, para lo que no lee la hoja de estilos (los puntos del mapa). Igual que --tipo en estilos.css.
export const TINTAS = {
  plaza: '#2e8a4f',
  parque: '#3d7a2a',
  juegos: '#c98a00',
  museo: '#7b3fa0',
  mirador: '#1f6fa8',
  cerro: '#8a5a3a',
  historia: '#a8741a',
  arte: '#b03a7a',
  cultura: '#c0502f',
  atraccion: '#00897b',
};

const FORMA_POR_DEFECTO = FORMAS.plaza;
export const formaDe = (tipo) => FORMAS[tipo] || FORMA_POR_DEFECTO;

// Corta un nombre en líneas de a lo más `max` letras (como mucho `maxLineas`; si sobra, termina en "…").
export function lineasDe(texto, max, maxLineas) {
  const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const junta = actual ? `${actual} ${p}` : p;
    if (junta.length <= max || !actual) actual = junta;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  const cortadas = lineas.map((l) => (l.length > max ? `${l.slice(0, max - 1)}…` : l));
  if (cortadas.length <= maxLineas) return cortadas;
  const quedan = cortadas.slice(0, maxLineas);
  const ultima = quedan[maxLineas - 1];
  quedan[maxLineas - 1] = `${ultima.length >= max ? ultima.slice(0, max - 1) : ultima}…`;
  return quedan;
}

// Fecha corta del timbre: 30·10·26.
export function fechaTimbre(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}·${dos(d.getMonth() + 1)}·${dos(d.getFullYear() % 100)}`;
}

/**
 * SVG de un timbre.
 * modo: 'tinta' (timbrado), 'pendiente' (falta tu foto) o 'punteado' (silueta de lo que falta).
 * tamano: 'mini' (solo el número) o 'grande' (número, nombre y fecha).
 * conmemorativo: doble borde y estrella (monumentos nacionales y zonas típicas).
 */
export function timbreSVG(tipo, { numero = null, nombre = '', fecha = null, modo = 'tinta', tamano = 'mini', conmemorativo = false, clase = '' } = {}) {
  const f = formaDe(tipo);
  const tinta = modo === 'tinta';
  const raya = tinta ? '' : ' stroke-dasharray="3 3"';
  const grosor = tamano === 'grande' ? 2.2 : 2.8;
  const num = numero !== null ? String(numero).padStart(4, '0') : '';
  let texto = '';
  if (tamano === 'grande') {
    const ancho = f.texto.ancho;
    const nombreLineas = nombre ? lineasDe(nombre.toLocaleUpperCase('es'), Math.max(6, Math.floor(ancho / 4)), 3) : [];
    const filas = [
      num && { t: `Nº ${num}`, s: 4.6 },
      ...nombreLineas.map((t) => ({ t, s: 6.4, negrita: true })),
      fecha && { t: fechaTimbre(fecha), s: 5 },
    ].filter(Boolean);
    const alto = filas.reduce((s, r) => s + r.s * 1.25, 0);
    let y = f.texto.y - alto / 2;
    for (const r of filas) {
      y += r.s * 1.25;
      texto += `<text x="40" y="${(y - r.s * 0.25).toFixed(1)}" font-size="${r.s}"${r.negrita ? ' font-weight="600"' : ''}>${escapar(r.t)}</text>`;
    }
  } else if (num) {
    texto = `<text x="40" y="${f.texto.y + 3}" font-size="9.5">${num}</text>`;
  }
  const doble = conmemorativo
    ? `<path d="${f.trazo}" transform="translate(40 40) scale(1.1) translate(-40 -40)" stroke-width="0.9"${raya}/>` +
      `<text x="40" y="${tipo === 'cerro' ? 9 : 3.5}" font-size="7" class="timbre-estrella">★</text>`
    : '';
  const filtro = tinta ? ' filter="url(#tinta)"' : '';
  return `<svg class="timbre ${modo}${conmemorativo ? ' conmemorativo' : ''} ${clase}" data-tipo="${escapar(tipo)}" viewBox="-6 -6 92 92" aria-hidden="true">` +
    `<g fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"${filtro}>` +
    `<path d="${f.trazo}" stroke-width="${grosor}"${raya}/>` +
    (f.extra ? `<path d="${f.extra}" stroke-width="0.9"${raya}/>` : '') +
    doble +
    `<g fill="currentColor" stroke="none" text-anchor="middle" class="timbre-texto">${texto}</g></g></svg>`;
}

// Ícono de un tipo de lugar: la forma de su timbre, en línea.
export const iconoTipo = (tipo, clase = '') =>
  `<svg class="ico ico-tipo ${clase}" viewBox="-6 -6 92 92" aria-hidden="true"><path d="${formaDe(tipo).trazo}" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
