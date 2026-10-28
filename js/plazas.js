// Plazas, plazoletas, parques y plazas de juegos del Gran Santiago. Vienen de datos/plazas.json, generado desde
// OpenStreetMap con scripts/plazas.mjs.

import { distancia, muestrear } from './geo.js';

const NOMBRE_TIPO = { plaza: 'Plaza', parque: 'Parque', juegos: 'Plaza de juegos' };

let cache = null;

export function leerPlazas(json) {
  return json.lugares.map(([lat, lon, nombre, tipo, tamano]) => ({ punto: [lat, lon], nombre, tipo, tamano }));
}

export async function cargarPlazas() {
  if (cache) return cache;
  const resp = await fetch(new URL('../datos/plazas.json', import.meta.url));
  if (!resp.ok) throw new Error('No se pudo cargar la lista de plazas.');
  cache = leerPlazas(await resp.json());
  return cache;
}

export function nombreLugar(lugar) {
  return lugar.nombre || `${NOMBRE_TIPO[lugar.tipo] || 'Plaza'} sin nombre`;
}

export function tipoLugar(lugar) {
  return (NOMBRE_TIPO[lugar.tipo] || 'Plaza').toLowerCase();
}

// Lugares por los que pasa una ruta, en el orden en que aparecen. Se considera que la ruta "pasa por" un lugar si
// algún punto de ella queda dentro de su radio aproximado (la mitad de su tamaño, mínimo 35 m).
export function lugaresEnRuta(coords, lugares) {
  if (!coords.length) return [];
  const muestras = muestrear(coords, 25);
  let [sur, oeste, norte, este] = [90, 180, -90, -180];
  for (const { p } of muestras) {
    sur = Math.min(sur, p[0]);
    norte = Math.max(norte, p[0]);
    oeste = Math.min(oeste, p[1]);
    este = Math.max(este, p[1]);
  }
  const margen = 0.004;
  const encontrados = [];
  for (const l of lugares) {
    const [lat, lon] = l.punto;
    if (lat < sur - margen || lat > norte + margen || lon < oeste - margen || lon > este + margen) continue;
    const radio = Math.max(35, l.tamano * 0.45);
    const cerca = muestras.find((m) => distancia(m.p, l.punto) <= radio);
    if (cerca) encontrados.push({ lugar: l, d: cerca.d });
  }
  return encontrados.sort((a, b) => a.d - b.d).map((x) => x.lugar);
}
