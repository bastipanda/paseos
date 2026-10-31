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
import { mejorHora, textoMejorHora, incomodidad } from '../js/clima.js';
import { crearIcs, primeraFecha } from '../js/calendario.js';
import { faseIntervalo, ppmDeFase } from '../js/metronomo.js';
import { leerComunas, comunaDe, comunasDeRuta, avancePorComuna, leerDelitos, delitosDe, textoDelitos } from '../js/territorio.js';
import { claveCelda } from '../js/explorar.js';
import { resumir } from '../js/explicar.js';
import { nombreEstacion } from '../js/plazas.js';
import {
  crearDex,
  numeroDex,
  radioCaptura,
  revisarRecorrido,
  anotarRecorrido,
  estadoDe,
  avanceDex,
  capturarConFoto,
  insigniasDe,
  CENTRO_DEX,
} from '../js/dex.js';

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

test('mejor hora para salir: evita calor, lluvia, smog y oscuridad', () => {
  const ahora = new Date(2026, 0, 15, 13, 20); // verano, 13:20
  const hora = (h, sensacion, lluvia = 0, pm25 = 20) => ({ t: new Date(2026, 0, 15, h), temperatura: sensacion, sensacion, lluvia, codigo: 0, pm25 });
  const pronostico = {
    horas: [hora(13, 31), hora(14, 33), hora(15, 33), hora(16, 32), hora(17, 30), hora(18, 28), hora(19, 26), hora(20, 22), hora(21, 20), hora(22, 18)],
    salida: new Date(2026, 0, 15, 6, 40),
    puesta: new Date(2026, 0, 15, 20, 55),
  };
  const m = mejorHora(pronostico, ahora);
  assert.equal(m.hora.t.getHours(), 20);
  assert.equal(m.ahora, false);
  assert.match(textoMejorHora(m), /^Mejor hora hoy: 20:00 \(22 °C, sin lluvia, aire bueno\)/);
  // Con smog a las 20, conviene a las 21 (todavía no oscurece del todo); a las 22 ya cuenta como de noche.
  pronostico.horas[7].pm25 = 90;
  assert.equal(mejorHora(pronostico, ahora).hora.t.getHours(), 21);
  assert.ok(incomodidad(pronostico.horas[9], pronostico) >= 15);
  // Después de las 22 ya no hay sugerencia.
  assert.equal(mejorHora(pronostico, new Date(2026, 0, 15, 23)), null);
  assert.ok(incomodidad(hora(12, 18, 80)) > incomodidad(hora(12, 18, 0)));
});

test('evento semanal para el calendario (.ics)', () => {
  const desde = new Date(2026, 9, 30, 20, 0); // viernes 30 de octubre, 20:00
  assert.equal(primeraFecha([0, 2, 4], '19:30', desde).getDate(), 2); // ya pasó la hora del viernes: lunes 2
  assert.equal(primeraFecha([4], '21:00', desde).getDate(), 30);
  const ics = crearIcs({ dias: [4, 0, 2], hora: '19:30', minutos: 30, meta: 150, desde });
  assert.match(ics, /DTSTART:20261102T193000\r\n/);
  assert.match(ics, /DTEND:20261102T200000\r\n/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR\r\n/);
  assert.match(ics, /TRIGGER:-PT10M/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.throws(() => crearIcs({ dias: [], hora: '19:30', minutos: 30 }));
});

test('intervalos: 3 minutos suave, 3 rápido, y el metrónomo se adapta', () => {
  assert.deepEqual(faseIntervalo(0), { fase: 'suave', restante: 180, numero: 0 });
  assert.equal(faseIntervalo(200).fase, 'rapido');
  assert.equal(faseIntervalo(200).restante, 160);
  assert.equal(faseIntervalo(400).fase, 'suave');
  assert.equal(ppmDeFase(110, 'rapido'), 120);
  assert.equal(ppmDeFase(110, 'suave'), 95);
  assert.equal(ppmDeFase(110, null), 110);
});

test('comunas: en cuál cae un punto, por cuáles pasa una ruta y cuánto conoces de cada una', () => {
  const cuadrado = (s, o, n, e) => [[s, o], [s, e], [n, e], [n, o], [s, o]];
  const comunas = leerComunas({
    comunas: [
      { nombre: 'Providencia', celdas: 4, caja: [-33.44, -70.63, -33.42, -70.61], anillos: [cuadrado(-33.44, -70.63, -33.42, -70.61)] },
      { nombre: 'Ñuñoa', celdas: 10, caja: [-33.46, -70.63, -33.44, -70.61], anillos: [cuadrado(-33.46, -70.63, -33.44, -70.61)] },
    ],
  });
  assert.equal(comunaDe([-33.43, -70.62], comunas), 'Providencia');
  assert.equal(comunaDe([-33.45, -70.62], comunas), 'Ñuñoa');
  assert.equal(comunaDe([-33.5, -70.62], comunas), null);
  const ruta = [[-33.425, -70.62], [-33.455, -70.62]];
  const porComuna = comunasDeRuta(ruta, comunas);
  assert.deepEqual(porComuna.map((c) => c.nombre), ['Providencia', 'Ñuñoa']);
  const conocidas = new Set([claveCelda([-33.43, -70.62]), claveCelda([-33.431, -70.621]), claveCelda([-33.45, -70.62])]);
  const avance = avancePorComuna(conocidas, comunas);
  assert.equal(avance[0].nombre, 'Providencia');
  assert.equal(avance[0].fraccion, 0.5);
  assert.equal(avance[1].fraccion, 0.1);
});

test('robos violentos por comuna (CEAD): texto con comparación y sin inventar', () => {
  const delitos = leerDelitos({
    fuente: 'CEAD, casos policiales 2025',
    region: { tasa: 922.9, casos: 78177 },
    comunas: [['Providencia', 1908.1, 3151], ['Ñuñoa', 1036.1, 2803], ['Las Condes', 295.1, 1021]],
  });
  assert.equal(delitosDe('Nunoa', delitos).tasa, 1036.1);
  const texto = textoDelitos([{ nombre: 'Providencia', fraccion: 0.6 }, { nombre: 'Ñuñoa', fraccion: 0.35 }, { nombre: 'Las Condes', fraccion: 0.05 }], delitos);
  assert.match(texto, /Robos violentos en 2025 \(CEAD\)/);
  assert.match(texto, /Providencia: 1\.908 por cada 100 mil habitantes \(2,1 veces el promedio de la región\)/);
  assert.match(texto, /Ñuñoa: 1\.036 .*cerca del promedio/);
  assert.doesNotMatch(texto, /Las Condes/);
  assert.equal(textoDelitos([{ nombre: 'Comuna Inventada', fraccion: 1 }], delitos), null);
});

test('explicación de destinos: ida y vuelta, estación de metro', () => {
  const ruta = { coords: [a, destino(a, 90, 300)], metros: 300, tramos: [{ metros: 300, tags: { highway: 'residential' } }] };
  const base = { partes: [{ modo: 'pie', ruta }], estilo: 'tranquilo', extras: {}, repetida: 0 };
  const ida = resumir({ ...base, destino: { punto: a, nombre: 'Cruz Verde', tipo: 'farmacia', idaYVuelta: true } });
  assert.equal(ida[0], 'Vas hasta Cruz Verde y vuelves por otras calles.');
  const metro = resumir({ ...base, destino: { punto: a, nombre: 'Manuel Montt', tipo: 'estacion', lineas: ['1'], idaYVuelta: false } });
  assert.equal(metro[0], 'Terminas en la estación Manuel Montt (línea 1): de ahí puedes volver en metro.');
  assert.equal(nombreEstacion({ nombre: 'Baquedano', lineas: ['1', '5'] }), 'Baquedano (L1, L5)');
});

test('Santiagodex: lista sin repetidos, numerada desde el centro, captura y vistos', () => {
  const centro = CENTRO_DEX;
  const interes = [
    { punto: destino(centro, 0, 2000), nombre: 'Museo Lejano', tipo: 'museo', tamano: 0, id: 'n1' },
    { punto: destino(centro, 90, 300), nombre: 'Plaza de Prueba', tipo: 'historia', tamano: 0, id: 'n2' },
    { punto: destino(centro, 90, 400), nombre: 'Placa sin tipo', tipo: 'agua', tamano: 0, id: 'n3' },
  ];
  const plazas = [
    { punto: destino(centro, 90, 320), nombre: 'Plaza de prueba', tipo: 'plaza', tamano: 80, id: 'w1' }, // repetida
    { punto: destino(centro, 180, 1000), nombre: 'Parque Sur', tipo: 'parque', tamano: 600, id: 'w2' },
    { punto: destino(centro, 270, 100), nombre: '', tipo: 'plaza', tamano: 50, id: 'w3' }, // sin nombre: no entra
  ];
  const dex = crearDex(plazas, interes);
  assert.deepEqual(dex.map((l) => l.nombre), ['Plaza de Prueba', 'Parque Sur', 'Museo Lejano']);
  assert.deepEqual(dex.map((l) => l.numero), [1, 2, 3]);
  assert.equal(numeroDex(7), '#0007');
  assert.equal(radioCaptura(dex[1]), 180);
  // Un recorrido que llega al parque (entra en su radio) y pasa a 100 m de la plaza.
  const recorrido = [destino(destino(centro, 90, 300), 0, 100), destino(centro, 0, 100), destino(centro, 180, 900)];
  const revision = revisarRecorrido(recorrido, dex);
  assert.deepEqual(revision.capturados.map((l) => l.id), ['w2']);
  assert.deepEqual(revision.vistos.map((l) => l.id), ['n2']);
  // Un salto largo del GPS que pasa justo por la plaza no la captura (solo queda vista).
  const salto = revisarRecorrido([destino(centro, 90, 0), destino(centro, 90, 600)], dex);
  assert.deepEqual(salto.capturados.map((l) => l.id), []);
  assert.deepEqual(salto.vistos.map((l) => l.id), ['n2']);
  const caminando = revisarRecorrido(Array.from({ length: 13 }, (_, i) => destino(centro, 90, i * 50)), dex);
  assert.deepEqual(caminando.capturados.map((l) => l.id), ['n2']);
  const estado = { capturados: {}, vistos: {} };
  const nuevos = anotarRecorrido(estado, revision, '2026-10-30T20:00:00Z');
  assert.equal(nuevos.nuevosCapturados.length, 1);
  // Desde la v1.4, llegar sin sacar foto deja el lugar como "falta la foto".
  assert.equal(estadoDe(dex[1], estado), 'falta');
  assert.equal(estadoDe(dex[0], estado), 'visto');
  assert.equal(estadoDe(dex[2], estado), 'nuevo');
  // Lo mismo otra vez no suma nada nuevo.
  assert.equal(anotarRecorrido(estado, revision).nuevosCapturados.length, 0);
  let avance = avanceDex(dex, estado);
  assert.equal(avance.capturados, 0);
  assert.equal(avance.faltaFoto, 1);
  assert.equal(avance.vistos, 1);
  assert.deepEqual(avance.porTipo.parque, { total: 1, capturados: 0 });
});

test('Santiagodex v1.4: la foto propia captura (también sin haber llegado) e insignias por comuna', () => {
  const parque = { id: 'p1', tipo: 'parque', comuna: 'Ñuñoa' };
  const museo = { id: 'm1', tipo: 'museo', comuna: 'Ñuñoa' };
  const estado = { capturados: { p1: { fecha: '2026-10-30T20:00:00Z', como: 'gps' } }, vistos: {} };
  capturarConFoto(estado, parque, '2026-10-31T10:00:00Z');
  assert.equal(estadoDe(parque, estado), 'capturado');
  assert.deepEqual(estado.capturados.p1, { fecha: '2026-10-30T20:00:00Z', como: 'gps', foto: '2026-10-31T10:00:00Z' });
  // Un lugar que ya conocías: se captura subiendo una foto, sin paseo.
  capturarConFoto(estado, museo, '2026-10-31T11:00:00Z');
  assert.equal(estadoDe(museo, estado), 'capturado');
  assert.equal(estado.capturados.m1.como, 'foto');
  assert.deepEqual(avanceDex([parque, museo], estado).porComuna['Ñuñoa'], { total: 2, capturados: 2 });
  assert.deepEqual(insigniasDe(0.1), []);
  assert.deepEqual(insigniasDe(0.5), [25, 50]);
  assert.deepEqual(insigniasDe(1), [25, 50, 100]);
});

test('distancia de prueba sana', () => {
  assert.ok(distancia(a, destino(a, 0, 100)) > 99);
});
