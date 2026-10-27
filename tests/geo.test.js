import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distancia,
  destino,
  rumbo,
  puntoEnElipse,
  acumuladas,
  ubicarEnLinea,
  fraccionRepetida,
  parecido,
} from '../js/geo.js';

const plazaItalia = [-33.4372, -70.6345];
const cerca = (a, b, tolerancia) => Math.abs(a - b) <= tolerancia;

test('destino y distancia son consistentes', () => {
  for (const r of [0, 45, 90, 180, 270]) {
    const p = destino(plazaItalia, r, 1000);
    assert.ok(cerca(distancia(plazaItalia, p), 1000, 1), `rumbo ${r}`);
    assert.ok(cerca(rumbo(plazaItalia, p), r % 360, 0.5) || cerca(rumbo(plazaItalia, p), 360, 0.5));
  }
});

test('un punto de la elipse suma la distancia pedida hasta ambos focos', () => {
  const b = destino(plazaItalia, 90, 2000);
  for (const angulo of [60, 90, 120, 270]) {
    const v = puntoEnElipse(plazaItalia, b, 3000, angulo);
    assert.ok(cerca(distancia(plazaItalia, v) + distancia(v, b), 3000, 5), `ángulo ${angulo}`);
  }
});

test('ubica una posición sobre la línea', () => {
  const linea = [plazaItalia, destino(plazaItalia, 90, 500), destino(destino(plazaItalia, 90, 500), 0, 500)];
  const acc = acumuladas(linea);
  const enMedio = destino(destino(plazaItalia, 90, 250), 0, 10);
  const u = ubicarEnLinea(linea, acc, enMedio, 0);
  assert.equal(u.indice, 0);
  assert.ok(cerca(u.recorrido, 250, 2));
  assert.ok(cerca(u.distancia, 10, 1));
});

test('detecta ida y vuelta por la misma calle', () => {
  const ida = destino(plazaItalia, 90, 1000);
  assert.ok(fraccionRepetida([plazaItalia, ida, plazaItalia]) > 0.8);
  const cuadrado = [0, 90, 180, 270].reduce(
    (pts, r) => [...pts, destino(pts[pts.length - 1], r, 500)],
    [plazaItalia],
  );
  assert.ok(fraccionRepetida(cuadrado) < 0.1);
});

test('parecido entre rutas', () => {
  const a = [plazaItalia, destino(plazaItalia, 90, 1000)];
  const b = [plazaItalia, destino(plazaItalia, 0, 1000)];
  assert.ok(parecido(a, a) > 0.99);
  assert.ok(parecido(a, b) < 0.2);
});
