// Genera datos/comunas.json desde OpenStreetMap (Overpass): el contorno de cada comuna del Gran Santiago y cuántos
// cuadros de ~50 m con calles caminables tiene. Sirve para "Tu mapa" (qué porcentaje de cada comuna caminaste), para
// la Santiagodex (en qué comuna está cada lugar) y para mostrar los datos del CEAD de la comuna correcta.
// Se corre a mano cada algunos meses (tarda varios minutos: pide las calles por pedazos):
//   node scripts/comunas.mjs
// Cada pedazo descargado se guarda en la carpeta temporal del computador (una carpeta por día): si Overpass falla a
// mitad de camino, al correrlo de nuevo el mismo día sigue desde donde quedó.

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CELDA } from '../js/explorar.js';
import { muestrear, simplificar } from '../js/geo.js';

const HOY = new Date().toISOString().slice(0, 10);
const CACHE = join(tmpdir(), `paseos-comunas-${HOY}`);

async function conCache(nombre, calcular) {
  const ruta = join(CACHE, `${nombre}.json`);
  try {
    return { valor: JSON.parse(await readFile(ruta, 'utf8')), nuevo: false };
  } catch {
    const valor = await calcular();
    await mkdir(CACHE, { recursive: true });
    await writeFile(ruta, JSON.stringify(valor));
    return { valor, nuevo: true };
  }
}

const CAJA = [-33.65, -70.85, -33.3, -70.45];
const LADO = 0.05;
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function consultar(consulta, nombre) {
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    for (const url of SERVIDORES) {
      try {
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
        if (resp.ok && texto.trim().startsWith('{')) return JSON.parse(texto).elements;
        console.log(`  ${nombre}: ${url} falló (${resp.status})`);
      } catch (e) {
        console.log(`  ${nombre}: ${url} falló (${e.message})`);
      }
    }
    await new Promise((r) => setTimeout(r, 30000 * (vuelta + 1)));
  }
  throw new Error(`${nombre}: ningún servidor de Overpass respondió. Intenta más tarde.`);
}

// Une los tramos del borde de una comuna en anillos cerrados.
function armarAnillos(miembros) {
  const tramos = miembros.filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry?.length).map((m) => m.geometry.map((p) => [p.lat, p.lon]));
  const igual = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  const anillos = [];
  while (tramos.length) {
    let anillo = tramos.shift();
    let avanzo = true;
    while (!igual(anillo[0], anillo[anillo.length - 1]) && avanzo) {
      avanzo = false;
      for (let i = 0; i < tramos.length; i++) {
        const t = tramos[i];
        const fin = anillo[anillo.length - 1];
        if (igual(t[0], fin)) anillo = anillo.concat(t.slice(1));
        else if (igual(t[t.length - 1], fin)) anillo = anillo.concat(t.slice(0, -1).reverse());
        else continue;
        tramos.splice(i, 1);
        avanzo = true;
        break;
      }
    }
    if (anillo.length >= 4) anillos.push(anillo);
  }
  return anillos;
}

function dentro(p, anillo) {
  let adentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [yi, xi] = anillo[i];
    const [yj, xj] = anillo[j];
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}

const cajaDe = (anillos) => {
  const todos = anillos.flat();
  return [Math.min(...todos.map((p) => p[0])), Math.min(...todos.map((p) => p[1])), Math.max(...todos.map((p) => p[0])), Math.max(...todos.map((p) => p[1]))];
};

console.log(`Comunas: pidiendo los contornos… (pedazos guardados en ${CACHE})`);
const { valor: relaciones } = await conCache('contornos', () =>
  consultar(
    `[out:json][timeout:300];
rel["boundary"="administrative"]["admin_level"="8"](${CAJA.join(',')});
out geom;`,
    'Contornos',
  ),
);
const comunas = relaciones
  .map((r) => ({ nombre: (r.tags?.name || '').trim(), anillos: armarAnillos(r.members || []) }))
  .filter((c) => c.nombre && c.anillos.length)
  .map((c) => ({ ...c, caja: cajaDe(c.anillos), celdas: 0 }));
console.log(`  ${comunas.length} comunas.`);

// Cuadros de ~50 m que tienen alguna calle, vereda o sendero caminable (no autopistas ni estacionamientos).
const celdas = new Set();
const filtro =
  'way["highway"~"^(primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|pedestrian|footway|path|steps|cycleway|track|service)$"]' +
  '["service"!~"parking_aisle|driveway"]["access"!~"^(private|no)$"]';
let n = 0;
const total = Math.ceil((CAJA[2] - CAJA[0]) / LADO) * Math.ceil((CAJA[3] - CAJA[1]) / LADO);
for (let sur = CAJA[0]; sur < CAJA[2]; sur += LADO) {
  for (let oeste = CAJA[1]; oeste < CAJA[3]; oeste += LADO) {
    n++;
    const caja = [sur, oeste, Math.min(sur + LADO, CAJA[2]), Math.min(oeste + LADO, CAJA[3])].map((x) => x.toFixed(4)).join(',');
    // Por pedazo se guardan solo los cuadros (no las calles): ocupa poco y alcanza para retomar.
    const { valor: claves, nuevo } = await conCache(`calles-${n}`, async () => {
      const calles = await consultar(`[out:json][timeout:180];${filtro}(${caja});out geom qt;`, `Calles ${n}/${total}`);
      const propias = new Set();
      for (const w of calles) {
        const coords = (w.geometry || []).map((p) => [p.lat, p.lon]);
        for (const { p } of muestrear(coords, 20)) propias.add(`${Math.floor(p[0] / CELDA[0])},${Math.floor(p[1] / CELDA[1])}`);
      }
      return [...propias];
    });
    for (const c of claves) celdas.add(c);
    console.log(`  calles ${n}/${total}${nuevo ? '' : ' (ya descargado)'}: ${celdas.size} cuadros en total`);
    if (nuevo) await new Promise((r) => setTimeout(r, 1500));
  }
}

for (const clave of celdas) {
  const [i, j] = clave.split(',').map(Number);
  const p = [(i + 0.5) * CELDA[0], (j + 0.5) * CELDA[1]];
  const c = comunas.find((x) => p[0] >= x.caja[0] && p[0] <= x.caja[2] && p[1] >= x.caja[1] && p[1] <= x.caja[3] && x.anillos.some((a) => dentro(p, a)));
  if (c) c.celdas++;
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const salida = {
  generado: new Date().toISOString().slice(0, 10),
  fuente: 'OpenStreetMap, © colaboradores de OpenStreetMap (ODbL)',
  celda: CELDA,
  comunas: comunas
    .filter((c) => c.celdas > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((c) => ({
      nombre: c.nombre,
      celdas: c.celdas,
      caja: c.caja.map(r4),
      anillos: c.anillos.map((a) => simplificar(a, 25).map(([lat, lon]) => [r4(lat), r4(lon)])),
    })),
};
await mkdir(new URL('../datos/', import.meta.url), { recursive: true });
await writeFile(new URL('../datos/comunas.json', import.meta.url), JSON.stringify(salida));
console.log(`Listo: ${salida.comunas.length} comunas.`, salida.comunas.map((c) => `${c.nombre} ${c.celdas}`).join(', '));
