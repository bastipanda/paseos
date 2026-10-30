// Modo explorar: qué zonas ya conoce Bastián, en cuadros de ~50 m. Solo cuenta lo que él marca a mano (un paseo
// hecho, una ruta que ya conoce o una zona tocada en el mapa); las opciones que revisa al buscar no cuentan.

import { muestrear, distancia } from './geo.js';

export const CELDA = [0.00045, 0.00054];

export const claveCelda = (p) => `${Math.floor(p[0] / CELDA[0])},${Math.floor(p[1] / CELDA[1])}`;

export function limitesCelda(clave) {
  const [i, j] = clave.split(',').map(Number);
  return [
    [i * CELDA[0], j * CELDA[1]],
    [(i + 1) * CELDA[0], (j + 1) * CELDA[1]],
  ];
}

export function centroCelda(clave) {
  const [i, j] = clave.split(',').map(Number);
  return [(i + 0.5) * CELDA[0], (j + 0.5) * CELDA[1]];
}

export function celdasDeRuta(coords) {
  return [...new Set(muestrear(coords, 20).map((m) => claveCelda(m.p)))];
}

// Cuadros cuyo centro queda a menos de `radio` metros de `centro` (una "zona" tocada en el mapa).
export function celdasDeZona(centro, radio = 120) {
  const [ci, cj] = claveCelda(centro).split(',').map(Number);
  const pasos = Math.ceil(radio / 45) + 1;
  const celdas = [];
  for (let i = ci - pasos; i <= ci + pasos; i++) {
    for (let j = cj - pasos; j <= cj + pasos; j++) {
      const clave = `${i},${j}`;
      if (distancia(centroCelda(clave), centro) <= radio) celdas.push(clave);
    }
  }
  return celdas;
}

// Fracción de la ruta (0 a 1) que pasa por cuadros que no están marcados como conocidos.
export function novedad(coords, conocidas) {
  const muestras = coords.length === 1 ? [{ p: coords[0] }] : muestrear(coords, 25);
  if (!muestras.length) return 0;
  const nuevas = muestras.filter((m) => !conocidas.has(claveCelda(m.p))).length;
  return nuevas / muestras.length;
}
