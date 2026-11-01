// Genera datos/contexto.json: lo que se sabe de cada lugar de la Santiagodex, solo de fuentes verificables.
//   - De OpenStreetMap (consulta a Overpass): si es patrimonio, el texto de su placa, el artista, el año, su
//     descripción y a quién homenajea su nombre (name:etymology:wikidata).
//   - De Wikidata: el artículo de Wikipedia en español de los lugares que traen `wikidata` pero no `wikipedia`, y quién
//     es la persona del nombre (nombre y descripción corta).
//   - De Wikipedia: artículos con ubicación cerca del lugar y con el mismo nombre (búsqueda por zona).
// No se adivina nada: si el nombre no calza exacto o el mapa no dice a quién homenajea, no se agrega.
// Se corre a mano después de regenerar plazas y lugares:  node scripts/contexto.mjs   (tarda unos minutos)

import { readFile, writeFile } from 'node:fs/promises';
import { leerPlazas, leerInteres } from '../js/plazas.js';
import { crearDex } from '../js/dex.js';
import { distancia } from '../js/geo.js';

const UA = { 'User-Agent': 'paseos (https://github.com/bastipanda/paseos)' };
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(consulta) {
  for (const url of SERVIDORES) {
    try {
      console.log(`Overpass: consultando ${url}…`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: consulta }),
        signal: AbortSignal.timeout(300_000),
      });
      const texto = await resp.text();
      if (resp.ok && texto.trim().startsWith('{')) return JSON.parse(texto).elements;
      console.log(`  falló (${resp.status})`);
    } catch (e) {
      console.log(`  falló: ${e.message}`);
    }
  }
  throw new Error('Ningún servidor de Overpass respondió. Intenta más tarde.');
}

// API de Wikimedia (Wikipedia o Wikidata), con reintentos cuando dice que está ocupada.
async function wikimedia(sitio, params) {
  const url = `https://${sitio}/w/api.php?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let intento = 0; intento < 6; intento++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000) });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (json.error && /busy|ratelimit|toomany/i.test(`${json.error.code} ${json.error.info}`)) throw new Error(json.error.info);
      if (json.error) throw Object.assign(new Error(json.error.info), { definitivo: true });
      return json;
    } catch (e) {
      if (e.definitivo) throw e;
      await esperar(2000 * (intento + 1));
    }
  }
  throw new Error(`${sitio} no respondió.`);
}

// "Plaza Ñuñoa" y "plaza ñuñoa (santiago)" se comparan igual: sin tildes, sin mayúsculas ni lo que va entre paréntesis.
const normalizar = (t) =>
  t
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

// Calce parcial, para casos como "Museo Palacio Cousiño" ~ "Palacio Cousiño" o "Andrés Bello" ~ "Monumento a Andrés
// Bello". Se descartan estaciones de metro, comunas y ciudades; si el título es el más largo, tiene que nombrar un
// lugar (no una universidad o un colegio que lleva el mismo nombre).
const LUGAR_EN_TITULO = /^(monumento|homenaje|plaza|plazoleta|plazuela|parque|anfiteatro|museo|estatua|busto|mirador) /;
function calzaParcial(nombre, titulo, comunas) {
  if (/\(estaci[oó]n/i.test(titulo)) return false;
  const n = normalizar(nombre);
  const t = normalizar(titulo);
  if (t.split(' ').length < 2 || comunas.has(t) || t === 'santiago de chile') return false;
  if (n.includes(t)) return true;
  return t.includes(n) && n.split(' ').length >= 2 && LUGAR_EN_TITULO.test(t);
}

const recortar = (t, max = 400) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

// --- 1. La Santiagodex, igual que en la app ---
const leer = async (nombre) => JSON.parse(await readFile(new URL(`../datos/${nombre}.json`, import.meta.url), 'utf8'));
const dex = crearDex(leerPlazas(await leer('plazas')), leerInteres(await leer('interes')));
const COMUNAS = new Set((await leer('comunas')).comunas.map((c) => normalizar(c.nombre)));
console.log(`Santiagodex: ${dex.length} lugares (${dex.filter((l) => l.wikipedia).length} ya con Wikipedia).`);

// --- 2. Etiquetas de OSM de cada lugar ---
const porTipo = { n: [], w: [], r: [] };
for (const l of dex) porTipo[l.id[0]].push(l.id.slice(1));
const consulta = `[out:json][timeout:240];(${[
  ['node', porTipo.n],
  ['way', porTipo.w],
  ['relation', porTipo.r],
]
  .filter(([, ids]) => ids.length)
  .map(([t, ids]) => `${t}(id:${ids.join(',')});`)
  .join('')});out tags;`;
const etiquetas = new Map((await overpass(consulta)).map((e) => [`${e.type[0]}${e.id}`, e.tags || {}]));
console.log(`OSM: etiquetas de ${etiquetas.size} lugares.`);

// --- 3. Wikidata: artículo en español de los que traen `wikidata`, y la persona del nombre ---
const qids = new Set();
for (const l of dex) {
  const t = etiquetas.get(l.id) || {};
  if (!l.wikipedia && /^Q\d+$/.test(t.wikidata || '')) qids.add(t.wikidata);
  for (const q of (t['name:etymology:wikidata'] || '').split(';')) if (/^Q\d+$/.test(q.trim())) qids.add(q.trim());
}
const entidades = new Map();
const listaQ = [...qids];
for (let i = 0; i < listaQ.length; i += 50) {
  const r = await wikimedia('www.wikidata.org', {
    action: 'wbgetentities',
    ids: listaQ.slice(i, i + 50).join('|'),
    props: 'labels|descriptions|sitelinks',
    languages: 'es',
    sitefilter: 'eswiki',
  });
  for (const [q, e] of Object.entries(r.entities || {})) {
    entidades.set(q, { nombre: e.labels?.es?.value || null, descripcion: e.descriptions?.es?.value || null, articulo: e.sitelinks?.eswiki?.title || null });
  }
}
console.log(`Wikidata: ${entidades.size} entidades.`);

// --- 4. Wikipedia: artículos con ubicación en la zona de la Santiagodex ---
// La API entrega a lo más 500 por cuadro: los cuadros llenos se parten en cuatro.
const articulos = [];
let consultas = 0;
async function buscarEn(norte, oeste, sur, este) {
  consultas++;
  // Sin filtrar por tipo de página en la consulta: ese filtro se aplica después del tope de 500 y escondería que el
  // cuadro venía lleno. Los artículos (ns 0) se separan acá.
  const r = await wikimedia('es.wikipedia.org', { action: 'query', list: 'geosearch', gsbbox: `${norte}|${oeste}|${sur}|${este}`, gslimit: 500 });
  const lista = r.query?.geosearch || [];
  if (lista.length >= 500 && norte - sur > 0.002) {
    const mlat = (norte + sur) / 2;
    const mlon = (oeste + este) / 2;
    for (const [n, o, s, e] of [[norte, oeste, mlat, mlon], [norte, mlon, mlat, este], [mlat, oeste, sur, mlon], [mlat, mlon, sur, este]]) await buscarEn(n, o, s, e);
    return;
  }
  articulos.push(...lista.filter((a) => a.ns === 0));
}
const lats = dex.map((l) => l.punto[0]);
const lons = dex.map((l) => l.punto[1]);
const [norte, sur, oeste, este] = [Math.max(...lats) + 0.005, Math.min(...lats) - 0.005, Math.min(...lons) - 0.005, Math.max(...lons) + 0.005];
const PASO = 0.09; // ~10 km: más grande, la API dice que el cuadro es muy grande
for (let n = norte; n > sur; n -= PASO) for (let o = oeste; o < este; o += PASO) await buscarEn(n, o, Math.max(sur, n - PASO), Math.min(este, o + PASO));
const unicos = new Map(articulos.map((a) => [a.pageid, a]));
console.log(`Wikipedia: ${unicos.size} artículos con ubicación (${consultas} consultas).`);
const porNombre = new Map();
const porTitulo = new Map([...unicos.values()].map((a) => [a.title, a]));
for (const a of unicos.values()) {
  const k = normalizar(a.title);
  porNombre.set(k, [...(porNombre.get(k) || []), a]);
}

// --- 5. Juntar todo por lugar ---
const PATRIMONIO = { monument: 'Monumento', memorial: 'Memorial', ruins: 'Ruinas', building: 'Edificio histórico', church: 'Iglesia histórica' };
const lugares = {};
const cuenta = { articuloWikidata: 0, articuloCercano: 0, articuloParcial: 0, nombre: 0, patrimonio: 0, placa: 0, artista: 0, anio: 0, descripcion: 0 };
for (const l of dex) {
  const t = etiquetas.get(l.id) || {};
  const c = {};
  if (!l.wikipedia) {
    // El artículo de Wikidata vale solo si tiene ubicación y queda cerca: en OSM a veces se pone en `wikidata` a la
    // persona del nombre (por ejemplo, el hijo de Martin Luther King en su plaza), y las personas no tienen ubicación.
    const articulo = entidades.get(t.wikidata)?.articulo;
    const conUbicacion = articulo && porTitulo.get(articulo);
    if (conUbicacion && distancia(l.punto, [conUbicacion.lat, conUbicacion.lon]) <= 1000) {
      c.w = `es:${articulo}`;
      cuenta.articuloWikidata++;
    } else {
      // Mismo nombre y a menos de 150 m (o dentro del parque, si es grande).
      const radio = Math.max(150, Math.min(400, (l.tamano || 0) / 2 + 120));
      const a = (porNombre.get(normalizar(l.nombre)) || []).find((x) => distancia(l.punto, [x.lat, x.lon]) <= radio);
      if (a) {
        c.w = `es:${a.title}`;
        cuenta.articuloCercano++;
      } else {
        // Si no hay uno con el mismo nombre, el más cercano (a menos de 200 m) que calce en parte.
        const parcial = [...unicos.values()]
          .map((x) => ({ x, d: distancia(l.punto, [x.lat, x.lon]) }))
          .filter(({ x, d }) => d <= 200 && calzaParcial(l.nombre, x.title, COMUNAS))
          .sort((p, q) => p.d - q.d)[0];
        if (parcial) {
          c.w = `es:${parcial.x.title}`;
          cuenta.articuloParcial++;
        }
      }
    }
  }
  const personas = (t['name:etymology:wikidata'] || '')
    .split(';')
    .map((q) => entidades.get(q.trim()))
    .filter((e) => e?.nombre);
  if (personas.length) {
    c.e = personas.map((e) => [e.nombre, e.descripcion, e.articulo ? `es:${e.articulo}` : null]);
    cuenta.nombre++;
  }
  if (t.heritage) {
    c.h = [t.heritage, t['heritage:operator'] || null];
    cuenta.patrimonio++;
  }
  if (t.inscription) {
    c.i = recortar(t.inscription);
    cuenta.placa++;
  }
  if (t.artist_name) {
    c.a = recortar(t.artist_name, 120);
    cuenta.artista++;
  }
  if (t.architect) c.q = recortar(t.architect, 120);
  // El año solo en obras y monumentos: en plazas, parques o museos suele ser el de una remodelación o la apertura.
  if (['arte', 'historia'].includes(l.tipo) && /^\d{4}/.test(t.start_date || '')) {
    c.y = t.start_date.slice(0, 4);
    cuenta.anio++;
  }
  if (t.description) {
    c.d = recortar(t.description);
    cuenta.descripcion++;
  }
  if (PATRIMONIO[t.historic]) c.t = PATRIMONIO[t.historic];
  if (Object.keys(c).length) lugares[l.id] = c;
}

// Para revisar a mano: lugares sin artículo con uno cerca cuyo nombre contiene el del lugar o al revés (no se agregan).
const casi = [];
for (const l of dex) {
  if (l.wikipedia || lugares[l.id]?.w) continue;
  const n = normalizar(l.nombre);
  for (const a of unicos.values()) {
    if (a.ns !== 0 || distancia(l.punto, [a.lat, a.lon]) > 200) continue;
    const t = normalizar(a.title);
    if (n.length > 5 && t.length > 5 && (t.includes(n) || n.includes(t))) casi.push(`${l.nombre} ~ ${a.title}`);
  }
}
if (process.argv.includes('--casi')) console.log(`\nCasi calzan (${casi.length}):\n  ${casi.slice(0, 60).join('\n  ')}`);

// Fuera los artículos que son redirecciones a otra página (por ejemplo, un monumento que redirige a su plaza): la
// historia sería la de otro lugar.
const nuevos = [...new Set(Object.values(lugares).filter((c) => c.w).map((c) => c.w.slice(3)))];
const redirecciones = new Set();
for (let i = 0; i < nuevos.length; i += 50) {
  const r = await wikimedia('es.wikipedia.org', { action: 'query', titles: nuevos.slice(i, i + 50).join('|'), prop: 'info' });
  for (const pagina of Object.values(r.query?.pages || {})) if ('redirect' in pagina || 'missing' in pagina) redirecciones.add(pagina.title);
}
for (const [id, c] of Object.entries(lugares)) {
  if (!c.w || !redirecciones.has(c.w.slice(3))) continue;
  delete c.w;
  if (!Object.keys(c).length) delete lugares[id];
}
console.log(`Wikipedia: ${redirecciones.size} artículos descartados por ser redirecciones.`);

const conHistoria = dex.filter((l) => l.wikipedia || lugares[l.id]?.w).length;
console.log('\nLo que se gana:');
console.log(`  Historia de Wikipedia: ${dex.filter((l) => l.wikipedia).length} → ${conHistoria} lugares`);
console.log(`    por el enlace de Wikidata: ${cuenta.articuloWikidata}; mismo nombre y cerca: ${cuenta.articuloCercano}; nombre parecido y cerca: ${cuenta.articuloParcial}`);
console.log(`  "Lleva el nombre de…": ${cuenta.nombre}`);
console.log(`  Patrimonio: ${cuenta.patrimonio} · Placa: ${cuenta.placa} · Artista: ${cuenta.artista} · Año: ${cuenta.anio} · Descripción: ${cuenta.descripcion}`);
console.log(`  Con algo de contexto extra: ${Object.keys(lugares).length} de ${dex.length}`);
const valores = (k) => [...etiquetas.values()].map((t) => t[k]).filter(Boolean);
console.log(`  Valores de heritage: ${JSON.stringify(Object.entries(valores('heritage').reduce((m, v) => ({ ...m, [v]: (m[v] || 0) + 1 }), {})))}`);
console.log(`  Valores de heritage:operator: ${JSON.stringify(Object.entries(valores('heritage:operator').reduce((m, v) => ({ ...m, [v]: (m[v] || 0) + 1 }), {})))}`);

await writeFile(
  new URL('../datos/contexto.json', import.meta.url),
  JSON.stringify({
    generado: new Date().toISOString().slice(0, 10),
    fuente: 'OpenStreetMap (© colaboradores de OpenStreetMap, ODbL), Wikidata (CC0) y Wikipedia',
    campos: { w: 'artículo de Wikipedia', e: 'a quién homenajea el nombre: [nombre, descripción, artículo]', h: '[heritage, operador]', i: 'placa', a: 'artista', q: 'arquitecto', y: 'año de la obra', d: 'descripción', t: 'tipo histórico' },
    lugares,
  }),
);
console.log('\nGuardado datos/contexto.json');
