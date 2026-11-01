// Genera datos/contexto.json: lo que se sabe de cada lugar de la Santiagodex, solo de fuentes verificables.
//   - De OpenStreetMap (consulta a Overpass): si es patrimonio, el texto de su placa, el artista, el año, su
//     descripción, a quién homenajea su nombre (name:etymology:wikidata), su horario, cómo se llamaba antes, qué tipo
//     de obra es y de qué material, la altura de los cerros y la foto de Commons que tenga enlazada.
//   - De Wikidata: el artículo de Wikipedia en español de los lugares que traen `wikidata` pero no `wikipedia`, y quién
//     es la persona del nombre (nombre y descripción corta).
//   - De Wikipedia: artículos con ubicación cerca del lugar y con el mismo nombre (búsqueda por zona), y si el nombre
//     (sin "Plaza", "Parque", "Monumento a"…) coincide con el de una persona que tiene artículo ("¿Por qué se llama
//     así?": se muestra como coincidencia, nunca como afirmación).
//   - De Wikimedia Commons: una foto con ubicación cerca del lugar cuyo nombre de archivo lo nombra completo, para los
//     lugares sin artículo (y por eso sin foto).
// No se adivina nada: si el nombre no calza exacto o el mapa no dice a quién homenajea, no se agrega.
// Se corre a mano después de regenerar plazas y lugares:  node scripts/contexto.mjs   (tarda unos 15 minutos)

import { writeFile } from 'node:fs/promises';
import { distancia } from '../js/geo.js';
import { overpass, wikimedia, normalizar, leerDatos, santiagodex, avance } from './comun.mjs';

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
const dex = await santiagodex();
const COMUNAS = new Set((await leerDatos('comunas')).comunas.map((c) => normalizar(c.nombre)));
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
const cuenta = { articuloWikidata: 0, articuloCercano: 0, articuloParcial: 0, nombre: 0, patrimonio: 0, placa: 0, artista: 0, anio: 0, descripcion: 0, horario: 0, antes: 0 };
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
  if (t.opening_hours) {
    c.o = recortar(t.opening_hours, 120);
    cuenta.horario++;
  }
  if (t.old_name) {
    c.v = recortar(t.old_name, 80);
    cuenta.antes++;
  }
  if (t.alt_name && normalizar(t.alt_name) !== normalizar(l.nombre)) c.x = recortar(t.alt_name, 80);
  if (t.artwork_type || (t.material && l.tipo === 'arte')) c.k = [t.artwork_type || null, t.material || null];
  if (l.tipo === 'cerro' && /^\d+(\.\d+)?$/.test(t.ele || '')) c.z = Math.round(Number(t.ele));
  if (/^File:/i.test(t.wikimedia_commons || '')) c.f = t.wikimedia_commons;
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
const ficha = (id) => (lugares[id] ||= {});

// --- 6. "¿Por qué se llama así?": el nombre sin "Plaza", "Parque", "Monumento a"… coincide con una persona que tiene
// artículo en Wikipedia (según Wikidata, "instancia de: ser humano"). Solo nombres de dos palabras o más y sin páginas
// de desambiguación: con una sola palabra ("Plaza Ercilla", "Plaza Bulnes") hay demasiados homónimos.
const PREFIJO =
  /^(plaza|plazoleta|plazuela|parque|[áa]rea verde|bandej[óo]n|paseo|jard[íi]n|mirador|monumento|busto|estatua|homenaje|memorial|anfiteatro)( (a|al|de|del|en honor a))?( (la|los|las|el))? /i;
const restoDelNombre = (nombre) => nombre.replace(PREFIJO, '').trim();
const posibles = dex.filter((l) => !lugares[l.id]?.e && restoDelNombre(l.nombre).split(/\s+/).length >= 2);
const titulos = [...new Set(posibles.map((l) => restoDelNombre(l.nombre)))];
const paginaDe = new Map();
for (let i = 0; i < titulos.length; i += 50) {
  const grupo = titulos.slice(i, i + 50);
  const r = await wikimedia('es.wikipedia.org', { action: 'query', redirects: 1, prop: 'pageprops', ppprop: 'wikibase_item|disambiguation', titles: grupo.join('|') });
  const cambio = new Map([...(r.query?.normalized || []), ...(r.query?.redirects || [])].map((x) => [x.from, x.to]));
  const porTituloFinal = new Map(Object.values(r.query?.pages || {}).map((p) => [p.title, p]));
  for (const original of grupo) {
    let t = original;
    for (let k = 0; k < 3 && cambio.has(t); k++) t = cambio.get(t);
    const p = porTituloFinal.get(t);
    if (p && !('missing' in p) && p.pageprops?.wikibase_item && !('disambiguation' in p.pageprops)) paginaDe.set(original, { titulo: p.title, q: p.pageprops.wikibase_item });
  }
}
// Además, la persona tiene que ser chilena (Wikidata, "país de nacionalidad": Chile) o muy conocida (artículo en 15 o
// más Wikipedias): así entra José Martí o Conan Doyle, pero no un futbolista extranjero que se llama igual que un
// vecino ilustre de la comuna.
const CHILE = 'Q298';
const personas = new Map();
const listaP = [...new Set([...paginaDe.values()].map((p) => p.q))];
for (let i = 0; i < listaP.length; i += 50) {
  const r = await wikimedia('www.wikidata.org', { action: 'wbgetentities', ids: listaP.slice(i, i + 50).join('|'), props: 'claims|descriptions|sitelinks', languages: 'es' });
  for (const [q, e] of Object.entries(r.entities || {})) {
    const valores = (p) => (e.claims?.[p] || []).map((c) => c.mainsnak?.datavalue?.value?.id);
    const chilena = valores('P27').includes(CHILE);
    const conocida = Object.keys(e.sitelinks || {}).filter((s) => /wiki$/.test(s) && !/^commons|wikidata|species/.test(s)).length >= 15;
    if (valores('P31').includes('Q5') && (chilena || conocida)) personas.set(q, e.descriptions?.es?.value || null);
  }
}
for (const l of posibles) {
  const p = paginaDe.get(restoDelNombre(l.nombre));
  if (!p || !personas.has(p.q)) continue;
  ficha(l.id).p = [p.titulo, personas.get(p.q)];
  cuenta.persona = (cuenta.persona || 0) + 1;
}
console.log(`Wikipedia: ${cuenta.persona || 0} lugares cuyo nombre coincide con una persona.`);

// --- 7. Foto de Commons para los lugares sin artículo: la que el mapa tenga enlazada o una con ubicación cerca cuyo
// nombre de archivo nombra el lugar completo (por ejemplo "Plaza Pedro Montt 2.jpg").
const sinFoto = dex.filter((l) => !l.wikipedia && !lugares[l.id]?.w && l.nombre.split(/\s+/).length >= 2);
// Se piden todas las fotos con ubicación de la zona por cuadros (como los artículos del paso 4: a lo más 500 por
// cuadro, y los llenos se parten en cuatro) y se cruzan acá: es mucho menos que preguntar lugar por lugar. Commons a
// veces responde lento: cada cuadro queda guardado en scripts/.cache/ y, si se corta, al correrlo de nuevo sigue.
// Fuera lo que no es una foto del lugar: documentos, audio, y letreros, paraderos, mapas o escudos que lo nombran.
const NO_FOTO = /\.(pdf|djvu|ogg|oga|ogv|webm|mp3|wav|mid|stl)$|paradero|letrero|se[ñn]al|cartel|mapa|plano|escudo|logo/i;
const cajas = await avance('commons-cajas');
const fotos = [];
async function fotosEn(n, o, s, e) {
  const clave = [n, o, s, e].map((x) => x.toFixed(5)).join(',');
  if (!cajas.tiene(clave)) {
    const r = await wikimedia('commons.wikimedia.org', { action: 'query', list: 'geosearch', gsbbox: `${n}|${o}|${s}|${e}`, gsnamespace: 6, gslimit: 500 });
    await cajas.poner(clave, (r.query?.geosearch || []).map((a) => [a.title, a.lat, a.lon]));
    if (Object.keys(cajas.datos).length % 25 === 0) console.log(`  Commons: ${Object.keys(cajas.datos).length} cuadros…`);
  }
  const lista = cajas.datos[clave];
  if (lista.length >= 500 && n - s > 0.001) {
    const [mlat, mlon] = [(n + s) / 2, (o + e) / 2];
    for (const [a, b, c, d] of [[n, o, mlat, mlon], [n, mlon, mlat, e], [mlat, o, s, mlon], [mlat, mlon, s, e]]) await fotosEn(a, b, c, d);
    return;
  }
  fotos.push(...lista);
}
const PASO_FOTOS = 0.05;
for (let n = norte; n > sur; n -= PASO_FOTOS) for (let o = oeste; o < este; o += PASO_FOTOS) await fotosEn(n, o, Math.max(sur, n - PASO_FOTOS), Math.min(este, o + PASO_FOTOS));
await cajas.guardar();
console.log(`Commons: ${fotos.length} fotos con ubicación en la zona.`);
for (const l of sinFoto) {
  if (lugares[l.id]?.f) continue;
  const radio = Math.min(300, Math.max(60, (l.tamano || 0) / 2 + 30));
  const nombre = ` ${normalizar(l.nombre)} `;
  const archivo = fotos.find(
    ([titulo, lat, lon]) =>
      Math.abs(lat - l.punto[0]) < 0.003 &&
      !NO_FOTO.test(titulo) &&
      ` ${normalizar(titulo.replace(/^File:|\.\w+$/g, ''))} `.includes(nombre) &&
      distancia(l.punto, [lat, lon]) <= radio,
  );
  if (archivo) ficha(l.id).f = archivo[0];
}
// El archivo se guarda como la dirección de su miniatura de 800 px (la misma forma que las fotos de Wikipedia, así la
// app saca el autor y la licencia igual).
const archivos = [...new Set(Object.values(lugares).map((c) => c.f).filter(Boolean))];
const miniatura = new Map();
for (let i = 0; i < archivos.length; i += 50) {
  const r = await wikimedia('commons.wikimedia.org', { action: 'query', prop: 'imageinfo', iiprop: 'url|mime', iiurlwidth: 800, titles: archivos.slice(i, i + 50).join('|') });
  const cambio = new Map((r.query?.normalized || []).map((x) => [x.to, x.from]));
  for (const p of Object.values(r.query?.pages || {})) {
    const info = p.imageinfo?.[0];
    // Sin lo que va después del "?" (Commons agrega datos de seguimiento que no hacen falta).
    if (info && /^image\//.test(info.mime)) miniatura.set(cambio.get(p.title) || p.title, (info.thumburl || info.url).split('?')[0]);
  }
}
for (const [id, c] of Object.entries(lugares)) {
  if (!c.f) continue;
  if (miniatura.has(c.f)) {
    c.f = miniatura.get(c.f);
    cuenta.foto = (cuenta.foto || 0) + 1;
  } else delete c.f;
  if (!Object.keys(c).length) delete lugares[id];
}
console.log(`Commons: ${cuenta.foto || 0} fotos para lugares sin artículo.`);

const conHistoria = dex.filter((l) => l.wikipedia || lugares[l.id]?.w).length;
console.log('\nLo que se gana:');
console.log(`  Historia de Wikipedia: ${dex.filter((l) => l.wikipedia).length} → ${conHistoria} lugares`);
console.log(`    por el enlace de Wikidata: ${cuenta.articuloWikidata}; mismo nombre y cerca: ${cuenta.articuloCercano}; nombre parecido y cerca: ${cuenta.articuloParcial}`);
console.log(`  "Lleva el nombre de…": ${cuenta.nombre}`);
console.log(`  Patrimonio: ${cuenta.patrimonio} · Placa: ${cuenta.placa} · Artista: ${cuenta.artista} · Año: ${cuenta.anio} · Descripción: ${cuenta.descripcion}`);
console.log(`  Horario: ${cuenta.horario} · Nombre antiguo: ${cuenta.antes} · "¿Por qué se llama así?": ${cuenta.persona || 0} · Foto de Commons: ${cuenta.foto || 0}`);
console.log(`  Con algo de contexto extra: ${Object.keys(lugares).length} de ${dex.length}`);
const valores = (k) => [...etiquetas.values()].map((t) => t[k]).filter(Boolean);
console.log(`  Valores de heritage: ${JSON.stringify(Object.entries(valores('heritage').reduce((m, v) => ({ ...m, [v]: (m[v] || 0) + 1 }), {})))}`);
console.log(`  Valores de heritage:operator: ${JSON.stringify(Object.entries(valores('heritage:operator').reduce((m, v) => ({ ...m, [v]: (m[v] || 0) + 1 }), {})))}`);

await writeFile(
  new URL('../datos/contexto.json', import.meta.url),
  JSON.stringify({
    generado: new Date().toISOString().slice(0, 10),
    fuente: 'OpenStreetMap (© colaboradores de OpenStreetMap, ODbL), Wikidata (CC0), Wikipedia y Wikimedia Commons',
    campos: {
      w: 'artículo de Wikipedia',
      e: 'a quién homenajea el nombre: [nombre, descripción, artículo]',
      h: '[heritage, operador]',
      i: 'placa',
      a: 'artista',
      q: 'arquitecto',
      y: 'año de la obra',
      d: 'descripción',
      t: 'tipo histórico',
      o: 'horario (formato de OSM)',
      v: 'nombre antiguo',
      x: 'otro nombre',
      k: '[tipo de obra, material] (valores de OSM)',
      z: 'altura de la cumbre (cerros)',
      p: 'su nombre coincide con: [artículo de la persona, descripción]',
      f: 'foto de Commons (miniatura de 800 px)',
    },
    lugares,
  }),
);
console.log('\nGuardado datos/contexto.json');
