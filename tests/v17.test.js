// v1.7 "Una razón para ir": los textos de la ficha que salen del entorno de cada lugar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  radioEspecies,
  textoQueHay,
  textoArboles,
  textoEspecies,
  enlaceINaturalist,
  textoHorario,
  textoObra,
  textosMonumentos,
  textoPersona,
  textoCalles,
  textoAltura,
  textoReferencias,
} from '../js/entorno.js';
import { puntoCardinal } from '../js/guia.js';

test('Qué hay: juegos, canchas por deporte, máquinas, bebedero y perros en una frase', () => {
  assert.equal(
    textoQueHay({ j: 1, e: 1, c: { soccer: 2, basketball: 1 }, b: 1, p: 1 }),
    'En el lugar o junto a él: juegos infantiles, máquinas de ejercicio, 3 canchas (fútbol y básquetbol), un bebedero y un área para perros.',
  );
  assert.equal(textoQueHay({ c: { skateboard: 1 } }), 'En el lugar o junto a él: una pista de skate.');
  assert.equal(textoQueHay({ c: { '': 1 }, b: 2 }), 'En el lugar o junto a él: una cancha y 2 bebederos.');
  assert.equal(textoQueHay(undefined), '');
});

test('Árboles y especies: cantidades y grupos tal como vienen de la fuente', () => {
  assert.equal(
    textoArboles([16, [['Palmera Canaria', 9], ['Plátano oriental', 7]]]),
    '16 árboles identificados en el mapa: Palmera Canaria (9) · Plátano oriental (7).',
  );
  assert.equal(textoArboles([1, [['Jacarandá', 1]]]), 'Un árbol identificado en el mapa: Jacarandá (1).');
  const e = textoEspecies([27, [['Chincol', 'a'], ['Zorzal', 'a'], ['Quintral', 'p']]]);
  assert.equal(e.titulo, '27 especies registradas aquí por la gente en iNaturalist.');
  assert.deepEqual(e.grupos, ['Aves: Chincol y Zorzal', 'Plantas: Quintral']);
  assert.equal(e.hayMas, true);
  assert.equal(textoEspecies([0, []]), null);
});

test('El radio de iNaturalist cubre el lugar y el enlace pide los nombres de Chile', () => {
  assert.equal(radioEspecies({ tamano: 0 }), 100);
  assert.equal(radioEspecies({ tamano: 300 }), 200);
  assert.equal(radioEspecies({ tamano: 2000 }), 400);
  const url = enlaceINaturalist({ punto: [-33.44, -70.63], tamano: 0 });
  assert.match(url, /radius=0\.10/);
  assert.match(url, /preferred_place_id=7182/);
});

test('Horario de OSM en palabras; lo que no se entiende va tal cual', () => {
  assert.equal(textoHorario('Mo-Fr 08:30-17:30; Sa 10:00-14:00'), 'Horario: Lunes a viernes de 8:30 a 17:30; sábado de 10:00 a 14:00.');
  assert.equal(
    textoHorario('Mo-Fr 09:00-13:00,15:00-18:00; Su off'),
    'Horario: Lunes a viernes de 9:00 a 13:00 y de 15:00 a 18:00; domingo cerrado.',
  );
  assert.equal(textoHorario('Tu,Th 10:00-18:00'), 'Horario: Martes y jueves de 10:00 a 18:00.');
  assert.equal(textoHorario('24/7'), 'Abierto siempre.');
  assert.equal(textoHorario('sunrise-sunset'), 'Horario (como lo anota el mapa): sunrise-sunset');
});

test('Obra: tipo y material traducidos, con artista y año', () => {
  assert.equal(textoObra({ k: ['bust', 'bronze'], a: 'Juan Pérez', y: '1910' }), 'Busto de bronce, obra de Juan Pérez, del año 1910.');
  assert.equal(textoObra({ a: 'Roberto Negri' }), 'Obra de Roberto Negri.');
  assert.equal(textoObra({ k: ['unknown', 'unobtainium'] }), '');
});

test('Monumentos del CMN: "es" si es el mismo lugar, "está dentro" si no', () => {
  const [zona] = textosMonumentos([['Zona Típica', 'Parque Forestal', 1997, 'https://ejemplo/decreto.pdf']], 'Abraham Lincoln');
  assert.equal(zona.texto, 'Está dentro de la Zona Típica «Parque Forestal», declarada en 1997 (Consejo de Monumentos Nacionales).');
  assert.equal(zona.enlace, 'https://ejemplo/decreto.pdf');
  const [mh] = textosMonumentos([['Monumento Histórico', 'Palacio Cousiño', 1981, null]], 'Palacio Cousiño');
  assert.equal(mh.texto, 'Es Monumento Histórico desde 1981 (Consejo de Monumentos Nacionales).');
  assert.deepEqual(textosMonumentos(undefined, 'x'), []);
  // Monumento que es solo un punto: el museo que funciona en él "es" el monumento; otro lugar a pasos, "junto al".
  const punto = ['Monumento Histórico', 'Palacio Cousiño y Jardines', 1981, null, 1];
  assert.equal(textosMonumentos([punto], 'Museo Palacio Cousiño')[0].texto, 'Es Monumento Histórico desde 1981 (Consejo de Monumentos Nacionales).');
  assert.equal(
    textosMonumentos([punto], 'Plaza Ercilla')[0].texto,
    'Junto al Monumento Histórico «Palacio Cousiño y Jardines», declarado en 1981 (Consejo de Monumentos Nacionales).',
  );
});

test('"¿Por qué se llama así?" se dice como coincidencia', () => {
  assert.equal(textoPersona(['Dagoberto Godoy', 'piloto chileno (1893-1960)']), 'Su nombre coincide con el de Dagoberto Godoy: piloto chileno (1893-1960).');
  assert.equal(textoPersona(['Jorge Montt (político)', null]), 'Su nombre coincide con el de Jorge Montt.');
});

test('Calles alrededor con su punto cardinal, o la calle donde está', () => {
  assert.equal(
    textoCalles([['Avenida Grecia', 'n', 40], ['Los Alerces', 'o', 50]]),
    'Calles alrededor: Avenida Grecia (al norte) y Los Alerces (al oriente).',
  );
  assert.equal(textoCalles([['Avenida Matta', 'e'], ['San Diego', 'p']]), 'Está en Avenida Matta; cerca: San Diego (al poniente).');
  assert.equal(
    textoCalles([['Avenida Santa María', 'j'], ['Bellavista', 'n'], ['Pío Nono', 'o']]),
    'Junto a Avenida Santa María; cerca: Bellavista (al norte) y Pío Nono (al oriente).',
  );
  assert.equal(textoCalles([]), '');
});

test('Altura comparada con la Plaza de Armas', () => {
  assert.equal(textoAltura(705, 563), 'Está a 705 m sobre el nivel del mar: 142 m más arriba que la Plaza de Armas.');
  assert.equal(textoAltura(560, 563), 'Está a 560 m sobre el nivel del mar, casi a la misma altura que la Plaza de Armas.');
  assert.equal(textoAltura(2100, 563, true), 'Su cumbre está a 2.100 m sobre el nivel del mar: 1.537 m más arriba que la Plaza de Armas.');
  assert.equal(textoAltura(500, 563), 'Está a 500 m sobre el nivel del mar: 63 m más abajo que la Plaza de Armas.');
  assert.equal(textoAltura(undefined, 563), '');
});

test('Puntos de referencia: hacia dónde quedan la Gran Torre y el San Cristóbal', () => {
  assert.equal(puntoCardinal(90), 'oriente');
  assert.equal(puntoCardinal(-45), 'norponiente');
  assert.match(
    textoReferencias([-33.4566, -70.6005]),
    /^Desde aquí, la Gran Torre queda a [\d,]+ km al norte y el cerro San Cristóbal a [\d,]+ km al norponiente\.$/,
  );
  // Al lado de la Gran Torre no tiene sentido nombrarla.
  assert.doesNotMatch(textoReferencias([-33.4172, -70.6065]), /Gran Torre/);
});
