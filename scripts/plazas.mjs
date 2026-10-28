// Genera datos/plazas.json con las plazas, plazoletas, parques y plazas de juegos del Gran Santiago,
// a partir de OpenStreetMap (consulta a Overpass). Se corre a mano cada algunos meses:
//   node scripts/plazas.mjs
// Se guarda como archivo porque Overpass se cae seguido y la app no debe depender de él en vivo.

import { writeFile, mkdir } from 'node:fs/promises';

// Caja del Gran Santiago: sur, oeste, norte, este.
const CAJA = '-33.65,-70.85,-33.30,-70.45';
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const CONSULTA = `[out:json][timeout:240];
(
  way["leisure"~"^(park|playground)$"](${CAJA});
  relation["leisure"~"^(park|playground)$"](${CAJA});
  way["place"="square"](${CAJA});
  way["highway"="pedestrian"]["area"="yes"]["name"~"[Pp]laza"](${CAJA});
)->.areas;
.areas out tags bb;
(
  node["leisure"~"^(park|playground)$"](${CAJA});
  node["place"="square"](${CAJA});
)->.puntos;
.puntos out;`;

const TAMANO_MINIMO_SIN_NOMBRE = 30;

async function consultar() {
  for (const url of SERVIDORES) {
    try {
      console.log(`Consultando ${url}…`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': 'paseos (https://github.com/bastipanda/paseos)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: CONSULTA }),
        signal: AbortSignal.timeout(300_000),
      });
      const texto = await resp.text();
      if (!resp.ok || !texto.trim().startsWith('{')) {
        console.log(`  falló (${resp.status}): ${texto.slice(0, 120).replace(/\s+/g, ' ')}`);
        continue;
      }
      return JSON.parse(texto);
    } catch (e) {
      console.log(`  falló: ${e.message}`);
    }
  }
  throw new Error('Ningún servidor de Overpass respondió. Intenta más tarde.');
}

function distancia(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const h =
    Math.sin(rad(b[0] - a[0]) / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function tipoDe(tags, tamano) {
  const nombre = tags.name || '';
  if (tags.leisure === 'playground') return 'juegos';
  if (/parque/i.test(nombre)) return 'parque';
  if (tags.place === 'square' || /plaz/i.test(nombre)) return 'plaza';
  return tamano >= 250 ? 'parque' : 'plaza';
}

function aLugar(e) {
  const tags = e.tags || {};
  if (['private', 'no'].includes(tags.access)) return null;
  let punto;
  let tamano = 0;
  let caja = null;
  if (e.type === 'node') {
    punto = [e.lat, e.lon];
  } else if (e.bounds) {
    const { minlat, minlon, maxlat, maxlon } = e.bounds;
    punto = [(minlat + maxlat) / 2, (minlon + maxlon) / 2];
    tamano = distancia([minlat, minlon], [maxlat, maxlon]);
    caja = [minlat, minlon, maxlat, maxlon];
  } else {
    return null;
  }
  const nombre = (tags.name || '').trim();
  if (!nombre && tamano < TAMANO_MINIMO_SIN_NOMBRE) return null;
  return { punto, nombre, tipo: tipoDe(tags, tamano), tamano, caja };
}

const dentro = (p, c) => c && p[0] >= c[0] && p[0] <= c[2] && p[1] >= c[1] && p[1] <= c[3];

// Quita repetidos: lo que no tiene nombre y cae dentro de otro lugar ya guardado (por ejemplo, unos juegos dentro de
// un parque), o cualquier cosa a menos de 25 m de otro lugar ya guardado.
function sinRepetidos(lugares) {
  lugares.sort((a, b) => Number(Boolean(b.nombre)) - Number(Boolean(a.nombre)) || b.tamano - a.tamano);
  const celda = 0.005;
  const grilla = new Map();
  const clave = (lat, lon) => `${Math.floor(lat / celda)},${Math.floor(lon / celda)}`;
  const guardados = [];
  for (const l of lugares) {
    const [lat, lon] = l.punto;
    let repetido = false;
    for (let i = -2; i <= 2 && !repetido; i++) {
      for (let j = -2; j <= 2 && !repetido; j++) {
        for (const g of grilla.get(clave(lat + i * celda, lon + j * celda)) || []) {
          if (distancia(g.punto, l.punto) < 25 || (!l.nombre && dentro(l.punto, g.caja))) {
            repetido = true;
            break;
          }
        }
      }
    }
    if (repetido) continue;
    guardados.push(l);
    const k = clave(lat, lon);
    if (!grilla.has(k)) grilla.set(k, []);
    grilla.get(k).push(l);
  }
  return guardados;
}

const datos = await consultar();
const lugares = sinRepetidos(datos.elements.map(aLugar).filter(Boolean));
const redondear = (x) => Math.round(x * 1e5) / 1e5;
const salida = {
  generado: new Date().toISOString().slice(0, 10),
  fuente: 'OpenStreetMap, © colaboradores de OpenStreetMap (ODbL)',
  campos: ['lat', 'lon', 'nombre', 'tipo', 'tamano_m'],
  lugares: lugares.map((l) => [redondear(l.punto[0]), redondear(l.punto[1]), l.nombre, l.tipo, Math.round(l.tamano)]),
};
await mkdir(new URL('../datos/', import.meta.url), { recursive: true });
await writeFile(new URL('../datos/plazas.json', import.meta.url), JSON.stringify(salida));
const porTipo = {};
for (const l of lugares) porTipo[l.tipo] = (porTipo[l.tipo] || 0) + 1;
console.log(`Listo: ${lugares.length} lugares (${lugares.filter((l) => l.nombre).length} con nombre).`, porTipo);
