import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerRuta, quitarEspolones } from '../js/brouter.js';
import { categoriaPie, categoriaBici, evaluar } from '../js/tranquilidad.js';
import { unirEstaciones } from '../js/bikeitau.js';
import { unirPartes, faltante } from '../js/seguimiento.js';
import { puntosIntermedios, esCircular } from '../js/generador.js';
import { distancia, destino } from '../js/geo.js';

// Respuesta mínima con el mismo formato que devuelve BRouter.
const respuesta = {
  type: 'FeatureCollection',
  features: [
    {
      properties: {
        'track-length': '300',
        messages: [
          ['Longitude', 'Latitude', 'Elevation', 'Distance', 'CostPerKm', 'WayTags', 'NodeTags'],
          ['-70610000', '-33430000', '600', '100', '1000', 'highway=residential estimated_noise_class=2', ''],
          ['-70608000', '-33430000', '600', '200', '3000', 'highway=primary', ''],
        ],
      },
      geometry: {
        coordinates: [
          [-70.612, -33.43, 600],
          [-70.61, -33.43, 600],
          [-70.609, -33.43, 600],
          [-70.608, -33.43, 600],
        ],
      },
    },
  ],
};

test('lee la ruta de BRouter con sus tramos', () => {
  const r = leerRuta(respuesta);
  assert.equal(r.metros, 300);
  assert.equal(r.coords.length, 4);
  assert.deepEqual(r.coords[0], [-33.43, -70.612]);
  assert.equal(r.tramos.length, 2);
  assert.deepEqual(r.tramos[0], { metros: 100, tags: { highway: 'residential', estimated_noise_class: '2' }, desde: 0, hasta: 1 });
  assert.equal(r.tramos[1].hasta, 3);
});

test('recorta un espolón (entrar a un pasaje y volver por el mismo camino)', () => {
  const a = [-33.43, -70.61];
  const b = destino(a, 90, 100);
  const c = destino(b, 90, 100);
  const pasaje = destino(b, 0, 50);
  const ruta = {
    coords: [a, b, pasaje, b, c],
    metros: 300,
    tramos: [
      { metros: 100, tags: { highway: 'residential' }, desde: 0, hasta: 1 },
      { metros: 100, tags: { highway: 'service' }, desde: 1, hasta: 3 },
      { metros: 100, tags: { highway: 'residential' }, desde: 3, hasta: 4 },
    ],
  };
  const r = quitarEspolones(ruta);
  assert.deepEqual(r.coords, [a, b, c]);
  assert.ok(Math.abs(r.metros - 200) < 1);
  assert.equal(r.tramos.length, 2);
  assert.deepEqual(r.tramos.map((t) => [t.desde, t.hasta]), [[0, 1], [1, 2]]);
});

test('no recorta una ruta que es toda ida y vuelta', () => {
  const a = [-33.43, -70.61];
  const b = destino(a, 90, 100);
  const ruta = { coords: [a, b, a], metros: 200, tramos: [] };
  assert.equal(quitarEspolones(ruta), ruta);
});

test('clasifica calles a pie y en bici', () => {
  assert.equal(categoriaPie({ highway: 'residential' }), 'buena');
  assert.equal(categoriaPie({ highway: 'footway', estimated_noise_class: '6' }), 'mala');
  assert.equal(categoriaPie({ highway: 'secondary' }), 'media');
  assert.equal(categoriaBici({ highway: 'cycleway' }), 'buena');
  assert.equal(categoriaBici({ highway: 'primary', cycleway: 'track' }), 'buena');
  assert.equal(categoriaBici({ highway: 'primary' }), 'mala');
  assert.equal(categoriaBici({ highway: 'pedestrian' }), 'mala');
  assert.equal(categoriaBici({ highway: 'footway', bicycle: 'designated' }), 'buena');
});

test('evalúa una ruta por metros', () => {
  const e = evaluar(leerRuta(respuesta).tramos, 'pie');
  assert.deepEqual(e.metros, { buena: 100, media: 0, mala: 200 });
  assert.equal(e.puntaje, 33);
});

test('une información y estado de estaciones GBFS', () => {
  const info = { data: { stations: [{ station_id: '4', name: [{ text: 'P02 - Italia / Marín', language: 'es' }], lat: -33.44, lon: -70.62 }] } };
  const estado = { data: { stations: [{ station_id: '4', num_vehicles_available: 3, num_docks_available: 8, is_installed: true, is_renting: true, is_returning: true }] } };
  assert.deepEqual(unirEstaciones(info, estado), [
    { id: '4', nombre: 'P02 - Italia / Marín', punto: [-33.44, -70.62], bicis: 3, anclajes: 8, operativa: true, recibe: true },
  ]);
});

test('calcula lo que falta a pie y en bici', () => {
  const a = [-33.43, -70.61];
  const b = destino(a, 90, 1000);
  const c = destino(b, 90, 2000);
  const linea = unirPartes([
    { modo: 'pie', ruta: { coords: [a, b] } },
    { modo: 'bici', ruta: { coords: [b, c] } },
  ]);
  const f = faltante(linea, 500);
  assert.ok(Math.abs(f.pie - 500) < 2);
  assert.ok(Math.abs(f.bici - 2000) < 2);
  assert.equal(f.modoActual, 'pie');
  assert.equal(faltante(linea, 1500).modoActual, 'bici');
});

test('puntos intermedios para circular y para partida distinta del término', () => {
  const a = [-33.43, -70.61];
  assert.ok(esCircular(a, destino(a, 0, 30)));
  const [v1, v2] = puntosIntermedios(a, a, 3900, 0);
  // Triángulo equilátero: cada lado ≈ 3900 / 1,3 / 3 = 1000 m.
  assert.ok(Math.abs(distancia(a, v1) - 1000) < 5);
  assert.ok(Math.abs(distancia(v1, v2) - 1000) < 5);
  const b = destino(a, 90, 1000);
  const [v] = puntosIntermedios(a, b, 2600, 90);
  assert.ok(Math.abs(distancia(a, v) + distancia(v, b) - 2000) < 5);
});
