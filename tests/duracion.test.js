import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aMetros, desdeMetros, rangoEnMetros, objetivo, cumple, desvio, restar } from '../js/duracion.js';

const aj = { largoPaso: 0.75, velocidadKmh: 4.5 };

test('convierte pasos, minutos y km a metros y de vuelta', () => {
  assert.equal(aMetros(8000, 'pasos', aj), 6000);
  assert.equal(aMetros(60, 'minutos', aj), 4500);
  assert.equal(aMetros(2.5, 'km', aj), 2500);
  assert.equal(desdeMetros(6000, 'pasos', aj), 8000);
  assert.equal(desdeMetros(4500, 'minutos', aj), 60);
});

test('rango con mínimo y máximo, solo uno, o ninguno', () => {
  assert.deepEqual(rangoEnMetros({ min: '8000', max: '10000', unidad: 'pasos' }, aj), { min: 6000, max: 7500 });
  assert.deepEqual(rangoEnMetros({ min: '', max: '5', unidad: 'km' }, aj), { min: null, max: 5000 });
  assert.throws(() => rangoEnMetros({ min: '', max: '', unidad: 'km' }, aj));
  assert.throws(() => rangoEnMetros({ min: '10', max: '5', unidad: 'km' }, aj));
});

test('objetivo apunta dentro del rango', () => {
  assert.equal(objetivo({ min: 6000, max: 8000 }), 7000);
  assert.ok(objetivo({ min: 6000, max: null }) > 6000);
  assert.ok(objetivo({ min: null, max: 6000 }) < 6000);
});

test('cumple y desvío', () => {
  const r = { min: 6000, max: 8000 };
  assert.ok(cumple(7000, r));
  assert.ok(!cumple(5000, r));
  assert.equal(desvio(5000, r), 1000);
  assert.equal(desvio(8500, r), 500);
  assert.equal(desvio(7000, r), 0);
});

test('restar el último tramo a pie', () => {
  assert.deepEqual(restar({ min: 6000, max: 8000 }, 500), { min: 5500, max: 7500 });
  assert.deepEqual(restar({ min: 300, max: 8000 }, 500), { min: null, max: 7500 });
  assert.equal(restar({ min: null, max: 400 }, 500), null);
});
