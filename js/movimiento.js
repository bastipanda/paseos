// Mide un paseo a partir de las posiciones del GPS: distancia y tiempo en movimiento, ritmo y minutos a paso
// enérgico. El GPS "salta" algunos metros aunque estés quieto, así que se mide por ventanas de ~15 segundos y solo
// cuenta como movimiento si en esa ventana avanzaste a más de 1,8 km/h.
//
// Cada posición del `rastro` es { p: [lat, lon], t: milisegundos }.

import { distancia } from './geo.js';

const VENTANA_S = 15;
// 0,5 m/s = 1,8 km/h: más lento es estar parado (o el GPS moviéndose solo).
const VELOCIDAD_MINIMA = 0.5;
// 4 m/s = 14 km/h: más rápido es ir en bici, en auto o un salto del GPS.
const VELOCIDAD_MAXIMA = 4;
// Si el GPS deja de responder más de 2 minutos, ese rato no se cuenta.
const PAUSA_MAXIMA_S = 120;

export function medirMovimiento(rastro, umbralEnergicoKmh = 5) {
  let metros = 0;
  let segundos = 0;
  let energicos = 0;
  let ancla = rastro[0];
  for (let i = 1; i < rastro.length; i++) {
    const actual = rastro[i];
    const dt = (actual.t - ancla.t) / 1000;
    if (dt < VENTANA_S) continue;
    const d = distancia(ancla.p, actual.p);
    const v = d / dt;
    if (dt <= PAUSA_MAXIMA_S && v >= VELOCIDAD_MINIMA && v <= VELOCIDAD_MAXIMA) {
      metros += d;
      segundos += dt;
      if (v * 3.6 >= umbralEnergicoKmh) energicos += dt;
    }
    ancla = actual;
  }
  return { metros, minutos: segundos / 60, minutosEnergicos: energicos / 60 };
}

// Velocidad de los últimos `segundos` en km/h, o null si todavía no hay datos suficientes o estás detenido.
export function ritmoReciente(rastro, segundos = 45) {
  if (rastro.length < 2) return null;
  const ultimo = rastro[rastro.length - 1];
  let i = rastro.length - 1;
  while (i > 0 && (ultimo.t - rastro[i - 1].t) / 1000 <= segundos) i--;
  const ventana = rastro.slice(Math.max(0, i - 1));
  const m = medirVentana(ventana);
  if (m.segundos < 10) return null;
  const kmh = (m.metros / m.segundos) * 3.6;
  return kmh < VELOCIDAD_MINIMA * 3.6 ? 0 : kmh;
}

// Distancia y tiempo de una ventana corta, sumando saltos de al menos 5 segundos (suaviza el ruido del GPS).
function medirVentana(rastro) {
  let metros = 0;
  let ancla = rastro[0];
  for (let i = 1; i < rastro.length; i++) {
    if ((rastro[i].t - ancla.t) / 1000 < 5 && i < rastro.length - 1) continue;
    metros += distancia(ancla.p, rastro[i].p);
    ancla = rastro[i];
  }
  return { metros, segundos: (rastro[rastro.length - 1].t - rastro[0].t) / 1000 };
}
