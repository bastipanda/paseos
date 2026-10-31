// Santiagodex: los lugares de Santiago para "coleccionar" caminando, como una Pokédex.
// Entran los lugares interesantes (museos, miradores, arte, historia, cultura, cerros) y las plazas, parques y
// plazas de juegos con nombre. El número de cada lugar sale de su distancia a Plaza Baquedano: los primeros son los
// del centro y van creciendo hacia afuera.
//
// "Visto": pasaste a menos de 150 m en un paseo con seguimiento. "Capturado": llegaste (a menos de ~40 m, o dentro
// de una plaza o parque grande), o lo marcaste a mano porque ya lo conocías. Las búsquedas no cuentan.

import { distancia, muestrear } from './geo.js';
import { comunaDe } from './territorio.js';

export const CENTRO_DEX = [-33.4372, -70.6345];
const RADIO_VISTO = 150;
export const TIPOS_DEX = ['museo', 'mirador', 'cerro', 'historia', 'arte', 'cultura', 'atraccion', 'parque', 'plaza', 'juegos'];

const normalizar = (t) => t.normalize('NFD').replace(/[^a-z0-9]/gi, '').toLowerCase();

// Radio para capturar: 40 m, o un tercio del tamaño de una plaza o parque grande (como máximo 200 m: en un parque
// largo, como el Parque Uruguay, hay que llegar cerca de su centro); los cerros, 60 m (la cumbre marcada en el mapa
// no siempre está en el camino). El tamaño es la diagonal del rectángulo que encierra el lugar.
export function radioCaptura(lugar) {
  if (lugar.tipo === 'cerro') return 60;
  return Math.max(40, Math.min(200, (lugar.tamano || 0) * 0.3));
}

// Arma la lista de la Santiagodex. Un lugar que está como plaza y también como lugar interesante (por ejemplo, la
// Plaza de Armas) aparece una sola vez.
export function crearDex(plazas, interes, comunas = null) {
  const lista = [];
  const vistos = new Map();
  const agregar = (l) => {
    if (!l.id || !l.nombre) return;
    const clave = normalizar(l.nombre);
    const repetido = (vistos.get(clave) || []).some((o) => distancia(o.punto, l.punto) < 200);
    if (repetido) return;
    vistos.set(clave, [...(vistos.get(clave) || []), l]);
    lista.push(l);
  };
  for (const l of interes) if (TIPOS_DEX.includes(l.tipo)) agregar(l);
  for (const l of plazas) if (TIPOS_DEX.includes(l.tipo)) agregar(l);
  return lista
    .map((l) => ({ ...l, d: distancia(CENTRO_DEX, l.punto) }))
    .sort((a, b) => a.d - b.d)
    .map(({ d, ...l }, i) => ({ ...l, numero: i + 1, comuna: comunas ? comunaDe(l.punto, comunas) : null }));
}

export const numeroDex = (n) => `#${String(n).padStart(4, '0')}`;

// Puntos cada 15 m a lo largo del recorrido. `seguro` es falso en los tramos de más de `maxTramo` metros: ahí el GPS
// pudo cortarse y la línea recta entre dos puntos es solo una suposición.
function muestrasDeRecorrido(coords, maxTramo) {
  if (coords.length === 1) return [{ p: coords[0], seguro: true }];
  const muestras = [];
  for (let i = 1; i < coords.length; i++) {
    const seguro = distancia(coords[i - 1], coords[i]) <= maxTramo;
    for (const m of muestrear([coords[i - 1], coords[i]], 15)) muestras.push({ p: m.p, seguro: seguro || m.d === 0 });
  }
  muestras.push({ p: coords[coords.length - 1], seguro: true });
  return muestras;
}

// Lugares que un recorrido (lista de [lat, lon]) captura o deja vistos. Solo se captura con puntos seguros; un tramo
// dudoso puede dejar un lugar como visto, nada más.
export function revisarRecorrido(coords, dex, maxTramo = 100) {
  const capturados = [];
  const vistos = [];
  if (coords.length < 1) return { capturados, vistos };
  const muestras = muestrasDeRecorrido(coords, maxTramo);
  let [sur, oeste, norte, este] = [90, 180, -90, -180];
  for (const { p } of muestras) {
    sur = Math.min(sur, p[0]);
    norte = Math.max(norte, p[0]);
    oeste = Math.min(oeste, p[1]);
    este = Math.max(este, p[1]);
  }
  const margen = 0.006;
  for (const l of dex) {
    const [lat, lon] = l.punto;
    if (lat < sur - margen || lat > norte + margen || lon < oeste - margen || lon > este + margen) continue;
    let minima = Infinity;
    let minimaSegura = Infinity;
    for (const { p, seguro } of muestras) {
      const d = distancia(p, l.punto);
      minima = Math.min(minima, d);
      if (seguro) minimaSegura = Math.min(minimaSegura, d);
    }
    if (minimaSegura <= radioCaptura(l)) capturados.push(l);
    else if (minima <= RADIO_VISTO + radioCaptura(l) - 40) vistos.push(l);
  }
  return { capturados, vistos };
}

// Suma al estado guardado ({ capturados, vistos }) lo que dejó un recorrido. Devuelve solo lo nuevo.
export function anotarRecorrido(estado, revision, fecha = new Date().toISOString()) {
  const nuevosCapturados = revision.capturados.filter((l) => !estado.capturados[l.id]);
  const nuevosVistos = revision.vistos.filter((l) => !estado.capturados[l.id] && !estado.vistos[l.id]);
  for (const l of nuevosCapturados) estado.capturados[l.id] = { fecha, como: 'gps' };
  for (const l of nuevosVistos) estado.vistos[l.id] = fecha;
  return { nuevosCapturados, nuevosVistos };
}

export function estadoDe(lugar, estado) {
  if (estado.capturados[lugar.id]) return 'capturado';
  if (estado.vistos[lugar.id]) return 'visto';
  return 'nuevo';
}

// Avance por tipo y por comuna: { total, capturados } de cada uno.
export function avanceDex(dex, estado) {
  const porTipo = {};
  const porComuna = {};
  let capturados = 0;
  let vistos = 0;
  for (const l of dex) {
    const e = estadoDe(l, estado);
    const t = (porTipo[l.tipo] ||= { total: 0, capturados: 0 });
    t.total++;
    if (l.comuna) {
      const c = (porComuna[l.comuna] ||= { total: 0, capturados: 0 });
      c.total++;
      if (e === 'capturado') c.capturados++;
    }
    if (e === 'capturado') {
      t.capturados++;
      capturados++;
    } else if (e === 'visto') vistos++;
  }
  return { total: dex.length, capturados, vistos, porTipo, porComuna };
}
