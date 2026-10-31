// Historial de paseos y meta semanal. Funciones puras (sin pantalla ni almacenamiento) para poder probarlas.
//
// Un registro es { id, inicio, fin, minutos, metros, kcal, energicos, titulo, estilo, rastro, origen }:
// inicio y fin en texto ISO, minutos en movimiento, rastro = recorrido simplificado [[lat, lon], …] y
// origen 'gps' (paseo con seguimiento) o 'mano' (agregado a mano).
//
// Las semanas van de lunes a domingo, en la hora del celular. Se identifican por la fecha de su lunes (AAAA-MM-DD).
// Las metas son una lista [{ desde: 'AAAA-MM-DD', minutos }]: cada una vale desde la semana de `desde`.

import { simplificar } from './geo.js';
import { medirMovimiento } from './movimiento.js';
import { kcalDePaseo } from './duracion.js';

export const META_MAXIMA_SUGERIDA = 300;
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const DIA_MS = 86400000;

export const claveDia = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function lunesDe(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export const claveSemana = (fecha) => claveDia(lunesDe(fecha));

// Clave de la semana `n` semanas antes (n = 1: la semana pasada). Se calcula a mediodía para no tropezar con el
// cambio de hora.
export function semanaAnterior(fecha, n = 1) {
  const d = lunesDe(fecha);
  d.setHours(12);
  return claveSemana(new Date(d.getTime() - n * 7 * DIA_MS));
}

// Arma el registro de un paseo con seguimiento. `rastro` son las posiciones del GPS ({ p, t }).
// `subida` son los metros subidos según la ruta, en proporción a lo caminado.
export function crearRegistro({ rastro, inicio, fin, ajustes, titulo = 'Paseo', estilo = null, subida = 0 }) {
  const m = medirMovimiento(rastro, ajustes.energicoKmh);
  const kcal = kcalDePaseo({ metros: m.metros, minutos: m.minutos, subida }, ajustes);
  return {
    id: `p${inicio}`,
    inicio: new Date(inicio).toISOString(),
    fin: new Date(fin).toISOString(),
    minutos: Math.round(m.minutos * 10) / 10,
    metros: Math.round(m.metros),
    kcal: kcal === null ? null : Math.round(kcal),
    energicos: Math.round(m.minutosEnergicos * 10) / 10,
    titulo,
    estilo,
    rastro: simplificar(rastro.map((x) => x.p), 6).map(([lat, lon]) => [r5(lat), r5(lon)]),
    origen: 'gps',
  };
}

// Un paseo agregado a mano (sin GPS): fecha, minutos y, si se sabe, kilómetros.
export function registroAMano({ fecha, minutos, km = null, ajustes, titulo = 'Paseo sin la app' }) {
  const inicio = new Date(fecha);
  const metros = km ? km * 1000 : (minutos / 60) * ajustes.velocidadKmh * 1000;
  const kcal = kcalDePaseo({ metros, minutos }, ajustes);
  return {
    id: `m${inicio.getTime()}`,
    inicio: inicio.toISOString(),
    fin: new Date(inicio.getTime() + minutos * 60000).toISOString(),
    minutos,
    metros: Math.round(metros),
    kcal: kcal === null ? null : Math.round(kcal),
    energicos: 0,
    titulo,
    estilo: null,
    rastro: [],
    origen: 'mano',
  };
}

export function esRegistroValido(r) {
  return r && typeof r.id === 'string' && !Number.isNaN(Date.parse(r.inicio)) && Number.isFinite(r.minutos) && Number.isFinite(r.metros);
}

export function minutosPorSemana(registros) {
  const mapa = new Map();
  for (const r of registros) {
    const clave = claveSemana(new Date(r.inicio));
    mapa.set(clave, (mapa.get(clave) || 0) + r.minutos);
  }
  return mapa;
}

// Meta que vale para una semana, o null si todavía no había meta.
export function metaDe(metas, clave) {
  let meta = null;
  for (const m of [...metas].sort((a, b) => a.desde.localeCompare(b.desde))) {
    if (m.desde <= clave) meta = m.minutos;
  }
  return meta;
}

// Cómo va la semana: minutos, meta, semanas cumplidas seguidas y en total, y qué días hubo paseo.
// La racha cuenta la semana actual solo si ya se cumplió; si no, parte desde la semana pasada.
export function estadoSemanas(registros, metas, hoy = new Date()) {
  const actual = claveSemana(hoy);
  const porSemana = minutosPorSemana(registros);
  const cumplida = (clave) => {
    const meta = metaDe(metas, clave);
    return meta !== null && (porSemana.get(clave) || 0) >= meta;
  };
  let seguidas = 0;
  let n = cumplida(actual) ? 0 : 1;
  while (cumplida(semanaAnterior(hoy, n))) {
    seguidas++;
    n++;
  }
  const lunes = lunesDe(hoy);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    const clave = claveDia(d);
    return registros.some((r) => claveDia(new Date(r.inicio)) === clave);
  });
  return {
    clave: actual,
    minutos: porSemana.get(actual) || 0,
    meta: metaDe(metas, actual),
    seguidas,
    total: [...porSemana.keys()].filter(cumplida).length,
    dias,
  };
}

const redondear5 = (x) => Math.round(x / 5) * 5;

// Propuesta de cambio de meta al empezar una semana: subir un 10 % si cumpliste la semana pasada, o bajar un 10 %
// si las dos últimas semanas quedaste lejos (menos del 60 %). `respondida` es la semana en que ya se respondió.
export function propuestaMeta(registros, metas, hoy = new Date(), respondida = null) {
  const actual = claveSemana(hoy);
  if (respondida === actual) return null;
  const meta = metaDe(metas, actual);
  if (meta === null) return null;
  const porSemana = minutosPorSemana(registros);
  const pasada = semanaAnterior(hoy, 1);
  const metaPasada = metaDe(metas, pasada);
  if (metaPasada === null) return null;
  const minutos = porSemana.get(pasada) || 0;
  if (minutos >= metaPasada && meta < META_MAXIMA_SUGERIDA) {
    const nueva = Math.min(META_MAXIMA_SUGERIDA, Math.max(meta + 5, redondear5(meta * 1.1)));
    return { tipo: 'subir', actual: meta, nueva, minutos };
  }
  const antepasada = semanaAnterior(hoy, 2);
  const metaAnte = metaDe(metas, antepasada);
  const lejos = (min, m) => min < m * 0.6;
  if (metaAnte !== null && lejos(minutos, metaPasada) && lejos(porSemana.get(antepasada) || 0, metaAnte) && meta > 30) {
    return { tipo: 'bajar', actual: meta, nueva: Math.max(30, Math.min(meta - 5, redondear5(meta * 0.9))), minutos };
  }
  return null;
}

// Agrega una meta nueva desde la semana actual (si ya había una para esta semana, la reemplaza).
export function conMeta(metas, minutos, hoy = new Date()) {
  const desde = claveSemana(hoy);
  return [...metas.filter((m) => m.desde !== desde), { desde, minutos }].sort((a, b) => a.desde.localeCompare(b.desde));
}

// Totales de un conjunto de registros (para "este mes" o "esta semana").
export function totales(registros) {
  return registros.reduce(
    (t, r) => ({
      paseos: t.paseos + 1,
      minutos: t.minutos + r.minutos,
      metros: t.metros + r.metros,
      kcal: r.kcal === null || t.kcal === null ? null : t.kcal + r.kcal,
    }),
    { paseos: 0, minutos: 0, metros: 0, kcal: 0 },
  );
}

// Minutos de las últimas `n` semanas (de la más antigua a la actual), con la meta de cada una.
export function ultimasSemanas(registros, metas, n = 8, hoy = new Date()) {
  const porSemana = minutosPorSemana(registros);
  return Array.from({ length: n }, (_, i) => {
    const clave = semanaAnterior(hoy, n - 1 - i);
    return { clave, minutos: porSemana.get(clave) || 0, meta: metaDe(metas, clave) };
  });
}
