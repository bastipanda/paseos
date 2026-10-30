// Lugares con punto en el mapa, desde los archivos de datos/ (generados desde OpenStreetMap con scripts/):
// plazas, plazoletas, parques y plazas de juegos; lugares interesantes; bebederos y baños.

import { distancia, muestrear } from './geo.js';

const NOMBRE_TIPO = {
  plaza: 'Plaza',
  parque: 'Parque',
  juegos: 'Plaza de juegos',
  museo: 'Museo',
  mirador: 'Mirador',
  arte: 'Obra de arte',
  cultura: 'Lugar cultural',
  historia: 'Lugar histórico',
  atraccion: 'Atractivo',
  agua: 'Bebedero',
  baño: 'Baño público',
};

export function leerPlazas(json) {
  return json.lugares.map(([lat, lon, nombre, tipo, tamano]) => ({ punto: [lat, lon], nombre, tipo, tamano }));
}

export function leerInteres(json) {
  return json.lugares.map(([lat, lon, nombre, tipo, wikipedia]) => ({ punto: [lat, lon], nombre, tipo, tamano: 0, wikipedia }));
}

export function leerServicios(json) {
  return json.lugares.map(([lat, lon, tipo, nombre]) => ({ punto: [lat, lon], nombre, tipo, tamano: 0 }));
}

export function nombreLugar(lugar) {
  return lugar.nombre || `${NOMBRE_TIPO[lugar.tipo] || 'Plaza'} sin nombre`;
}

export function tipoLugar(lugar) {
  return (NOMBRE_TIPO[lugar.tipo] || 'Plaza').toLowerCase();
}

// Lugares por los que pasa una ruta, en el orden en que aparecen. Se considera que la ruta "pasa por" un lugar si
// algún punto de ella queda dentro de su radio aproximado (la mitad de su tamaño, mínimo `radioMinimo` metros).
export function lugaresEnRuta(coords, lugares, radioMinimo = 35) {
  if (!coords.length || !lugares.length) return [];
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
    const radio = Math.max(radioMinimo, l.tamano * 0.45);
    const cerca = muestras.find((m) => distancia(m.p, l.punto) <= radio);
    if (cerca) encontrados.push({ lugar: l, d: cerca.d });
  }
  return encontrados.sort((a, b) => a.d - b.d).map((x) => x.lugar);
}
