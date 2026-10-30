import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destino, acumuladas } from '../js/geo.js';
import { quitarEspolones } from '../js/brouter.js';
import { textoGiro, anguloEn, crearInstrucciones, siguienteInstruccion, fraseHablada } from '../js/guia.js';
import { unirPartes } from '../js/seguimiento.js';
import { crearGpx, nombreArchivo } from '../js/gpx.js';
import { leerPlazas, lugaresEnRuta, nombreLugar } from '../js/plazas.js';
import { describirTramo, resumir, textoComparacion } from '../js/explicar.js';
import { evaluar } from '../js/tranquilidad.js';

const a = [-33.43, -70.61];

test('texto de cada giro según el ángulo', () => {
  assert.equal(textoGiro(10), null);
  assert.equal(textoGiro(40), 'Dobla levemente a la derecha');
  assert.equal(textoGiro(-90), 'Dobla a la izquierda');
  assert.equal(textoGiro(150), 'Dobla fuerte a la derecha');
  assert.equal(textoGiro(175), 'Da la vuelta');
});

test('ángulo de una esquina en L', () => {
  const b = destino(a, 0, 100);
  const c = destino(b, 90, 100);
  const coords = [a, destino(a, 0, 50), b, destino(b, 90, 50), c];
  const acc = acumuladas(coords);
  assert.ok(Math.abs(anguloEn(coords, acc, 2) - 90) < 2);
});

test('instrucciones: giros, estaciones y llegada, en orden', () => {
  const b = destino(a, 0, 200);
  const c = destino(b, 90, 300);
  const pie = { modo: 'pie', ruta: { coords: [a, destino(a, 0, 100), b], giros: [] } };
  const bici = { modo: 'bici', ruta: { coords: [b, destino(b, 90, 150), c], giros: [] } };
  // El giro a la derecha está en el punto b, que en la línea unida es el índice 2.
  pie.ruta.coords.push(destino(b, 90, 30));
  pie.ruta.giros = [{ indice: 2, angulo: 90 }];
  const opcion = {
    partes: [pie, bici],
    estacionSalida: { nombre: 'Estación 1' },
    estacionLlegada: { nombre: 'Estación 2' },
  };
  const linea = unirPartes(opcion.partes);
  const lista = crearInstrucciones(opcion, linea);
  assert.deepEqual(
    lista.map((x) => x.tipo),
    ['giro', 'estacion', 'estacion', 'fin'],
  );
  assert.equal(lista[0].texto, 'Dobla a la derecha');
  assert.equal(lista[1].texto, 'Toma una bici en Estación 1');
  assert.equal(siguienteInstruccion(lista, 0).tipo, 'giro');
  assert.equal(siguienteInstruccion(lista, linea.total), null);
});

test('frase hablada con distancia redondeada', () => {
  assert.equal(fraseHablada({ texto: 'Dobla a la derecha' }, 43), 'En 40 metros, dobla a la derecha');
  assert.equal(fraseHablada({ texto: 'Dobla a la derecha' }, 8), 'Dobla a la derecha');
});

test('al recortar un espolón, los giros se reubican y los de adentro desaparecen', () => {
  const b = destino(a, 90, 100);
  const pasaje = destino(b, 0, 50);
  const c = destino(b, 90, 100);
  const ruta = {
    coords: [a, b, pasaje, b, c],
    metros: 300,
    tramos: [],
    giros: [{ indice: 1, angulo: -90 }, { indice: 2, angulo: 180 }, { indice: 4, angulo: 0 }],
  };
  const r = quitarEspolones(ruta);
  assert.deepEqual(r.giros.map((g) => g.indice), [1, 2]);
});

test('GPX con un solo trazado y los puntos marcados', () => {
  const b = destino(a, 90, 500);
  const opcion = {
    partes: [
      { modo: 'pie', ruta: { coords: [a, b] } },
      { modo: 'bici', ruta: { coords: [b, destino(b, 0, 500)] } },
    ],
    estacionSalida: { nombre: 'P02 - Italia & Marín', punto: b },
    estacionLlegada: { nombre: 'P66', punto: destino(b, 0, 500) },
  };
  const gpx = crearGpx(opcion, { nombre: 'Paseo', fecha: new Date('2026-10-27T12:00:00Z') });
  assert.equal((gpx.match(/<trkseg>/g) || []).length, 1);
  assert.equal((gpx.match(/<trkpt /g) || []).length, 3);
  assert.ok(gpx.includes('Tomar bici: P02 - Italia &amp; Marín'));
  assert.ok(gpx.includes('<name>Término</name>'));
  assert.match(nombreArchivo(new Date(2026, 9, 27, 9, 5)), /^paseo-2026-10-27-0905\.gpx$/);
});

test('plazas: lectura y lugares por los que pasa una ruta', () => {
  const lista = leerPlazas({
    lugares: [
      [destino(a, 90, 200)[0], destino(a, 90, 200)[1], 'Plaza Prueba', 'plaza', 60],
      [destino(a, 0, 400)[0], destino(a, 0, 400)[1], '', 'parque', 300],
      [destino(a, 180, 500)[0], destino(a, 180, 500)[1], 'Plaza Lejana', 'plaza', 40],
    ],
  });
  const ruta = [a, destino(a, 90, 400)];
  const en = lugaresEnRuta(ruta, lista);
  assert.deepEqual(en.map(nombreLugar), ['Plaza Prueba']);
  assert.equal(nombreLugar(lista[1]), 'Parque sin nombre');
});

test('describe un tramo en palabras', () => {
  const d = describirTramo({ highway: 'primary', estimated_noise_class: '6' }, 'pie');
  assert.equal(d.titulo, 'Avenida principal');
  assert.equal(d.categoria, 'mala');
  assert.match(d.detalle, /muy ruidosa/);
  assert.match(describirTramo({ highway: 'cycleway' }, 'bici').detalle, /Tiene ciclovía/);
});

test('resume una opción con lugares, tipos de calle y tramos ruidosos', () => {
  const b = destino(a, 90, 400);
  const tramos = [
    { metros: 300, tags: { highway: 'residential', estimated_forest_class: '4' }, desde: 0, hasta: 1 },
    { metros: 100, tags: { highway: 'primary' }, desde: 1, hasta: 1 },
  ];
  const lugares = leerPlazas({ lugares: [[destino(a, 90, 200)[0], destino(a, 90, 200)[1], 'Plaza Prueba', 'plaza', 60]] });
  const opcion = {
    partes: [{ modo: 'pie', ruta: { coords: [a, b], tramos } }],
    repetida: 0,
    estilo: 'tranquilo',
    extras: { plazas: lugaresEnRuta([a, b], lugares), interes: [], servicios: [], comercio: 0, novedad: null },
  };
  const frases = resumir(opcion);
  assert.ok(frases.some((f) => f.includes('Pasa por Plaza Prueba')));
  assert.ok(frases.some((f) => f.includes('calles residenciales y pasajes (75 %)')));
  assert.ok(frases.some((f) => f.includes('áreas verdes')));
  assert.ok(frases.some((f) => f.includes('Hay un tramo ruidoso') && f.includes('avenidas grandes')));
});

test('compara con el camino más corto', () => {
  const corto = { metros: 3775, evaluacion: evaluar([{ metros: 3000, tags: { highway: 'tertiary' } }, { metros: 775, tags: { highway: 'primary' } }], 'pie') };
  const ruta = { metros: 4276, evaluacion: evaluar([{ metros: 4200, tags: { highway: 'residential' } }, { metros: 76, tags: { highway: 'primary' } }], 'pie') };
  const frases = textoComparacion({ corto, ruta });
  assert.match(frases[0], /3,8 km/);
  assert.match(frases[2], /caminas 500 m más para evitar/);
});
