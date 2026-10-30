// Genera, desde OpenStreetMap (consulta a Overpass), los datos para "Pasar por…" y los servicios en la ruta:
//   datos/interes.json   lugares interesantes con nombre (museos, miradores, monumentos, obras de arte, patrimonio)
//   datos/comercio.json  cuántos locales (tiendas, cafés, restoranes, bares) hay en cada cuadro de ~100 m
//   datos/servicios.json bebederos y baños públicos
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

function tipoInteres(t) {
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
    lugares.push([r5(p[0]), r5(p[1]), nombre, tipoInteres(t), t.wikipedia || '']);
  }
  return lugares;
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
    JSON.stringify({ generado: hoy, fuente, campos: ['lat', 'lon', 'nombre', 'tipo', 'wikipedia'], lugares: listaInteres }),
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
