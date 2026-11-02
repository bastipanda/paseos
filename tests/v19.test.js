import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiposDeTexto, buscarMandados, masCercanos, rangoPorNecesidad, haciaDonde, normalizar } from '../js/mandados.js';
import { destino } from '../js/geo.js';

const CASA = [-33.4543, -70.5975];
// Locales a cierta distancia y rumbo de CASA (rumbo en grados: 0 = norte, 90 = oriente).
const local = (nombre, tipo, metros, rumbo) => ({ nombre, tipo, punto: destino(CASA, rumbo, metros), tamano: 0 });
const LOCALES = [
  local('Cruz Verde', 'farmacia', 450, 0),
  local('Salcobrand', 'farmacia', 300, 90),
  local('Cruz Verde', 'farmacia', 1200, 180),
  local('Panadería La Espiga', 'panaderia', 200, 270),
  local('Líder Express', 'supermercado', 700, 45),
  local('Farmacia lejana', 'farmacia', 9000, 0),
];

test('Trámites v1.9: entiende lo que la gente escribe', () => {
  assert.deepEqual(tiposDeTexto('necesito remedios'), ['farmacia']);
  assert.deepEqual(tiposDeTexto('pan'), ['panaderia']);
  assert.deepEqual(tiposDeTexto('sacar plata'), ['cajero']);
  assert.deepEqual(tiposDeTexto('ferre'), ['ferreteria']);
  assert.deepEqual(tiposDeTexto('Líder'), ['supermercado']);
  assert.deepEqual(tiposDeTexto('notaría'), []);
  assert.equal(normalizar('  Panadería   LA Espiga '), 'panaderia la espiga');
});

test('Buscar un trámite: primero los que se llaman así, después el tipo; cada grupo por cercanía', () => {
  const porNombre = buscarMandados('cruz verde', LOCALES, CASA);
  assert.equal(porNombre[0].nombre, 'Cruz Verde');
  assert.ok(Math.abs(porNombre[0].distancia - 450) < 5);
  assert.equal(porNombre[1].nombre, 'Cruz Verde');
  // "cruz verde" también nombra el tipo farmacia: Salcobrand entra, pero después de las Cruz Verde.
  assert.deepEqual(porNombre.map((l) => l.nombre), ['Cruz Verde', 'Cruz Verde', 'Salcobrand']);
  // Lo que queda a más de 6 km no se ofrece.
  assert.ok(!porNombre.some((l) => l.nombre === 'Farmacia lejana'));
  const porTipo = buscarMandados('remedios', LOCALES, CASA);
  assert.deepEqual(porTipo.map((l) => l.nombre), ['Salcobrand', 'Cruz Verde', 'Cruz Verde']);
  assert.deepEqual(buscarMandados('x', LOCALES, CASA), []);
});

test('Los más cercanos de un tipo, separados entre sí', () => {
  const farmacias = LOCALES.filter((l) => l.tipo === 'farmacia');
  assert.deepEqual(masCercanos(farmacias, CASA, { n: 2 }).map((l) => l.nombre), ['Salcobrand', 'Cruz Verde']);
  // Dos locales en la misma esquina cuentan como uno.
  const pegados = [local('A', 'farmacia', 300, 0), local('B', 'farmacia', 320, 0), local('C', 'farmacia', 600, 180)];
  assert.deepEqual(masCercanos(pegados, CASA, { n: 2 }).map((l) => l.nombre), ['A', 'C']);
  // Uno que está casi encima no sirve para pasear.
  assert.deepEqual(masCercanos([local('Aquí', 'farmacia', 10, 0)], CASA), []);
});

test('La necesidad manda: el paseo dura al menos la ida y vuelta y se alarga hasta lo pedido', () => {
  // Pediste 2 km (unos 30 min) y el local está a 220 m: el paseo es de lo pedido.
  assert.deepEqual(rangoPorNecesidad({ min: 2000, max: 2600 }, 220), { min: 2000, max: 2600 });
  // El local está a 1,5 km: la ida y vuelta ya es más larga que lo pedido, y manda.
  const lejos = rangoPorNecesidad({ min: 2000, max: 2600 }, 1500);
  assert.ok(Math.abs(lejos.min - 3300) < 0.01);
  assert.ok(lejos.max >= 5400);
  // Sin máximo pedido, igual hay margen.
  const sinMax = rangoPorNecesidad({ min: 1000 }, 800);
  assert.ok(sinMax.max > sinMax.min);
});

test('Hacia dónde queda un lugar, para distinguir dos locales iguales', () => {
  assert.equal(haciaDonde(CASA, destino(CASA, 0, 500)), 'norte');
  assert.equal(haciaDonde(CASA, destino(CASA, 90, 500)), 'oriente');
  assert.equal(haciaDonde(CASA, destino(CASA, 225, 500)), 'surponiente');
  assert.equal(haciaDonde(CASA, destino(CASA, 350, 500)), 'norte');
});
