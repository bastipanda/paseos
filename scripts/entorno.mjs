// Genera datos/entorno.json: lo que rodea a cada lugar de la Santiagodex, de fuentes abiertas y verificables.
//   - OpenStreetMap (Overpass): juegos, canchas, máquinas de ejercicio, bebederos, áreas para perros y árboles con
//     especie en el lugar o junto a él (solo en plazas, parques, cerros y miradores); el barrio con nombre más cercano
//     (con su artículo de Wikipedia si el mapa lo trae) y las calles que lo rodean.
//   - Open-Meteo: la altura del terreno.
//   - Consejo de Monumentos Nacionales (su capa oficial pública): si queda dentro de un monumento histórico o una zona
//     típica, con el año y el decreto.
// node scripts/entorno.mjs   (unos minutos; si Overpass no responde, basta correrlo de nuevo)

import { santiagodex, overpass, pedirJson, esperar, normalizar, leerDatos, guardarDatos, avance } from './comun.mjs';
import { distancia, rumbo, aPlano } from '../js/geo.js';

const AREAS = new Set(['plaza', 'parque', 'juegos', 'cerro', 'mirador']);
const CMN =
  'https://services2.arcgis.com/mQ0T5ijzGExuCc9o/arcgis/rest/services/Pol%C3%ADgonos_Oficiales_Monumentos_Nacionales_1/FeatureServer/0/query';
const CALLES = 'primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|pedestrian';

// Lo que hay "en el lugar o junto a él": dentro del círculo que lo encierra (el tamaño es la diagonal del rectángulo
// que lo contiene) más un margen chico para lo que está en la vereda del frente.
const radioDentro = (l) => Math.max(40, (l.tamano || 0) / 2 + 15);
// Calles que lo rodean: las que pasan a menos de la mitad de su tamaño más una cuadra corta.
const radioCalles = (l) => Math.min(250, Math.max(60, (l.tamano || 0) / 2 + 30));
// Lado de una calle visto desde el centro del lugar: n(orte), o(riente), s(ur), p(oniente); "e" si el lugar está en ella.
const lado = (grados) => 'nosp'[Math.round(grados / 90) % 4];

const dex = await santiagodex();
const comunas = new Set((await leerDatos('comunas')).comunas.map((c) => normalizar(c.nombre)));
const lats = dex.map((l) => l.punto[0]);
const lons = dex.map((l) => l.punto[1]);
const [sur, oeste, norte, este] = [Math.min(...lats) - 0.01, Math.min(...lons) - 0.01, Math.max(...lats) + 0.01, Math.max(...lons) + 0.01];
const caja = `${sur},${oeste},${norte},${este}`;
console.log(`Santiagodex: ${dex.length} lugares, en ${caja}.`);

// Índice por celdas de ~200 m para encontrar rápido lo que está cerca de cada lugar.
const CELDA = 0.002;
const celdaDe = (lat, lon) => `${Math.floor(lat / CELDA)},${Math.floor(lon / CELDA)}`;
function indice() {
  const m = new Map();
  return {
    poner(lat, lon, cosa) {
      const k = celdaDe(lat, lon);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(cosa);
    },
    cerca([lat, lon], metros) {
      const n = Math.ceil(metros / 180) + 1;
      const [fi, ci] = [Math.floor(lat / CELDA), Math.floor(lon / CELDA)];
      const res = [];
      for (let i = fi - n; i <= fi + n; i++) for (let j = ci - n; j <= ci + n; j++) res.push(...(m.get(`${i},${j}`) || []));
      return res;
    },
  };
}

// Lo que entrega Overpass queda guardado en scripts/.cache/: si se cae a mitad de camino, al correrlo de nuevo no se
// vuelve a pedir lo que ya llegó.
const hecho = await avance('entorno');

// --- 1. Cosas, árboles y barrios (OpenStreetMap) ---
if (!hecho.tiene('elementos')) {
  const lista = await overpass(`[out:json][timeout:300];(
  nwr["leisure"~"^(playground|fitness_station|dog_park|pitch)$"](${caja});
  nwr["amenity"="drinking_water"](${caja});
  nwr["place"~"^(neighbourhood|suburb|quarter)$"]["name"](${caja});
  node["natural"="tree"]["species"](${caja});
);out center tags;`);
  await hecho.poner('elementos', lista);
  await hecho.guardar();
}
const elementos = hecho.datos.elementos;
const cosas = indice();
const arboles = indice();
const barrios = indice();
for (const e of elementos) {
  const [lat, lon] = e.center ? [e.center.lat, e.center.lon] : [e.lat, e.lon];
  const t = e.tags || {};
  const id = `${e.type[0]}${e.id}`;
  if (t.natural === 'tree') arboles.poner(lat, lon, { p: [lat, lon], especie: t['species:es'] || t.species });
  else if (t.place) {
    if (comunas.has(normalizar(t.name))) continue; // algunas comunas están marcadas como barrio
    const articulo = /^es:/.test(t.wikipedia || '') ? t.wikipedia : null;
    barrios.poner(lat, lon, { p: [lat, lon], nombre: t.name, articulo });
  } else {
    const clase = t.amenity === 'drinking_water' ? 'b' : { playground: 'j', fitness_station: 'e', dog_park: 'p', pitch: 'c' }[t.leisure];
    cosas.poner(lat, lon, { p: [lat, lon], id, clase, deporte: (t.sport || '').split(';')[0].trim() });
  }
}
console.log(`OSM: ${elementos.length} elementos (cosas, árboles con especie y barrios).`);

// --- 2. Calles con nombre, por cuadros de 0,1° para no pedirle tanto a Overpass de una vez ---
const tramos = indice();
const PASO = 0.1;
let consultas = 0;
for (let la = sur; la < norte; la += PASO) {
  for (let lo = oeste; lo < este; lo += PASO) {
    const cuadro = [la, lo, Math.min(norte, la + PASO), Math.min(este, lo + PASO)];
    // Solo los cuadros que tienen algún lugar de la Dex (con margen).
    if (!dex.some((l) => l.punto[0] > cuadro[0] - 0.003 && l.punto[0] < cuadro[2] + 0.003 && l.punto[1] > cuadro[1] - 0.003 && l.punto[1] < cuadro[3] + 0.003)) continue;
    const clave = `calles ${cuadro.map((x) => x.toFixed(3)).join(',')}`;
    if (!hecho.tiene(clave)) {
      const ways = await overpass(`[out:json][timeout:240];way["highway"~"^(${CALLES})$"]["name"](${cuadro.join(',')});out geom tags;`);
      // Solo el nombre y los puntos de cada calle, para que el avance guardado pese poco.
      await hecho.poner(clave, ways.map((w) => [w.tags.name, (w.geometry || []).flatMap((p) => [p.lat, p.lon])]));
      await hecho.guardar();
      consultas++;
      await esperar(3000);
    }
    for (const [nombre, plano] of hecho.datos[clave]) {
      for (let i = 2; i < plano.length; i += 2) {
        const a = [plano[i - 2], plano[i - 1]];
        const b = [plano[i], plano[i + 1]];
        tramos.poner((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { a, b, nombre });
      }
    }
  }
}
console.log(`Calles: ${consultas} cuadros consultados.`);

// Punto más cercano a `p` en el tramo a-b (en un plano local, sirve para distancias cortas).
function masCercano(p, a, b) {
  const [ax, ay] = aPlano(p, a);
  const [bx, by] = aPlano(p, b);
  const dx = bx - ax;
  const dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / largo2)) : 0;
  return { d: Math.hypot(ax + t * dx, ay + t * dy), punto: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] };
}

// --- 3. Altura del terreno (Open-Meteo, de a 100 puntos) ---
// Open-Meteo cuenta cada punto como una consulta y limita cuántas por minuto: de a 100 con una pausa de 12 s.
const alturaDe = (l) => hecho.datos[`altura ${l.punto[0].toFixed(5)},${l.punto[1].toFixed(5)}`];
for (let i = 0; i < dex.length; i += 100) {
  const grupo = dex.slice(i, i + 100);
  if (grupo.every((l) => alturaDe(l) !== undefined)) continue;
  const j = await pedirJson(
    `https://api.open-meteo.com/v1/elevation?latitude=${grupo.map((l) => l.punto[0].toFixed(5)).join(',')}&longitude=${grupo.map((l) => l.punto[1].toFixed(5)).join(',')}`,
  );
  for (const [k, l] of grupo.entries()) hecho.datos[`altura ${l.punto[0].toFixed(5)},${l.punto[1].toFixed(5)}`] = j.elevation[k];
  await hecho.guardar();
  await esperar(12_000);
}
const alturas = dex.map(alturaDe);
console.log(`Open-Meteo: altura de ${alturas.filter(Number.isFinite).length} lugares.`);

// --- 4. Monumentos históricos y zonas típicas (CMN) ---
const cmn = await pedirJson(
  `${CMN}?${new URLSearchParams({
    where: '1=1',
    geometry: `${oeste},${sur},${este},${norte}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: 4326,
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'NOMBRE,CATEGORIA,FCH_DEC,URL_DEC',
    outSR: 4326,
    f: 'geojson',
  })}`,
);
console.log(`CMN: ${cmn.features.length} monumentos y zonas típicas.`);
// Algunos monumentos históricos están solo como punto, sin contorno (por ejemplo, el Palacio Cousiño). Esos cuentan si
// el lugar está a menos de 60 m.
const CMN_PUNTOS =
  'https://services2.arcgis.com/mQ0T5ijzGExuCc9o/arcgis/rest/services/Puntos_Oficiales_Monumentos_Nacionales_(Vista)/FeatureServer/0/query';
const conContorno = new Set(cmn.features.map((f) => f.properties.NOMBRE));
const puntosCmn = (
  await pedirJson(
    `${CMN_PUNTOS}?${new URLSearchParams({
      where: '1=1',
      geometry: `${oeste},${sur},${este},${norte}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: 4326,
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'NOMBRE,CATEGORIA,FCH_DEC,URL_DEC',
      outSR: 4326,
      f: 'geojson',
    })}`,
  )
).features.filter((f) => /hist[oó]rico/i.test(f.properties.CATEGORIA || '') && !conContorno.has(f.properties.NOMBRE) && f.geometry);
console.log(`CMN: ${puntosCmn.length} monumentos históricos que solo están como punto.`);
const enAnillo = ([lat, lon], anillo) => {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};
const enPoligono = (p, g) =>
  !!g && (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).some((pol) => enAnillo(p, pol[0]) && !pol.slice(1).some((h) => enAnillo(p, h)));
const categoria = (c) => (/zona t[ií]pica/i.test(c) ? 'Zona Típica' : /santuario/i.test(c) ? 'Santuario de la Naturaleza' : 'Monumento Histórico');

// --- 5. Juntar todo por lugar ---
const lugares = {};
const monumentos = [];
const usados = new Map();
const cuenta = { hay: 0, arboles: 0, barrio: 0, barrioArticulo: 0, calles: 0, monumento: 0 };
dex.forEach((l, i) => {
  const e = {};
  if (Number.isFinite(alturas[i])) e.z = Math.round(alturas[i]);

  if (AREAS.has(l.tipo)) {
    const r = radioDentro(l);
    const hay = {};
    for (const c of cosas.cerca(l.punto, r)) {
      if (c.id === l.id || distancia(l.punto, c.p) > r) continue;
      if (c.clase === 'c') {
        hay.c = hay.c || {};
        hay.c[c.deporte] = (hay.c[c.deporte] || 0) + 1;
      } else hay[c.clase] = (hay[c.clase] || 0) + 1;
    }
    if (Object.keys(hay).length) {
      e.h = hay;
      cuenta.hay++;
    }
    const aqui = arboles.cerca(l.punto, r).filter((a) => distancia(l.punto, a.p) <= r);
    if (aqui.length) {
      const porEspecie = {};
      for (const a of aqui) porEspecie[a.especie] = (porEspecie[a.especie] || 0) + 1;
      e.r = [aqui.length, Object.entries(porEspecie).sort((a, b) => b[1] - a[1]).slice(0, 4)];
      cuenta.arboles++;
    }
  }

  const barrio = barrios
    .cerca(l.punto, 500)
    .map((b) => ({ b, d: distancia(l.punto, b.p) }))
    .filter(({ d }) => d <= 500)
    .sort((x, y) => x.d - y.d)[0];
  if (barrio) {
    e.b = barrio.b.articulo ? [barrio.b.nombre, barrio.b.articulo] : [barrio.b.nombre];
    cuenta.barrio++;
    if (barrio.b.articulo) cuenta.barrioArticulo++;
  }

  const rc = radioCalles(l);
  const porCalle = new Map();
  for (const t of tramos.cerca(l.punto, rc)) {
    const m = masCercano(l.punto, t.a, t.b);
    if (m.d > rc) continue;
    const previo = porCalle.get(t.nombre);
    if (!previo || m.d < previo.d) porCalle.set(t.nombre, m);
  }
  const calles = [...porCalle.entries()]
    .sort((x, y) => x[1].d - y[1].d)
    .slice(0, 4)
    // A menos de 20 m del centro: un punto (una estatua) "está en" esa calle; una plaza o parque grande, "junto a" ella
    // (la calle lo bordea o lo cruza, y el lado visto desde el centro no dice nada).
    .map(([nombre, m]) => [nombre, m.d < 20 ? ((l.tamano || 0) >= 60 ? 'j' : 'e') : lado(rumbo(l.punto, m.punto))]);
  if (calles.length) {
    e.c = calles;
    cuenta.calles++;
  }

  // Muchos lugares caen en la misma zona típica (el Parque Forestal tiene decenas): se guarda una vez en `monumentos`
  // y cada lugar apunta a su posición en esa lista.
  const dentro = cmn.features.filter((f) => enPoligono(l.punto, f.geometry)).map((f) => [f, false]);
  const cerca = puntosCmn
    .filter((f) => {
      const [lon, lat] = f.geometry.type === 'MultiPoint' ? f.geometry.coordinates[0] : f.geometry.coordinates;
      return distancia(l.punto, [lat, lon]) <= 60;
    })
    .map((f) => [f, true]);
  if (dentro.length || cerca.length) {
    e.m = [...dentro, ...cerca].map(([f, esCerca]) => {
      if (!usados.has(f)) {
        const p = f.properties;
        const decreto = /href=["']?([^"' >]+)/.exec(p.URL_DEC || '')?.[1] || null;
        const anio = p.FCH_DEC ? new Date(p.FCH_DEC).getUTCFullYear() : null;
        usados.set(f, monumentos.push([categoria(p.CATEGORIA || ''), (p.NOMBRE || '').trim(), anio, decreto, ...(esCerca ? [1] : [])]) - 1);
      }
      return usados.get(f);
    });
    cuenta.monumento++;
  }

  if (Object.keys(e).length) lugares[l.id] = e;
});

console.log('\nLo que se gana:');
console.log(`  Qué hay (juegos, canchas, máquinas, bebedero, perros): ${cuenta.hay} · árboles con especie: ${cuenta.arboles}`);
console.log(`  Barrio cercano: ${cuenta.barrio} (con artículo: ${cuenta.barrioArticulo}) · calles: ${cuenta.calles}`);
console.log(`  Dentro de un monumento o zona típica: ${cuenta.monumento}`);
await guardarDatos('entorno', {
  generado: new Date().toISOString().slice(0, 10),
  fuente: 'OpenStreetMap (© colaboradores de OpenStreetMap, ODbL), Open-Meteo (altura) y Consejo de Monumentos Nacionales',
  campos: {
    z: 'altura del terreno en metros',
    h: 'qué hay: j juegos, e máquinas de ejercicio, p área para perros, b bebedero, c canchas por deporte',
    r: '[árboles con especie, [[especie, cantidad]…]]',
    b: '[barrio cercano, artículo de Wikipedia?]',
    c: '[[calle, lado (n, o, s, p; e = está en ella, j = junto a ella)]…]',
    m: 'posiciones en `monumentos`, cada uno [categoría, nombre, año del decreto, enlace al decreto, 1 si es un punto cercano y no un contorno]',
  },
  monumentos,
  lugares,
});
