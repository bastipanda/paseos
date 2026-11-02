import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMAS, formaDe, lineasDe, fechaTimbre, timbreSVG, iconoTipo, TINTAS } from '../js/timbres.js';
import { TIPOS_DEX, siguienteVisado, esConmemorativo, insigniasDe } from '../js/dex.js';

test('Pasaporte v1.8: cada tipo de lugar tiene la forma de su timbre y su tinta', () => {
  for (const tipo of TIPOS_DEX) {
    assert.ok(FORMAS[tipo], `falta la forma de ${tipo}`);
    assert.match(FORMAS[tipo].trazo, /^M/);
    assert.ok(FORMAS[tipo].texto.ancho > 20);
    assert.match(TINTAS[tipo], /^#[0-9a-f]{6}$/);
  }
  // Un tipo desconocido no rompe nada: usa la forma de plaza.
  assert.equal(formaDe('otro'), FORMAS.plaza);
  assert.match(iconoTipo('cerro'), /<svg class="ico ico-tipo/);
});

test('Timbre: número, nombre en líneas y fecha; punteado sin tinta; conmemorativo con doble borde', () => {
  const grande = timbreSVG('plaza', { numero: 412, nombre: 'Plaza Ñuñoa', fecha: '2026-10-30T22:42:00', tamano: 'grande' });
  assert.match(grande, /Nº 0412/);
  assert.match(grande, /PLAZA/);
  assert.match(grande, /ÑUÑOA/);
  assert.match(grande, /30·10·26/);
  assert.match(grande, /filter="url\(#tinta\)"/);
  const silueta = timbreSVG('cerro', { numero: 7, modo: 'punteado' });
  assert.match(silueta, />0007</);
  assert.match(silueta, /stroke-dasharray/);
  assert.doesNotMatch(silueta, /filter=/);
  assert.match(timbreSVG('museo', { conmemorativo: true }), /★/);
  // Los nombres se escapan: un nombre raro de OSM no rompe el SVG.
  const raro = timbreSVG('arte', { nombre: 'Café <Bar> & "Algo"', tamano: 'grande' });
  assert.match(raro, /&lt;BAR&gt;/);
  assert.match(raro, /&amp; &quot;ALGO&quot;/);
  assert.doesNotMatch(raro, /<Bar>|<BAR>/);
});

test('Nombre del timbre: corta en palabras y termina en "…" si no cabe', () => {
  assert.deepEqual(lineasDe('PLAZA ÑUÑOA', 10, 3), ['PLAZA', 'ÑUÑOA']);
  assert.deepEqual(lineasDe('MONUMENTO AL GENERAL BAQUEDANO', 10, 3), ['MONUMENTO', 'AL GENERAL', 'BAQUEDANO']);
  const corto = lineasDe('PARQUE INTERCOMUNAL DE LA REINA Y PEÑALOLÉN', 10, 2);
  assert.equal(corto.length, 2);
  assert.ok(corto[1].endsWith('…'));
  assert.ok(lineasDe('SUPERCALIFRAGILISTICO', 8, 2)[0].endsWith('…'));
  assert.deepEqual(lineasDe('', 10, 2), []);
  assert.equal(fechaTimbre('2026-11-01T10:00:00'), '01·11·26');
  assert.equal(fechaTimbre('no es fecha'), '');
});

test('Visados: cuánto falta para el siguiente y cuándo la página está completa', () => {
  assert.deepEqual(siguienteVisado(0, 96), { porcentaje: 25, faltan: 24 });
  assert.deepEqual(siguienteVisado(32, 96), { porcentaje: 50, faltan: 16 });
  assert.deepEqual(siguienteVisado(48, 96), { porcentaje: 100, faltan: 48 });
  assert.equal(siguienteVisado(96, 96), null);
  // 25 % de 10 es 2,5: hacen falta 3 timbres (2 de 10 es 20 %).
  assert.deepEqual(siguienteVisado(2, 10), { porcentaje: 25, faltan: 1 });
  assert.deepEqual(insigniasDe(3 / 10), [25]);
  assert.equal(siguienteVisado(0, 0), null);
});

test('Timbre conmemorativo: solo si el lugar está en un monumento o zona típica del CMN', () => {
  const entorno = { a: { m: [['Zona típica', 'Barrio Yungay']] }, b: { z: 540 } };
  assert.equal(esConmemorativo({ id: 'a' }, entorno), true);
  assert.equal(esConmemorativo({ id: 'b' }, entorno), false);
  assert.equal(esConmemorativo({ id: 'c' }, entorno), false);
  assert.equal(esConmemorativo({ id: 'a' }, null), false);
});
