// Comunas (contornos desde OSM, en datos/comunas.json) y robos violentos por comuna (CEAD, en datos/delitos.json).
//
// Los datos del CEAD son por comuna completa: no dicen nada de una calle en particular. Además, la tasa es por
// habitante, así que en comunas con mucha gente de paso (oficinas, comercio, como Santiago o Providencia) sale más
// alta aunque el riesgo de cada persona que camina no sea tan distinto. La app los muestra solo como contexto: no los
// usa para elegir rutas.

import { centroCelda } from './explorar.js';
import { muestrear } from './geo.js';

export function leerComunas(json) {
  return json.comunas.map((c) => ({ nombre: c.nombre, celdas: c.celdas, caja: c.caja, anillos: c.anillos }));
}

function dentro(p, anillo) {
  let adentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [yi, xi] = anillo[i];
    const [yj, xj] = anillo[j];
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}

export function comunaDe(p, comunas) {
  return (
    comunas.find((c) => p[0] >= c.caja[0] && p[0] <= c.caja[2] && p[1] >= c.caja[1] && p[1] <= c.caja[3] && c.anillos.some((a) => dentro(p, a)))?.nombre ||
    null
  );
}

// "Mis barrios": dice si un punto está dentro de alguna de las comunas elegidas (para `prefs.zona` del generador).
export function zonaDeComunas(nombres, comunas) {
  const elegidas = comunas.filter((c) => nombres.includes(c.nombre));
  return (p) => comunaDe(p, elegidas) !== null;
}

// Comunas por las que pasa una ruta, en orden, con la fracción del camino en cada una.
export function comunasDeRuta(coords, comunas) {
  const muestras = muestrear(coords, 100);
  const cuenta = new Map();
  for (const { p } of muestras) {
    const c = comunaDe(p, comunas);
    if (c) cuenta.set(c, (cuenta.get(c) || 0) + 1);
  }
  return [...cuenta].map(([nombre, n]) => ({ nombre, fraccion: n / muestras.length }));
}

// Cuánto de cada comuna conoces: cuadros conocidos dentro de la comuna sobre los cuadros con calles caminables.
export function avancePorComuna(conocidas, comunas) {
  const cuenta = new Map();
  for (const clave of conocidas) {
    const c = comunaDe(centroCelda(clave), comunas);
    if (c) cuenta.set(c, (cuenta.get(c) || 0) + 1);
  }
  return comunas
    .map((c) => ({ nombre: c.nombre, conocidas: cuenta.get(c.nombre) || 0, total: c.celdas }))
    .map((x) => ({ ...x, fraccion: x.total ? Math.min(1, x.conocidas / x.total) : 0 }))
    .sort((a, b) => b.fraccion - a.fraccion || a.nombre.localeCompare(b.nombre, 'es'));
}

// "Ñuñoa" y "Nunoa", "Til Til" y "Tiltil" se consideran la misma comuna.
const normalizar = (t) =>
  t
    .normalize('NFD')
    .replace(/[^a-z]/gi, '')
    .toLowerCase();

export function leerDelitos(json) {
  return {
    anio: json.fuente.match(/\d{4}$/)?.[0] || '',
    region: json.region,
    porComuna: new Map(json.comunas.map(([comuna, tasa, casos]) => [normalizar(comuna), { comuna, tasa, casos }])),
  };
}

export function delitosDe(comuna, delitos) {
  return delitos.porComuna.get(normalizar(comuna)) || null;
}

const entero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

// Frase con los robos violentos de las comunas por las que pasa la ruta (solo las que ocupan al menos un 10 %).
export function textoDelitos(comunasRuta, delitos) {
  const partes = comunasRuta
    .filter((c) => c.fraccion >= 0.1)
    .map((c) => ({ ...c, d: delitosDe(c.nombre, delitos) }))
    .filter((c) => c.d)
    .map((c) => {
      const veces = c.d.tasa / delitos.region.tasa;
      const comparacion = veces >= 1.15 ? `${decimal.format(veces)} veces el promedio de la región` : veces <= 0.85 ? 'bajo el promedio de la región' : 'cerca del promedio de la región';
      return `${c.d.comuna}: ${entero.format(c.d.tasa)} por cada 100 mil habitantes (${comparacion})`;
    });
  if (!partes.length) return null;
  return `Robos violentos en ${delitos.anio} (CEAD), por comuna completa. ${partes.join('; ')}. Promedio de la Región Metropolitana: ${entero.format(delitos.region.tasa)}.`;
}

export const LIMITES_DELITOS =
  'Son cifras de toda la comuna, no de estas calles. La tasa es por habitante: en comunas con mucha gente de paso ' +
  '(oficinas, comercio, centro) sale más alta. Sirve como contexto, no para decidir solo con ella.';
