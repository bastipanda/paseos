// Cálculos geográficos. Los puntos son [lat, lon] en grados; las distancias, en metros.

const RADIO_TIERRA = 6371000;
const rad = (g) => (g * Math.PI) / 180;
const grad = (r) => (r * 180) / Math.PI;

export function distancia(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Punto al que se llega avanzando `metros` desde `p` con rumbo `rumbo` (0 = norte, 90 = este).
export function destino(p, rumbo, metros) {
  const d = metros / RADIO_TIERRA;
  const t = rad(rumbo);
  const lat1 = rad(p[0]);
  const lon1 = rad(p[1]);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(t));
  const lon2 =
    lon1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [grad(lat2), grad(lon2)];
}

export function rumbo(a, b) {
  const lat1 = rad(a[0]);
  const lat2 = rad(b[0]);
  const dLon = rad(b[1] - a[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (grad(Math.atan2(y, x)) + 360) % 360;
}

// Proyección plana local alrededor de `origen`: sirve para distancias cortas (unos pocos km).
export function aPlano(origen, p) {
  const k = Math.cos(rad(origen[0]));
  return [rad(p[1] - origen[1]) * k * RADIO_TIERRA, rad(p[0] - origen[0]) * RADIO_TIERRA];
}

export function desdePlano(origen, xy) {
  const k = Math.cos(rad(origen[0]));
  return [origen[0] + grad(xy[1] / RADIO_TIERRA), origen[1] + grad(xy[0] / (RADIO_TIERRA * k))];
}

// Punto de una elipse con focos `a` y `b`, donde la suma de distancias a los focos es `suma`.
// `angulo` en grados recorre la elipse: 90 y 270 son los puntos más alejados de la línea a-b.
export function puntoEnElipse(a, b, suma, angulo) {
  const centro = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const [bx, by] = aPlano(centro, b);
  const c = Math.hypot(bx, by);
  const semiMayor = Math.max(suma / 2, c);
  const semiMenor = Math.sqrt(Math.max(0, semiMayor ** 2 - c ** 2));
  const ux = c > 0 ? bx / c : 1;
  const uy = c > 0 ? by / c : 0;
  const t = rad(angulo);
  const x = semiMayor * Math.cos(t);
  const y = semiMenor * Math.sin(t);
  return desdePlano(centro, [x * ux - y * uy, x * uy + y * ux]);
}

export function largoDeLinea(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += distancia(coords[i - 1], coords[i]);
  return total;
}

// Distancias acumuladas desde el inicio de la línea hasta cada punto.
export function acumuladas(coords) {
  const acc = [0];
  for (let i = 1; i < coords.length; i++) acc.push(acc[i - 1] + distancia(coords[i - 1], coords[i]));
  return acc;
}

// Punto más cercano a `p` dentro del segmento a-b. Devuelve la distancia y la fracción del segmento (0 a 1).
function proyectarEnSegmento(p, a, b) {
  const [ax, ay] = aPlano(p, a);
  const [bx, by] = aPlano(p, b);
  const dx = bx - ax;
  const dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  let t = largo2 > 0 ? -(ax * dx + ay * dy) / largo2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { distancia: Math.hypot(ax + t * dx, ay + t * dy), t };
}

// Ubica una posición sobre la línea. Busca primero cerca de la última ubicación conocida para no
// "saltar" a otra parte de la ruta cuando un tramo pasa cerca de otro (por ejemplo, al volver al inicio).
export function ubicarEnLinea(coords, acc, p, indicePrevio = 0, ventana = 60) {
  const buscar = (desde, hasta) => {
    let mejor = null;
    for (let i = Math.max(0, desde); i < Math.min(coords.length - 1, hasta); i++) {
      const r = proyectarEnSegmento(p, coords[i], coords[i + 1]);
      if (!mejor || r.distancia < mejor.distancia) {
        const largo = acc[i + 1] - acc[i];
        mejor = { indice: i, distancia: r.distancia, recorrido: acc[i] + r.t * largo };
      }
    }
    return mejor;
  };
  let mejor = buscar(indicePrevio - 5, indicePrevio + ventana);
  if (!mejor || mejor.distancia > 60) {
    const global = buscar(0, coords.length);
    if (global && (!mejor || global.distancia < mejor.distancia)) mejor = global;
  }
  return mejor;
}

// Fracción del largo de la ruta que se recorre dos veces (ida y vuelta por la misma calle).
// Se marca un punto cada `paso` metros y se cuenta como repetido si otro punto, lejano a lo largo de la
// ruta, queda a menos de `radio` metros.
export function fraccionRepetida(coords, paso = 25, radio = 15, separacionMinima = 150) {
  const muestras = muestrear(coords, paso);
  if (muestras.length < 3) return 0;
  const origen = muestras[0].p;
  const celda = radio;
  const grilla = new Map();
  const xy = muestras.map((m) => aPlano(origen, m.p));
  xy.forEach(([x, y], i) => {
    const clave = `${Math.floor(x / celda)},${Math.floor(y / celda)}`;
    if (!grilla.has(clave)) grilla.set(clave, []);
    grilla.get(clave).push(i);
  });
  let repetidas = 0;
  xy.forEach(([x, y], i) => {
    const cx = Math.floor(x / celda);
    const cy = Math.floor(y / celda);
    let encontrada = false;
    for (let dx = -1; dx <= 1 && !encontrada; dx++) {
      for (let dy = -1; dy <= 1 && !encontrada; dy++) {
        for (const j of grilla.get(`${cx + dx},${cy + dy}`) || []) {
          if (Math.abs(muestras[j].d - muestras[i].d) < separacionMinima) continue;
          if (Math.hypot(xy[j][0] - x, xy[j][1] - y) < radio) {
            encontrada = true;
            break;
          }
        }
      }
    }
    if (encontrada) repetidas++;
  });
  return repetidas / muestras.length;
}

// Puntos cada `paso` metros a lo largo de la línea, con su distancia desde el inicio.
export function muestrear(coords, paso) {
  if (coords.length === 0) return [];
  const res = [{ p: coords[0], d: 0 }];
  let recorrido = 0;
  let siguiente = paso;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const largo = distancia(a, b);
    while (largo > 0 && recorrido + largo >= siguiente) {
      const t = (siguiente - recorrido) / largo;
      res.push({ p: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], d: siguiente });
      siguiente += paso;
    }
    recorrido += largo;
  }
  return res;
}

// Simplifica una línea quitando puntos que se desvían menos de `tolerancia` metros (algoritmo de Douglas-Peucker).
// Sirve para guardar el recorrido de un paseo ocupando poco espacio.
export function simplificar(coords, tolerancia = 8) {
  if (coords.length < 3) return coords.slice();
  const guardar = new Uint8Array(coords.length);
  guardar[0] = 1;
  guardar[coords.length - 1] = 1;
  const pila = [[0, coords.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop();
    let mayor = 0;
    let indice = -1;
    for (let k = i + 1; k < j; k++) {
      const d = proyectarEnSegmento(coords[k], coords[i], coords[j]).distancia;
      if (d > mayor) {
        mayor = d;
        indice = k;
      }
    }
    if (indice >= 0 && mayor > tolerancia) {
      guardar[indice] = 1;
      pila.push([i, indice], [indice, j]);
    }
  }
  return coords.filter((_, k) => guardar[k]);
}

// Parecido entre dos rutas (0 a 1): qué tanto comparten las mismas cuadras de 50 m.
export function parecido(coordsA, coordsB, celda = 50) {
  const celdas = (coords) => {
    const origen = [-33.45, -70.65];
    const set = new Set();
    for (const m of muestrear(coords, celda / 2)) {
      const [x, y] = aPlano(origen, m.p);
      set.add(`${Math.floor(x / celda)},${Math.floor(y / celda)}`);
    }
    return set;
  };
  const a = celdas(coordsA);
  const b = celdas(coordsB);
  let comunes = 0;
  for (const c of a) if (b.has(c)) comunes++;
  const union = a.size + b.size - comunes;
  return union === 0 ? 1 : comunes / union;
}
