import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puntosIntermedios, fraccionEnZona, claveLugar, paseosAPie, paseosIdaYVuelta, paseosHastaDestino, PREFS_POR_DEFECTO } from '../js/generador.js';
import { zonaDeComunas } from '../js/territorio.js';
import { distancia, destino } from '../js/geo.js';

const casa = [-33.44, -70.61];

test('Buscar más: el triángulo de la vuelta calza con lo buscado aunque cambie su abertura', () => {
  for (const abertura of [22, 30, 40]) {
    const [v1, v2] = puntosIntermedios(casa, casa, 3900, 45, abertura);
    const perimetro = distancia(casa, v1) + distancia(v1, v2) + distancia(v2, casa);
    assert.ok(Math.abs(perimetro - 3900 / 1.3) < 15, `abertura ${abertura}: ${perimetro}`);
  }
});

test('Buscar más: los lugares se identifican por su posición', () => {
  assert.equal(claveLugar({ punto: [-33.4412345, -70.6123456] }), '-33.44123,-70.61235');
});

test('Mis barrios: una comuna cuadrada y la parte del camino que va dentro', () => {
  const cuadrado = [[-33.45, -70.62], [-33.45, -70.6], [-33.43, -70.6], [-33.43, -70.62], [-33.45, -70.62]];
  const comunas = [
    { nombre: 'Adentro', caja: [-33.45, -70.62, -33.43, -70.6], anillos: [cuadrado] },
    { nombre: 'Otra', caja: [-33.47, -70.62, -33.45, -70.6], anillos: [[[-33.47, -70.62], [-33.47, -70.6], [-33.45, -70.6], [-33.45, -70.62]]] },
  ];
  const zona = zonaDeComunas(['Adentro'], comunas);
  assert.equal(zona(casa), true);
  assert.equal(zona([-33.46, -70.61]), false);
  // Un camino de 2 km hacia el sur desde el centro del cuadrado: la mitad queda dentro (el borde está a ~1,1 km).
  const fin = destino(casa, 180, 2000);
  const f = fraccionEnZona([casa, fin], zona);
  assert.ok(f > 0.5 && f < 0.6, String(f));
});

test('Mis barrios: si ninguna dirección cabe, se avisa sin pedir rutas', async () => {
  const prefs = { ...PREFS_POR_DEFECTO, zona: () => false };
  await assert.rejects(paseosAPie({ inicio: casa, fin: casa, rango: { min: 3000, max: 4000 }, prefs }), /sin salir de tus barrios/);
  const lugares = [{ punto: destino(casa, 90, 700), nombre: 'Plaza' }];
  await assert.rejects(paseosIdaYVuelta({ inicio: casa, rango: { min: 3000, max: 4000 }, lugares, prefs }), /Solo busqué dentro de tus barrios/);
});

test('Buscar más: sin destinos nuevos, avisa que ya se mostraron', async () => {
  const lugares = [{ punto: destino(casa, 90, 2500), nombre: 'Estación' }];
  const excluir = new Set(lugares.map(claveLugar));
  await assert.rejects(
    paseosHastaDestino({ inicio: casa, rango: { min: 3000, max: 4000 }, lugares, excluir, ronda: 1 }),
    /No quedan lugares distintos/,
  );
});
