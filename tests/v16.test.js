import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoRumbo, crearInstrucciones } from '../js/guia.js';
import { unirPartes } from '../js/seguimiento.js';
import { destino } from '../js/geo.js';
import { enlaceWikipedia } from '../js/wikipedia.js';

// localStorage de mentira para probar el almacén en Node.
const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
};
const almacen = await import('../js/almacen.js');

test('Ubicarme: puntos cardinales con la cordillera como referencia', () => {
  assert.equal(textoRumbo(0), 'Hacia el norte');
  assert.equal(textoRumbo(90), 'Hacia el oriente (la cordillera al frente)');
  assert.equal(textoRumbo(270), 'Hacia el poniente (la cordillera a tu espalda)');
  assert.equal(textoRumbo(140), 'Hacia el suroriente');
  assert.equal(textoRumbo(-45), 'Hacia el norponiente');
  assert.equal(textoRumbo(200), 'Hacia el sur');
});

test('Ubicarme: cada giro sabe hacia dónde se sigue', () => {
  const a = [-33.44, -70.61];
  const b = destino(a, 0, 200);
  const pie = { modo: 'pie', ruta: { coords: [a, destino(a, 0, 100), b, destino(b, 90, 100)], giros: [{ indice: 2, angulo: 90 }] } };
  const [giro] = crearInstrucciones({ partes: [pie] }, unirPartes([pie]));
  assert.equal(giro.texto, 'Dobla a la derecha');
  assert.ok(Math.abs(giro.rumbo - 90) < 2, String(giro.rumbo));
});

test('Dex: tu nota se guarda y el respaldo no pisa la que ya está', () => {
  const d = almacen.dex();
  d.notas.n1 = 'Aquí se juntaba mi abuelo.';
  almacen.guardarDex(d);
  assert.equal(almacen.dex().notas.n1, 'Aquí se juntaba mi abuelo.');
  almacen.restaurar({ app: 'paseos', lugares: [], dex: { capturados: {}, vistos: {}, notas: { n1: 'Otra', n2: 'Nueva' } } });
  assert.deepEqual(almacen.dex().notas, { n1: 'Aquí se juntaba mi abuelo.', n2: 'Nueva' });
  assert.equal(almacen.respaldo().dex.notas.n2, 'Nueva');
});

test('Wikipedia: enlace al artículo para celular', () => {
  assert.equal(enlaceWikipedia('es:Juan XXIII'), 'https://es.m.wikipedia.org/wiki/Juan_XXIII');
  assert.equal(enlaceWikipedia(null), null);
});
