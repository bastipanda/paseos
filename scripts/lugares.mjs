// Genera, desde OpenStreetMap (consulta a Overpass), los datos para "Pasar por…", los servicios, los trámites y el
// metro:
//   datos/interes.json   lugares interesantes con nombre (museos, miradores, monumentos, obras de arte, patrimonio,
//                        cerros), con su identificador de OSM para la Santiagodex
//   datos/comercio.json  cuántos locales (tiendas, cafés, restoranes, bares) hay en cada cuadro de ~100 m
//   datos/servicios.json bebederos y baños públicos
//   datos/tramites.json  supermercados, farmacias, panaderías, ferias, cajeros y ferreterías
//   datos/metro.json     estaciones de metro con sus líneas y colores
// Se corre a mano cada algunos meses:  node scripts/lugares.mjs
// Para regenerar solo una parte (por ejemplo, si Overpass falló en una):  node scripts/lugares.mjs interes
// Igual que plazas.mjs: se guarda como archivo porque Overpass se cae seguido.

import { writeFile, mkdir } from 'node:fs/promises';

const CAJA = '-33.65,-70.85,-33.30,-70.45';
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
// Tamaño del cuadro de comercio: ~100 m de lado en Santiago.
const CELDA = [0.0009, 0.00108];

async function consultar(consulta, nombre) {
  for (const url of SERVIDORES) {
    try {
      console.log(`${nombre}: consultando ${url}…`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'paseos (https://github.com/bastipanda/paseos)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: consulta }),
        signal: AbortSignal.timeout(300_000),
      });
      const texto = await resp.text();
      if (!resp.ok || !texto.trim().startsWith('{')) {
        console.log(`  falló (${resp.status}): ${texto.slice(0, 120).replace(/\s+/g, ' ')}`);
        continue;
      }
      return JSON.parse(texto).elements;
    } catch (e) {
      console.log(`  falló: ${e.message}`);
    }
  }
  throw new Error(`${nombre}: ningún servidor de Overpass respondió. Intenta más tarde.`);
}

const centro = (e) => (e.type === 'node' ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : null);
const r5 = (x) => Math.round(x * 1e5) / 1e5;
// Identificador corto y estable de OSM: n123 (punto), w456 (línea o área), r789 (relación).
const idOsm = (e) => `${e.type[0]}${e.id}`;

function distancia(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function tipoInteres(t) {
  if (t.natural === 'peak') return 'cerro';
  if (t.tourism === 'museum' || t.tourism === 'gallery') return 'museo';
  if (t.tourism === 'viewpoint') return 'mirador';
  if (t.tourism === 'artwork') return 'arte';
  if (['theatre', 'arts_centre', 'library'].includes(t.amenity)) return 'cultura';
  if (t.historic || t.heritage) return 'historia';
  return 'atraccion';
}

async function interes() {
  const elementos = await consultar(
    `[out:json][timeout:240];
(
  nwr["tourism"~"^(attraction|museum|gallery|viewpoint|artwork)$"](${CAJA});
  nwr["historic"]["name"](${CAJA});
  nwr["heritage"]["name"](${CAJA});
  nwr["amenity"~"^(theatre|arts_centre|library)$"]["name"](${CAJA});
  node["natural"="peak"]["name"](${CAJA});
);
out tags center;`,
    'Lugares interesantes',
  );
  const vistos = new Set();
  const lugares = [];
  for (const e of elementos) {
    const t = e.tags || {};
    const p = centro(e);
    const nombre = (t.name || '').trim();
    // Sin nombre solo sirven los miradores; un "monumento" sin nombre no le dice nada a nadie.
    if (!p || (!nombre && t.tourism !== 'viewpoint')) continue;
    // Las placas y memoriales pequeños (muchos con nombres de personas) no son "lugares interesantes" para
    // pasear; se dejan solo las estatuas, bustos, esculturas y los que tienen artículo en Wikipedia.
    const conWiki = Boolean(t.wikipedia || t.wikidata);
    if (['plaque', 'blue_plaque', 'ghost_bike', 'stolperstein', 'stone'].includes(t.memorial) && !conWiki) continue;
    if (t.historic === 'memorial' && !['statue', 'bust', 'sculpture', 'obelisk', 'war_memorial'].includes(t.memorial) && !conWiki) continue;
    if (/^bibliometro/i.test(nombre)) continue;
    const clave = `${nombre}|${r5(p[0]).toFixed(3)}|${r5(p[1]).toFixed(3)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    lugares.push([r5(p[0]), r5(p[1]), nombre, tipoInteres(t), t.wikipedia || '', idOsm(e)]);
  }
  return lugares;
}

const TIPOS_TRAMITE = [
  ['supermercado', (t) => t.shop === 'supermarket'],
  ['farmacia', (t) => t.amenity === 'pharmacy'],
  ['panaderia', (t) => t.shop === 'bakery'],
  ['feria', (t) => t.amenity === 'marketplace'],
  ['cajero', (t) => t.amenity === 'atm' || t.amenity === 'bank'],
  ['ferreteria', (t) => t.shop === 'hardware' || t.shop === 'doityourself'],
];

async function tramites() {
  const elementos = await consultar(
    `[out:json][timeout:240];
(
  nwr["shop"~"^(supermarket|bakery|hardware|doityourself)$"](${CAJA});
  nwr["amenity"~"^(pharmacy|marketplace|atm|bank)$"](${CAJA});
);
out tags center;`,
    'Trámites',
  );
  const lugares = [];
  for (const e of elementos) {
    const t = e.tags || {};
    const p = centro(e);
    const tipo = TIPOS_TRAMITE.find(([, es]) => es(t))?.[0];
    if (!p || !tipo || ['private', 'no', 'customers'].includes(t.access)) continue;
    const nombre = (t.name || t.brand || (tipo === 'cajero' && t.operator ? `Cajero ${t.operator}` : '')).trim();
    lugares.push([r5(p[0]), r5(p[1]), nombre, tipo]);
  }
  return lugares;
}

// Estaciones de metro y sus líneas. Cada línea es una relación route=subway de OSM (una por sentido); una estación
// pertenece a una línea si alguna parada de esa línea está a menos de 250 m.
async function metro() {
  const elementos = await consultar(
    `[out:json][timeout:240];
(
  nwr["railway"="station"]["station"="subway"](${CAJA});
  nwr["public_transport"="station"]["subway"="yes"](${CAJA});
)->.est;
.est out tags center;
rel["route"="subway"](${CAJA})->.r;
.r out body;
node(r.r);
out skel;`,
    'Metro',
  );
  const nodos = new Map(elementos.filter((e) => e.type === 'node' && !e.tags).map((e) => [e.id, [e.lat, e.lon]]));
  const lineas = new Map();
  for (const r of elementos.filter((e) => e.type === 'relation')) {
    const t = r.tags || {};
    // Las extensiones proyectadas o en construcción también están en OSM: no sirven para pasear todavía.
    if (/proyect|propuest|construc/i.test(t.name || '') || ['proposed', 'construction'].includes(t.state)) continue;
    const ref = (t.ref || t.name || '').replace(/^L[íi]nea\s*/i, '').replace(/^L/, '').split(/[:\s]/)[0];
    if (!ref) continue;
    const linea = lineas.get(ref) || { ref, color: t.colour || '#555555', paradas: [] };
    for (const m of r.members || []) if (m.type === 'node' && nodos.has(m.ref)) linea.paradas.push(nodos.get(m.ref));
    lineas.set(ref, linea);
  }
  const vistas = new Map();
  for (const e of elementos.filter((x) => x.tags && x.type !== 'relation')) {
    const p = centro(e);
    const nombre = (e.tags.name || '').replace(/^Estaci[óo]n\s+/i, '').trim();
    if (!p || !nombre) continue;
    const delaEstacion = [...lineas.values()].filter((l) => l.paradas.some((q) => distancia(p, q) < 250)).map((l) => l.ref);
    const previa = vistas.get(nombre);
    if (previa && distancia(previa.p, p) < 400) {
      previa.lineas = [...new Set([...previa.lineas, ...delaEstacion])];
      continue;
    }
    vistas.set(previa ? `${nombre}#${e.id}` : nombre, { p, nombre, lineas: delaEstacion });
  }
  // Una línea con menos de 4 estaciones marcadas como de metro todavía no funciona (por ejemplo, una en construcción
  // cuyas paradas quedan junto a estaciones existentes).
  const conteo = new Map();
  for (const s of vistas.values()) for (const l of s.lineas) conteo.set(l, (conteo.get(l) || 0) + 1);
  for (const ref of [...lineas.keys()]) if ((conteo.get(ref) || 0) < 4) lineas.delete(ref);
  for (const s of vistas.values()) s.lineas = s.lineas.filter((l) => lineas.has(l));
  const orden = (a, b) => a.localeCompare(b, 'es', { numeric: true });
  return {
    lineas: Object.fromEntries([...lineas.values()].sort((a, b) => orden(a.ref, b.ref)).map((l) => [l.ref, l.color])),
    estaciones: [...vistas.values()]
      .filter((s) => s.lineas.length)
      .sort((a, b) => orden(a.nombre, b.nombre))
      .map((s) => [r5(s.p[0]), r5(s.p[1]), s.nombre, s.lineas.sort(orden).join(';')]),
  };
}

async function comercio() {
  const elementos = await consultar(
    `[out:json][timeout:240];
(
  nwr["shop"](${CAJA});
  nwr["amenity"~"^(cafe|restaurant|bar|pub|ice_cream|fast_food|marketplace)$"](${CAJA});
);
out center;`,
    'Comercio',
  );
  const celdas = new Map();
  for (const e of elementos) {
    const p = centro(e);
    if (!p) continue;
    const clave = `${Math.floor(p[0] / CELDA[0])},${Math.floor(p[1] / CELDA[1])}`;
    celdas.set(clave, (celdas.get(clave) || 0) + 1);
  }
  return { total: elementos.length, celdas: Object.fromEntries(celdas) };
}

async function servicios() {
  const elementos = await consultar(
    `[out:json][timeout:240];
(
  nwr["amenity"="drinking_water"](${CAJA});
  nwr["amenity"="toilets"](${CAJA});
);
out tags center;`,
    'Servicios',
  );
  return elementos
    .filter((e) => !['private', 'no', 'customers'].includes(e.tags?.access))
    .map((e) => {
      const p = centro(e);
      return p && [r5(p[0]), r5(p[1]), e.tags.amenity === 'toilets' ? 'baño' : 'agua', (e.tags.name || '').trim()];
    })
    .filter(Boolean);
}

const hoy = new Date().toISOString().slice(0, 10);
const fuente = 'OpenStreetMap, © colaboradores de OpenStreetMap (ODbL)';
const partes = process.argv.slice(2);
const toca = (parte) => !partes.length || partes.includes(parte);
await mkdir(new URL('../datos/', import.meta.url), { recursive: true });

if (toca('interes')) {
  const listaInteres = await interes();
  await writeFile(
    new URL('../datos/interes.json', import.meta.url),
    JSON.stringify({ generado: hoy, fuente, campos: ['lat', 'lon', 'nombre', 'tipo', 'wikipedia', 'id_osm'], lugares: listaInteres }),
  );
  console.log(`Lugares interesantes: ${listaInteres.length}.`);
}

if (toca('comercio')) {
  const datosComercio = await comercio();
  await writeFile(
    new URL('../datos/comercio.json', import.meta.url),
    JSON.stringify({ generado: hoy, fuente, celda: CELDA, celdas: datosComercio.celdas }),
  );
  console.log(`Comercio: ${datosComercio.total} locales en ${Object.keys(datosComercio.celdas).length} cuadros.`);
}

if (toca('servicios')) {
  const listaServicios = await servicios();
  await writeFile(
    new URL('../datos/servicios.json', import.meta.url),
    JSON.stringify({ generado: hoy, fuente, campos: ['lat', 'lon', 'tipo', 'nombre'], lugares: listaServicios }),
  );
  console.log(`Servicios: ${listaServicios.length} (bebederos y baños).`);
}

if (toca('tramites')) {
  const listaTramites = await tramites();
  await writeFile(
    new URL('../datos/tramites.json', import.meta.url),
    JSON.stringify({ generado: hoy, fuente, campos: ['lat', 'lon', 'nombre', 'tipo'], lugares: listaTramites }),
  );
  const porTipo = {};
  for (const l of listaTramites) porTipo[l[3]] = (porTipo[l[3]] || 0) + 1;
  console.log(`Trámites: ${listaTramites.length}.`, porTipo);
}

if (toca('metro')) {
  const datosMetro = await metro();
  await writeFile(
    new URL('../datos/metro.json', import.meta.url),
    JSON.stringify({ generado: hoy, fuente, campos: ['lat', 'lon', 'nombre', 'lineas'], ...datosMetro }),
  );
  console.log(`Metro: ${datosMetro.estaciones.length} estaciones, líneas ${Object.keys(datosMetro.lineas).join(', ')}.`);
}
