// Densidad de comercio (datos/comercio.json): cuántos locales (tiendas, cafés, restoranes, bares) hay en cada cuadro
// de ~100 m. Sirve para "Pasar por cafés y tiendas" y para el estilo "Con vida".

import { muestrear } from './geo.js';

const puntosCache = new WeakMap();

export function leerComercio(json) {
  return { celda: json.celda, celdas: json.celdas };
}

const clave = (p, celda) => `${Math.floor(p[0] / celda[0])},${Math.floor(p[1] / celda[1])}`;

// Locales en los cuadros por los que pasa la ruta (cada cuadro se cuenta una vez).
export function comercioEnRuta(coords, datos) {
  const vistos = new Set();
  let total = 0;
  for (const { p } of muestrear(coords, 30)) {
    const k = clave(p, datos.celda);
    if (vistos.has(k)) continue;
    vistos.add(k);
    total += datos.celdas[k] || 0;
  }
  return total;
}

// Centros de los cuadros con al menos `minimo` locales, para usarlos como puntos intermedios.
export function puntosDeComercio(datos, minimo = 4) {
  if (puntosCache.has(datos)) return puntosCache.get(datos);
  const lista = Object.entries(datos.celdas)
    .filter(([, n]) => n >= minimo)
    .map(([k, n]) => {
      const [i, j] = k.split(',').map(Number);
      return { punto: [(i + 0.5) * datos.celda[0], (j + 0.5) * datos.celda[1]], locales: n };
    });
  puntosCache.set(datos, lista);
  return lista;
}
