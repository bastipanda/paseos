// Pide rutas al servidor público de BRouter (brouter.de). No necesita clave.
// Sube los perfiles propios de la carpeta perfiles/ la primera vez que se usan.

const BASE = 'https://brouter.de/brouter';
const MAX_SIMULTANEAS = 2;

const idsDePerfil = new Map();
let activas = 0;
const enEspera = [];

// Limita las consultas simultáneas para no sobrecargar un servidor gratuito.
async function enTurno(tarea) {
  if (activas >= MAX_SIMULTANEAS) await new Promise((resolver) => enEspera.push(resolver));
  activas++;
  try {
    return await tarea();
  } finally {
    activas--;
    const siguiente = enEspera.shift();
    if (siguiente) siguiente();
  }
}

async function subirPerfil(nombre) {
  const texto = await (await fetch(new URL(`../perfiles/${nombre}.brf`, import.meta.url))).text();
  const resp = await fetch(`${BASE}/profile`, { method: 'POST', body: texto });
  const json = await resp.json();
  if (json.error) throw new Error(`BRouter rechazó el perfil ${nombre}: ${json.error}`);
  idsDePerfil.set(nombre, json.profileid);
  return json.profileid;
}

async function idDePerfil(nombre) {
  return idsDePerfil.get(nombre) || subirPerfil(nombre);
}

// `puntos` es una lista de [lat, lon]: partida, puntos intermedios y término.
// `alternativa` (0 a 3) pide a BRouter otra ruta distinta entre los mismos puntos.
export async function pedirRuta(puntos, perfil, alternativa = 0, intento = 1) {
  const id = await idDePerfil(perfil);
  const lonlats = puntos.map((p) => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join('|');
  // timode=2 hace que BRouter incluya los giros (voicehints) en la respuesta.
  const url = `${BASE}?lonlats=${lonlats}&profile=${id}&alternativeidx=${alternativa}&format=geojson&timode=2`;
  const resp = await enTurno(() => fetch(url));
  const texto = await resp.text();
  if (!resp.ok || !texto.trim().startsWith('{')) {
    // El servidor borra cada cierto tiempo los perfiles subidos: se vuelve a subir y se reintenta una vez.
    if (intento === 1 && /profile/i.test(texto)) {
      idsDePerfil.delete(perfil);
      return pedirRuta(puntos, perfil, alternativa, 2);
    }
    throw new ErrorDeRuta(traducirError(texto));
  }
  return leerRuta(JSON.parse(texto));
}

export class ErrorDeRuta extends Error {}

function traducirError(texto) {
  if (/not mapped|no.*datafile/i.test(texto)) return 'Uno de los puntos está fuera del mapa de rutas.';
  if (/island/i.test(texto)) return 'Uno de los puntos queda en un lugar sin calles conectadas.';
  if (/watchdog|timeout/i.test(texto)) return 'El servidor de rutas tardó demasiado.';
  return `El servidor de rutas respondió: ${texto.slice(0, 160)}`;
}

// Convierte la respuesta GeoJSON de BRouter en { coords, metros, tramos, giros }.
// Cada tramo es un pedazo de calle con sus etiquetas de OSM (highway, cycleway, etc.).
// Cada giro es un cruce donde hay que decidir hacia dónde seguir (`voicehints` de BRouter: el primer valor es el
// índice del punto en la ruta y el último, el ángulo del giro).
export function leerRuta(geojson) {
  const f = geojson.features[0];
  const coords = f.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  const metros = Number(f.properties['track-length']);
  const giros = (f.properties.voicehints || [])
    .map((v) => ({ indice: Number(v[0]), angulo: Number(v[v.length - 1]) }))
    .filter((g) => g.indice > 0 && g.indice < coords.length - 1);
  const tramos = [];
  const mensajes = f.properties.messages || [];
  if (mensajes.length > 1) {
    const cab = mensajes[0];
    const iLon = cab.indexOf('Longitude');
    const iLat = cab.indexOf('Latitude');
    const iDist = cab.indexOf('Distance');
    const iTags = cab.indexOf('WayTags');
    let indice = 0;
    for (const fila of mensajes.slice(1)) {
      const fin = [Number(fila[iLat]) / 1e6, Number(fila[iLon]) / 1e6];
      const desde = indice;
      indice = buscarIndice(coords, fin, indice);
      tramos.push({
        metros: Number(fila[iDist]),
        tags: leerTags(fila[iTags]),
        desde,
        hasta: indice,
      });
    }
  }
  return { coords, metros, tramos, giros };
}

// Recorta los "espolones": tramos donde la ruta entra a una calle y vuelve por el mismo camino, típicos cuando
// un punto intermedio cae en un pasaje sin salida. Si recortar dejara la ruta casi vacía (una ruta que es
// toda ida y vuelta), se deja como estaba.
export function quitarEspolones(ruta) {
  const { coords, tramos } = ruta;
  const igual = (a, b) => a[0] === b[0] && a[1] === b[1];
  const pila = [];
  for (let i = 0; i < coords.length; i++) {
    const n = pila.length;
    if (n >= 2 && igual(coords[pila[n - 2]], coords[i])) pila.pop();
    else if (n === 0 || !igual(coords[pila[n - 1]], coords[i])) pila.push(i);
  }
  if (pila.length === coords.length) return ruta;

  const nuevas = pila.map((i) => coords[i]);
  const largos = nuevas.map((p, k) => (k === 0 ? 0 : distanciaCorta(nuevas[k - 1], p)));
  const metros = largos.reduce((a, b) => a + b, 0);
  if (metros < ruta.metros * 0.4) return ruta;

  // Cada segmento nuevo pertenece al tramo original que contenía su punto final.
  const nuevosTramos = [];
  let t = 0;
  for (let k = 1; k < pila.length; k++) {
    while (t < tramos.length - 1 && pila[k] > tramos[t].hasta) t++;
    const ultimo = nuevosTramos[nuevosTramos.length - 1];
    if (ultimo && ultimo.origen === t) {
      ultimo.hasta = k;
      ultimo.metros += largos[k];
    } else {
      nuevosTramos.push({ origen: t, tags: tramos[t]?.tags || {}, desde: k - 1, hasta: k, metros: largos[k] });
    }
  }
  // Los giros que estaban dentro de un espolón desaparecen; el resto se reubica en la ruta recortada.
  const nuevoIndice = new Map(pila.map((original, k) => [original, k]));
  const giros = (ruta.giros || [])
    .filter((g) => nuevoIndice.has(g.indice))
    .map((g) => ({ ...g, indice: nuevoIndice.get(g.indice) }));
  return {
    coords: nuevas,
    metros,
    tramos: nuevosTramos.map(({ origen, ...resto }) => resto),
    giros,
  };
}

function distanciaCorta(a, b) {
  const k = Math.cos((a[0] * Math.PI) / 180);
  const dx = (b[1] - a[1]) * k;
  const dy = b[0] - a[0];
  return Math.sqrt(dx * dx + dy * dy) * 111195;
}

function leerTags(texto = '') {
  const tags = {};
  for (const par of texto.split(' ')) {
    const i = par.indexOf('=');
    if (i > 0) tags[par.slice(0, i)] = par.slice(i + 1);
  }
  return tags;
}

// Índice del punto de la ruta que coincide con el final de un tramo (busca hacia adelante).
function buscarIndice(coords, punto, desde) {
  let mejor = desde;
  let mejorDist = Infinity;
  for (let i = desde; i < coords.length; i++) {
    const d = Math.abs(coords[i][0] - punto[0]) + Math.abs(coords[i][1] - punto[1]);
    if (d < mejorDist) {
      mejorDist = d;
      mejor = i;
      if (d < 2e-6) break;
    }
  }
  return mejor;
}
