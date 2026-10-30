import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destino, distancia } from '../js/geo.js';
import { categoria, evaluar } from '../js/tranquilidad.js';
import { aMetros, desdeMetros, met, resumen, rangoEnMetros } from '../js/duracion.js';
import { comercioEnRuta, puntosDeComercio } from '../js/comercio.js';
import { celdasDeRuta, celdasDeZona, novedad, claveCelda } from '../js/explorar.js';
import { categoriaAire, leerClima, textoCielo } from '../js/clima.js';
import { ajustarPunto } from '../js/generador.js';
import { describirTramo, resumir, textoComparacion } from '../js/explicar.js';
import { leerInteres, leerServicios, lugaresEnRuta, nombreLugar } from '../js/plazas.js';

const a = [-33.43, -70.61];

test('estilo noche: iluminado y calles principales bien; callejones, senderos y sin luz mal', () => {
  assert.equal(categoria({ highway: 'residential', lit: 'yes' }, 'pie', 'noche'), 'buena');
  assert.equal(categoria({ highway: 'secondary' }, 'pie', 'noche'), 'buena');
  assert.equal(categoria({ highway: 'footway', footway: 'sidewalk' }, 'pie', 'noche'), 'buena');
  assert.equal(categoria({ highway: 'residential' }, 'pie', 'noche'), 'media');
  assert.equal(categoria({ highway: 'service' }, 'pie', 'noche'), 'mala');
  assert.equal(categoria({ highway: 'path' }, 'pie', 'noche'), 'mala');
  assert.equal(categoria({ highway: 'footway' }, 'pie', 'noche'), 'mala');
  assert.equal(categoria({ highway: 'residential', lit: 'no' }, 'pie', 'noche'), 'mala');
});

test('estilo con vida: calles con movimiento bien, tramos aislados mal', () => {
  assert.equal(categoria({ highway: 'pedestrian' }, 'pie', 'vida'), 'buena');
  assert.equal(categoria({ highway: 'primary' }, 'pie', 'vida'), 'buena');
  assert.equal(categoria({ highway: 'residential' }, 'pie', 'vida'), 'media');
  assert.equal(categoria({ highway: 'path' }, 'pie', 'vida'), 'mala');
  // En el estilo tranquilo, la misma avenida es mala.
  assert.equal(categoria({ highway: 'primary' }, 'pie', 'tranquilo'), 'mala');
  const e = evaluar([{ metros: 100, tags: { highway: 'primary' } }], 'pie', 'vida');
  assert.equal(e.puntaje, 100);
});

test('calorías: MET según velocidad y conversión con el peso', () => {
  assert.equal(met(4.0), 3.0);
  assert.equal(met(4.5), 3.4);
  const aj = { largoPaso: 0.75, velocidadKmh: 4.5, peso: 70 };
  // 4,5 km en una hora a 3,4 MET con 70 kg = 238 kcal.
  assert.ok(Math.abs(desdeMetros(4500, 'kcal', aj) - 238) < 0.5);
  assert.ok(Math.abs(aMetros(238, 'kcal', aj) - 4500) < 1);
  assert.equal(resumen(4500, aj).kcal, 238);
  assert.equal(resumen(4500, { ...aj, peso: null }).kcal, null);
  assert.throws(() => rangoEnMetros({ min: '200', max: '', unidad: 'kcal' }, { ...aj, peso: null }), /peso/);
});

test('comercio: locales en los cuadros por los que pasa la ruta', () => {
  const celda = [0.0009, 0.00108];
  const k = (p) => `${Math.floor(p[0] / celda[0])},${Math.floor(p[1] / celda[1])}`;
  const b = destino(a, 90, 300);
  const datos = { celda, celdas: { [k(a)]: 5, [k(b)]: 7, [k(destino(a, 0, 1000))]: 50 } };
  assert.equal(comercioEnRuta([a, b], datos), 12);
  assert.equal(puntosDeComercio(datos, 6).length, 2);
});

test('explorar: cuadros de una ruta, de una zona y qué tan nueva es una ruta', () => {
  const b = destino(a, 90, 500);
  const conocidas = new Set(celdasDeRuta([a, b]));
  assert.ok(conocidas.size >= 10);
  assert.ok(novedad([a, b], conocidas) < 0.05);
  const c = destino(a, 0, 500);
  assert.ok(novedad([a, c], conocidas) > 0.8);
  const zona = celdasDeZona(a, 120);
  assert.ok(zona.includes(claveCelda(a)));
  assert.ok(zona.length > 15 && zona.length < 40);
});

test('clima y aire: textos y categorías chilenas de MP2,5', () => {
  assert.equal(textoCielo(0), 'despejado');
  assert.equal(categoriaAire(30).texto, 'bueno');
  assert.equal(categoriaAire(60).texto, 'regular');
  assert.equal(categoriaAire(95).texto, 'nivel de alerta');
  assert.equal(categoriaAire(130).texto, 'nivel de preemergencia');
  assert.equal(categoriaAire(180).texto, 'nivel de emergencia');
  const r = leerClima({ temperatura: 32, sensacion: 34, cielo: 'despejado', lluvia: 10, pm25: 60 });
  assert.match(r.linea, /32 °C, despejado · aire regular/);
  assert.equal(r.avisos.length, 2);
  assert.equal(leerClima({ temperatura: 20, sensacion: 20, cielo: '', lluvia: 0, pm25: 10 }).nivel, 'ok');
});

test('pasar por: mueve el punto intermedio al lugar real más cercano', () => {
  const cerca = { punto: destino(a, 0, 100), peso: 1 };
  const lejos = { punto: destino(a, 0, 900), peso: 1 };
  assert.deepEqual(ajustarPunto(a, [cerca, lejos], 300), cerca.punto);
  assert.deepEqual(ajustarPunto(a, [lejos], 300), a);
  const usados = new Set([cerca]);
  assert.deepEqual(ajustarPunto(a, [cerca], 300, usados), a);
});

test('lugares interesantes y servicios: lectura y nombres', () => {
  const interes = leerInteres({ lugares: [[a[0], a[1], 'Museo de Prueba', 'museo', 'es:Museo de Prueba']] });
  assert.equal(nombreLugar(interes[0]), 'Museo de Prueba');
  const servicios = leerServicios({ lugares: [[a[0], a[1], 'agua', '']] });
  assert.equal(nombreLugar(servicios[0]), 'Bebedero sin nombre');
  assert.equal(lugaresEnRuta([destino(a, 270, 40), destino(a, 90, 40)], servicios, 60).length, 1);
});

test('explicaciones según el estilo', () => {
  assert.match(describirTramo({ highway: 'service' }, 'pie', 'noche').detalle, /callejón/);
  assert.match(describirTramo({ highway: 'residential' }, 'pie', 'noche').detalle, /Sin dato de iluminación/);
  const b = destino(a, 90, 400);
  const opcion = {
    partes: [{ modo: 'pie', ruta: { coords: [a, b], tramos: [{ metros: 400, tags: { highway: 'secondary', lit: 'yes' } }] } }],
    estilo: 'noche',
    repetida: 0,
    extras: {
      interes: leerInteres({ lugares: [[a[0], a[1], 'Museo X', 'museo', '']] }),
      plazas: [],
      servicios: leerServicios({ lugares: [[a[0], a[1], 'agua', ''], [b[0], b[1], 'baño', '']] }),
      comercio: 30,
      iluminada: 1,
      novedad: 0.75,
    },
  };
  const frases = resumir(opcion).join(' | ');
  assert.match(frases, /lugares interesantes: Museo X/);
  assert.match(frases, /100 % del camino tiene iluminación registrada/);
  assert.match(frases, /75 % de la ruta va por calles que no tienes marcadas/);
  assert.match(frases, /1 bebedero y 1 baño público/);
  assert.doesNotMatch(frases, /locales/);
  const vida = resumir({ ...opcion, estilo: 'vida' }).join(' | ');
  assert.match(vida, /unos 30 locales/);
  const t = textoComparacion({
    corto: { metros: 1000, evaluacion: evaluar([{ metros: 1000, tags: { highway: 'service' } }], 'pie', 'noche') },
    ruta: { metros: 1200, evaluacion: evaluar([{ metros: 1200, tags: { highway: 'primary' } }], 'pie', 'noche') },
    estilo: 'noche',
  });
  assert.match(t[2], /evitar 1,0 km de tramos oscuros o callejones/);
  assert.ok(distancia(a, b) > 0);
});
