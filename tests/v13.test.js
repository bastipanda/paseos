import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destino, distancia, simplificar } from '../js/geo.js';
import { medirMovimiento, ritmoReciente } from '../js/movimiento.js';
import { kcalDePaseo, kcalSubida } from '../js/duracion.js';
import {
  claveSemana,
  semanaAnterior,
  crearRegistro,
  registroAMano,
  estadoSemanas,
  propuestaMeta,
  metaDe,
  conMeta,
  ultimasSemanas,
} from '../js/historial.js';

const a = [-33.43, -70.61];
const aj = { largoPaso: 0.75, velocidadKmh: 4.5, peso: 80, energicoKmh: 5, ppm: 110 };

// Rastro de GPS caminando hacia el este a `kmh`, una posición cada `cada` segundos.
function caminar(kmh, minutos, cada = 5, desde = a, t0 = Date.UTC(2026, 9, 28, 21)) {
  const rastro = [];
  for (let s = 0; s <= minutos * 60; s += cada) {
    rastro.push({ p: destino(desde, 90, (kmh / 3.6) * s), t: t0 + s * 1000 });
  }
  return rastro;
}

test('simplificar deja los extremos y quita puntos en línea recta', () => {
  const recta = Array.from({ length: 50 }, (_, i) => destino(a, 90, i * 10));
  const s = simplificar(recta, 5);
  assert.equal(s.length, 2);
  const conCodo = [...recta, ...Array.from({ length: 20 }, (_, i) => destino(recta[49], 0, (i + 1) * 10))];
  assert.equal(simplificar(conCodo, 5).length, 3);
});

test('medir movimiento: caminando cuenta, quieto (con saltos del GPS) no', () => {
  const m = medirMovimiento(caminar(5.4, 10), 5);
  assert.ok(Math.abs(m.metros - 900) < 20, `metros ${m.metros}`);
  assert.ok(Math.abs(m.minutos - 10) < 0.5);
  assert.ok(m.minutosEnergicos > 9);
  const lento = medirMovimiento(caminar(4, 10), 5);
  assert.equal(Math.round(lento.minutosEnergicos), 0);
  // Quieto 10 minutos con el GPS saltando ±4 m.
  const quieto = Array.from({ length: 120 }, (_, i) => ({ p: destino(a, (i * 77) % 360, (i % 3) * 2), t: i * 5000 }));
  const q = medirMovimiento(quieto, 5);
  assert.ok(q.minutos < 0.5, `minutos ${q.minutos}`);
  // Un hueco de 5 minutos sin GPS no se cuenta.
  const hueco = [...caminar(5, 2), ...caminar(5, 2, 5, destino(a, 90, 600), Date.UTC(2026, 9, 28, 21) + 7 * 60000)];
  assert.ok(medirMovimiento(hueco, 5).minutos < 4.5);
});

test('ritmo reciente en km/h', () => {
  assert.ok(Math.abs(ritmoReciente(caminar(5, 2)) - 5) < 0.3);
  assert.equal(ritmoReciente(caminar(5, 2).slice(0, 1)), null);
});

test('calorías: con velocidad real y sumando la subida', () => {
  assert.equal(Math.round(kcalSubida(100, aj)), 72);
  assert.equal(kcalSubida(100, { ...aj, peso: null }), null);
  // 60 min a 4 km/h (MET 3,0) con 80 kg = 240 kcal.
  assert.equal(Math.round(kcalDePaseo({ metros: 4000, minutos: 60 }, aj)), 240);
  assert.equal(Math.round(kcalDePaseo({ metros: 4000, minutos: 60, subida: 100 }, aj)), 312);
});

test('crear registro de un paseo con GPS y uno a mano', () => {
  const rastro = caminar(5, 30);
  const r = crearRegistro({ rastro, inicio: rastro[0].t, fin: rastro.at(-1).t, ajustes: aj, titulo: 'Paseo circular', estilo: 'tranquilo' });
  assert.ok(Math.abs(r.minutos - 30) < 1);
  assert.ok(Math.abs(r.metros - 2500) < 40);
  assert.ok(r.kcal > 150 && r.kcal < 200, `kcal ${r.kcal}`);
  assert.equal(r.rastro.length, 2);
  assert.equal(r.origen, 'gps');
  const m = registroAMano({ fecha: '2026-10-29T08:00', minutos: 40, ajustes: aj });
  assert.equal(m.metros, 3000);
  assert.equal(m.origen, 'mano');
});

const paseo = (fecha, minutos) => ({ id: fecha, inicio: new Date(fecha).toISOString(), minutos, metros: minutos * 75, kcal: null });

test('semanas: lunes a domingo, meta, racha y días con paseo', () => {
  const hoy = new Date(2026, 9, 30, 18); // viernes 30 de octubre de 2026
  assert.equal(claveSemana(hoy), '2026-10-26');
  assert.equal(semanaAnterior(hoy), '2026-10-19');
  assert.equal(claveSemana(new Date(2026, 10, 1, 23)), '2026-10-26'); // domingo
  const metas = [{ desde: '2026-10-05', minutos: 90 }];
  const registros = [
    paseo(new Date(2026, 9, 6, 19), 95), // semana del 5: cumplida
    paseo(new Date(2026, 9, 13, 19), 50), // semana del 12: no
    paseo(new Date(2026, 9, 20, 19), 60),
    paseo(new Date(2026, 9, 22, 19), 40), // semana del 19: cumplida (100)
    paseo(new Date(2026, 9, 27, 8), 30), // esta semana, martes
  ];
  const e = estadoSemanas(registros, metas, hoy);
  assert.equal(e.minutos, 30);
  assert.equal(e.meta, 90);
  assert.equal(e.seguidas, 1);
  assert.equal(e.total, 2);
  assert.deepEqual(e.dias, [false, true, false, false, false, false, false]);
  // Si esta semana ya se cumplió, cuenta en la racha.
  const e2 = estadoSemanas([...registros, paseo(new Date(2026, 9, 30, 8), 70)], metas, hoy);
  assert.equal(e2.seguidas, 2);
  assert.equal(metaDe(metas, '2026-09-28'), null);
});

test('propuesta de meta: subir si cumpliste, bajar si quedaste lejos dos semanas', () => {
  const hoy = new Date(2026, 9, 26, 9); // lunes
  const metas = [{ desde: '2026-10-05', minutos: 90 }];
  const cumplio = [paseo(new Date(2026, 9, 21, 19), 100)];
  assert.deepEqual(propuestaMeta(cumplio, metas, hoy), { tipo: 'subir', actual: 90, nueva: 100, minutos: 100 });
  assert.equal(propuestaMeta(cumplio, metas, hoy, '2026-10-26'), null);
  const lejos = [paseo(new Date(2026, 9, 14, 19), 20), paseo(new Date(2026, 9, 21, 19), 30)];
  assert.equal(propuestaMeta(lejos, metas, hoy).tipo, 'bajar');
  assert.equal(propuestaMeta(lejos, metas, hoy).nueva, 80);
  // Con meta en el máximo sugerido no se propone subir más.
  assert.equal(propuestaMeta(cumplio, [{ desde: '2026-10-05', minutos: 60 }, { desde: '2026-10-26', minutos: 300 }], hoy), null);
  const nuevas = conMeta(metas, 100, hoy);
  assert.equal(metaDe(nuevas, '2026-10-26'), 100);
  assert.equal(metaDe(nuevas, '2026-10-19'), 90);
  const semanas = ultimasSemanas(cumplio, metas, 3, hoy);
  assert.deepEqual(semanas.map((s) => s.minutos), [0, 100, 0]);
});

test('distancia de prueba sana', () => {
  assert.ok(distancia(a, destino(a, 0, 100)) > 99);
});
