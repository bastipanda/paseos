// Arma opciones de paseo que cumplan la duración pedida y las ordena según lo que pidió Bastián.
//
// BRouter no recibe un "largo objetivo", así que se agregan puntos intermedios para alargar la ruta:
// - Circular (partida = término): un triángulo con dos puntos intermedios en distintas direcciones.
// - Partida ≠ término: un punto intermedio sobre una elipse cuyos focos son la partida y el término.
// Con "Pasar por…", cada punto intermedio se mueve al lugar real más cercano del tipo elegido (plaza, lugar
// interesante o cuadra con comercio). Se prueban varias direcciones, se corrige el tamaño de las que quedaron
// cortas o largas y se eligen las mejores.
//
// `prefs` reúne lo que eligió el usuario:
//   { estilo, evitarSubidas, pasarPor: { plazas, interes, comercio }, datos: { plazas, interes, comercio },
//     conocidas }   (conocidas: celdas ya exploradas, solo si el modo explorar está activo)

import { distancia, destino, rumbo, puntoEnElipse, fraccionRepetida, parecido } from './geo.js';
import { objetivo, cumple, desvio, restar, formatearDistancia } from './duracion.js';
import { pedirRuta, quitarEspolones, ErrorDeRuta } from './brouter.js';
import { evaluar, combinar, ESTILOS } from './tranquilidad.js';
import { lugaresEnRuta } from './plazas.js';
import { comercioEnRuta, puntosDeComercio } from './comercio.js';
import { novedad } from './explorar.js';

export const PERFIL_BICI = 'bici-amigable';
export const PERFIL_CORTO = 'paseo-corto';

// Una ruta por calles suele medir ~30 % más que la línea recta entre sus puntos.
const DESVIO_CALLES = 1.3;
// Bajo esta distancia, partida y término se consideran el mismo punto (paseo circular).
const UMBRAL_CIRCULAR = 80;
// Castigo a las rutas que van y vuelven por la misma calle.
const CASTIGO_REPETIR = 60;
const MAX_OPCIONES = 5;

export const PREFS_POR_DEFECTO = {
  estilo: 'tranquilo',
  evitarSubidas: false,
  pasarPor: { plazas: false, interes: false, comercio: false },
  datos: { plazas: [], interes: [], comercio: null },
  conocidas: null,
};

const perfilPie = (prefs) => (ESTILOS[prefs.estilo] || ESTILOS.tranquilo).perfil;

export function esCircular(inicio, fin) {
  return distancia(inicio, fin) < UMBRAL_CIRCULAR;
}

export function puntosIntermedios(inicio, fin, largoBuscado, angulo) {
  const sumaRecta = largoBuscado / DESVIO_CALLES;
  if (esCircular(inicio, fin)) {
    const lado = sumaRecta / 3;
    return [destino(inicio, angulo - 30, lado), destino(inicio, angulo + 30, lado)];
  }
  return [puntoEnElipse(inicio, fin, sumaRecta, angulo)];
}

// Lugares reales hacia los que se puede mover un punto intermedio, según "Pasar por…".
function destinosReales(prefs) {
  if (prefs._destinos) return prefs._destinos;
  const { pasarPor = {}, datos = {} } = prefs;
  const lista = [];
  if (pasarPor.interes) for (const l of datos.interes || []) lista.push({ punto: l.punto, peso: 1.0 });
  if (pasarPor.plazas) for (const l of datos.plazas || []) if (l.nombre) lista.push({ punto: l.punto, peso: 0.8 });
  if (pasarPor.comercio && datos.comercio) {
    for (const c of puntosDeComercio(datos.comercio)) lista.push({ punto: c.punto, peso: Math.min(1, c.locales / 10) });
  }
  prefs._destinos = lista;
  return lista;
}

// Mueve un punto intermedio al mejor lugar real cercano (o lo deja igual si no hay ninguno a menos de `radio`).
export function ajustarPunto(punto, destinos, radio, usados = new Set()) {
  let mejor = null;
  for (const d of destinos) {
    if (usados.has(d)) continue;
    const dist = distancia(punto, d.punto);
    if (dist > radio) continue;
    const nota = dist / radio - d.peso;
    if (!mejor || nota < mejor.nota) mejor = { d, nota };
  }
  if (!mejor) return punto;
  usados.add(mejor.d);
  return mejor.d.punto;
}

function intermediosReales(inicio, fin, largoBuscado, angulo, prefs) {
  const vias = puntosIntermedios(inicio, fin, largoBuscado, angulo);
  const destinos = destinosReales(prefs);
  if (!destinos.length) return vias;
  const radio = Math.min(450, Math.max(150, largoBuscado / 12));
  const usados = new Set();
  return vias.map((v) => ajustarPunto(v, destinos, radio, usados));
}

// Pide una ruta y devuelve null si BRouter no encontró camino (por ejemplo, un punto cayó en un cerro).
// La ruta guarda con qué se pidió (`peticion`), para poder pedir la misma otra vez (rutas favoritas).
async function intentar(puntos, perfil, avance, { alternativa = 0, evitarSubidas = false } = {}) {
  try {
    const ruta = quitarEspolones(await pedirRuta(puntos, perfil, { alternativa, evitarSubidas }));
    return { ...ruta, peticion: { puntos, perfil, alternativa, evitarSubidas } };
  } catch (e) {
    if (e instanceof ErrorDeRuta) return null;
    throw e;
  } finally {
    avance();
  }
}

// Datos extra de una ruta a pie: lugares por los que pasa, comercio cercano, iluminación y qué tan nueva es.
export function extrasDeRuta(ruta, prefs) {
  const { datos = {} } = prefs;
  const interes = lugaresEnRuta(ruta.coords, datos.interes || []);
  const plazas = lugaresEnRuta(ruta.coords, datos.plazas || []).filter((l) => l.nombre);
  const comercio = datos.comercio ? comercioEnRuta(ruta.coords, datos.comercio) : 0;
  const total = ruta.tramos.reduce((s, t) => s + t.metros, 0);
  const iluminada = total ? ruta.tramos.filter((t) => t.tags.lit === 'yes').reduce((s, t) => s + t.metros, 0) / total : 0;
  const nueva = prefs.conocidas ? novedad(ruta.coords, prefs.conocidas) : null;
  const servicios = lugaresEnRuta(ruta.coords, datos.servicios || [], 60);
  return { interes, plazas, comercio, iluminada, novedad: nueva, servicios };
}

// Nota para ordenar opciones: qué tan buenas son las calles para el estilo, menos lo repetido, más lo pedido.
function notaDe(evaluacion, repetida, extras, prefs, ruta) {
  const { pasarPor = {}, estilo } = prefs;
  let nota = evaluacion.puntaje - repetida * CASTIGO_REPETIR;
  // Con "evitar subidas", cada 4 m de subida restan un punto (una ruta que sube 100 m pierde 25).
  if (prefs.evitarSubidas) nota -= (ruta?.subida || 0) / 4;
  if (pasarPor.interes) nota += 6 * Math.min(extras.interes.length, 4);
  if (pasarPor.plazas) nota += 4 * Math.min(extras.plazas.length, 4);
  if (pasarPor.comercio || estilo === 'vida') nota += Math.min(20, extras.comercio / 5);
  if (extras.novedad !== null) nota += 40 * extras.novedad;
  return nota;
}

// Rutas a pie entre `inicio` y `fin` cuyo largo cae en `rango` (metros). Devuelve candidatas evaluadas.
// `variedad` permite una tercera vuelta de consultas para tener más opciones distintas.
export async function caminatas({ inicio, fin, rango, avance = () => {}, maxConsultas = 10, variedad = true, prefs = PREFS_POR_DEFECTO }) {
  const meta = objetivo(rango);
  const recta = distancia(inicio, fin);
  const circular = esCircular(inicio, fin);
  const perfil = perfilPie(prefs);
  const subidas = { evitarSubidas: prefs.evitarSubidas };
  const resultados = [];

  if (!circular) {
    if (rango.max !== null && recta > rango.max) {
      throw new ErrorDeRuta(
        `El término está a ${formatearDistancia(recta)} en línea recta: más que el máximo pedido.`,
      );
    }
    const pasarPorAlgo = Object.values(prefs.pasarPor || {}).some(Boolean);
    if (meta <= recta * 1.35 && !pasarPorAlgo) {
      const directa = await intentar([inicio, fin], perfil, avance, subidas);
      if (directa) resultados.push({ ruta: directa, angulo: null, largoBuscado: meta });
      const alcanza = directa && (cumple(directa.metros, rango) || (rango.max !== null && directa.metros > rango.max));
      if (alcanza && variedad && cumple(directa.metros, rango)) {
        // La ruta directa ya sirve: se piden las alternativas de BRouter para tener para elegir.
        const otras = await Promise.all(
          [1, 2, 3].map((alt) => intentar([inicio, fin], perfil, avance, { ...subidas, alternativa: alt })),
        );
        for (const ruta of otras.filter(Boolean)) resultados.push({ ruta, angulo: null, largoBuscado: meta });
      }
      if (alcanza || !directa) return evaluarCandidatas(resultados, rango, prefs);
    }
  }

  const angulos = circular ? [0, 60, 120, 180, 240, 300] : [90, 270, 60, 120, 240, 300];
  const pedir = async (angulo, largoBuscado) => {
    const vias = intermediosReales(inicio, fin, largoBuscado, angulo, prefs);
    const ruta = await intentar([inicio, ...vias, fin], perfil, avance, subidas);
    return ruta ? { ruta, angulo, largoBuscado } : null;
  };

  const primera = (await Promise.all(angulos.map((a) => pedir(a, meta)))).filter(Boolean);
  resultados.push(...primera);

  // Segunda vuelta: se agranda o achica el triángulo/elipse de las que no cumplieron.
  const disponibles = Math.max(0, maxConsultas - angulos.length);
  const corregir = primera
    .filter((r) => !cumple(r.ruta.metros, rango))
    .sort((a, b) => desvio(a.ruta.metros, rango) - desvio(b.ruta.metros, rango))
    .slice(0, disponibles);
  const segunda = await Promise.all(corregir.map((r) => pedir(r.angulo, (r.largoBuscado * meta) / r.ruta.metros)));
  resultados.push(...segunda.filter(Boolean));

  // Tercera vuelta, solo si hay pocas opciones distintas: otras direcciones, ya con el tamaño corregido
  // según cuánto se alargaron las rutas anteriores respecto de lo buscado.
  let candidatas = evaluarCandidatas(resultados, rango, prefs);
  if (variedad && candidatas.filter((c) => c.enRango).length < 3 && primera.length) {
    const razones = primera.map((r) => r.ruta.metros / r.largoBuscado).sort((a, b) => a - b);
    const mediana = razones[Math.floor(razones.length / 2)];
    const extra = circular ? [30, 90, 150, 210, 270, 330] : [30, 150, 210, 330];
    const tercera = await Promise.all(extra.slice(0, 4).map((a) => pedir(a, meta / mediana)));
    resultados.push(...tercera.filter(Boolean));
    candidatas = evaluarCandidatas(resultados, rango, prefs);
  }
  return candidatas;
}

function evaluarCandidatas(resultados, rango, prefs) {
  const evaluadas = resultados.map(({ ruta }) => {
    const evaluacion = evaluar(ruta.tramos, 'pie', prefs.estilo);
    const repetida = fraccionRepetida(ruta.coords);
    const extras = extrasDeRuta(ruta, prefs);
    return {
      ruta,
      evaluacion,
      repetida,
      extras,
      nota: notaDe(evaluacion, repetida, extras, prefs, ruta),
      enRango: cumple(ruta.metros, rango),
      desvio: desvio(ruta.metros, rango),
    };
  });
  const enRango = evaluadas.filter((e) => e.enRango).sort((a, b) => b.nota - a.nota);
  const lista = enRango.length ? enRango : evaluadas.sort((a, b) => a.desvio - b.desvio);
  return sinRepetidas(lista, (e) => e.ruta.coords);
}

// Quita opciones casi iguales (comparten más del 70 % de las cuadras), dejando la mejor.
function sinRepetidas(lista, coordsDe) {
  const unicas = [];
  for (const e of lista) {
    if (!unicas.some((u) => parecido(coordsDe(u), coordsDe(e)) > 0.7)) unicas.push(e);
  }
  return unicas;
}

// Opciones solo a pie, listas para mostrar.
export async function paseosAPie({ inicio, fin, rango, avance, prefs = PREFS_POR_DEFECTO }) {
  const candidatas = await caminatas({ inicio, fin, rango, avance, prefs });
  return candidatas.slice(0, MAX_OPCIONES).map((c) => ({
    partes: [{ modo: 'pie', ruta: c.ruta, evaluacion: c.evaluacion }],
    metrosPie: c.ruta.metros,
    metrosBici: 0,
    evaluacionPie: c.evaluacion,
    evaluacionBici: null,
    enRango: c.enRango,
    repetida: c.repetida,
    extras: c.extras,
    estilo: prefs.estilo,
  }));
}

// Opciones de ir a una plaza (o parque, o plaza de juegos) y volver al punto de partida, con la duración pedida
// para la ida y la vuelta juntas. La vuelta se fuerza por otras calles con un punto intermedio a un costado.
export async function paseosAPlaza({ inicio, rango, plazas, avance = () => {}, prefs = PREFS_POR_DEFECTO }) {
  const meta = objetivo(rango);
  const maxTotal = rango.max ?? meta * 1.5;
  const perfil = perfilPie(prefs);
  const subidas = { evitarSubidas: prefs.evitarSubidas };
  // Ida ≈ distancia × 1,3 y la vuelta algo más larga, por otras calles.
  const ideal = meta / (2 * DESVIO_CALLES * 1.1);
  const minimo = Math.max(150, meta / 4.5);
  const maximo = maxTotal / (2 * 1.15);

  // Una plaza por dirección (seis sectores), prefiriendo las que tienen nombre, son grandes, están a la distancia
  // justa y, en modo explorar, las que quedan en zonas nuevas.
  const porSector = new Map();
  for (const plaza of plazas) {
    const d = distancia(inicio, plaza.punto);
    if (d < minimo || d > maximo) continue;
    const sector = Math.floor(rumbo(inicio, plaza.punto) / 60);
    let nota = Math.abs(d - ideal) / ideal - (plaza.nombre ? 0.35 : 0) - (Math.min(plaza.tamano, 400) / 400) * 0.3;
    if (prefs.conocidas) nota -= 0.4 * novedad([plaza.punto], prefs.conocidas);
    if (!porSector.has(sector) || nota < porSector.get(sector).nota) porSector.set(sector, { plaza, d, nota });
  }
  const elegidas = [...porSector.values()].sort((a, b) => a.nota - b.nota).slice(0, 4);
  if (!elegidas.length) throw new ErrorDeRuta('No encontré plazas a una distancia que calce con la duración pedida.');

  const pedir = async (plaza, angulo, sumaVuelta) => {
    const lado = puntoEnElipse(plaza.punto, inicio, sumaVuelta, angulo);
    const ruta = await intentar([inicio, plaza.punto, lado, inicio], perfil, avance, subidas);
    return ruta ? { ruta, plaza, angulo, sumaVuelta } : null;
  };
  const sumaInicial = (d) => Math.max(d * 1.05, meta / DESVIO_CALLES - d);

  const primera = (
    await Promise.all(elegidas.flatMap((e) => [90, 270].map((a) => pedir(e.plaza, a, sumaInicial(e.d)))))
  ).filter(Boolean);
  const corregir = primera
    .filter((r) => !cumple(r.ruta.metros, rango))
    .sort((a, b) => desvio(a.ruta.metros, rango) - desvio(b.ruta.metros, rango))
    .slice(0, 3);
  const segunda = await Promise.all(
    corregir.map((r) => {
      const d = distancia(inicio, r.plaza.punto);
      return pedir(r.plaza, r.angulo, Math.max(d * 1.02, r.sumaVuelta + (meta - r.ruta.metros) / DESVIO_CALLES));
    }),
  );

  const evaluadas = [...primera, ...segunda.filter(Boolean)].map((r) => {
    const evaluacion = evaluar(r.ruta.tramos, 'pie', prefs.estilo);
    const repetida = fraccionRepetida(r.ruta.coords);
    const extras = extrasDeRuta(r.ruta, prefs);
    return {
      partes: [{ modo: 'pie', ruta: r.ruta, evaluacion }],
      metrosPie: r.ruta.metros,
      metrosBici: 0,
      evaluacionPie: evaluacion,
      evaluacionBici: null,
      enRango: cumple(r.ruta.metros, rango),
      repetida,
      extras,
      nota: notaDe(evaluacion, repetida, extras, prefs, r.ruta),
      plaza: r.plaza,
      estilo: prefs.estilo,
    };
  });
  evaluadas.sort((a, b) => Number(b.enRango) - Number(a.enRango) || b.nota - a.nota);
  // Una opción por plaza: las flechas del resultado sirven para "ver otra plaza".
  const vistas = new Set();
  return evaluadas.filter((o) => !vistas.has(o.plaza) && vistas.add(o.plaza)).slice(0, MAX_OPCIONES);
}

// Receta de una opción a pie: los puntos y el perfil con que se pidió cada parte. Sirve para guardarla como
// favorita y pedir la misma ruta otro día. Las opciones con Bike Itaú no se guardan: dependen de las bicis del momento.
export function recetaDe(opcion) {
  if (opcion.partes.some((p) => p.modo !== 'pie' || !p.ruta.peticion)) return null;
  const r5 = (x) => Math.round(x * 1e5) / 1e5;
  return {
    estilo: opcion.estilo,
    partes: opcion.partes.map((p) => ({
      ...p.ruta.peticion,
      puntos: p.ruta.peticion.puntos.map(([lat, lon]) => [r5(lat), r5(lon)]),
    })),
    plaza: opcion.plaza ? { punto: opcion.plaza.punto, nombre: opcion.plaza.nombre, tipo: opcion.plaza.tipo, tamano: opcion.plaza.tamano } : null,
    destino: opcion.destino || null,
  };
}

// Pide otra vez una ruta guardada con `recetaDe` y la deja lista para mostrar, como cualquier opción.
export async function rehacerOpcion(receta, prefs = PREFS_POR_DEFECTO) {
  const estilo = receta.estilo || prefs.estilo;
  const partes = [];
  for (const p of receta.partes) {
    const ruta = await intentar(p.puntos, p.perfil, () => {}, { alternativa: p.alternativa, evitarSubidas: p.evitarSubidas });
    if (!ruta) throw new ErrorDeRuta('No se pudo pedir otra vez la ruta guardada. Puede que el mapa haya cambiado.');
    partes.push({ modo: 'pie', ruta, evaluacion: evaluar(ruta.tramos, 'pie', estilo) });
  }
  const evaluacionPie = combinar(partes.map((p) => p.evaluacion));
  const coords = partes.flatMap((p) => p.ruta.coords);
  const unida = { coords, tramos: partes.flatMap((p) => p.ruta.tramos), metros: 0 };
  return {
    partes,
    metrosPie: partes.reduce((s, p) => s + p.ruta.metros, 0),
    metrosBici: 0,
    evaluacionPie,
    evaluacionBici: null,
    enRango: true,
    repetida: fraccionRepetida(coords),
    extras: extrasDeRuta(unida, { ...prefs, estilo }),
    plaza: receta.plaza,
    destino: receta.destino,
    estilo,
  };
}

// El camino más corto a pie entre dos puntos, evaluado con el mismo estilo que la opción (para comparar).
export async function caminoCorto(desde, hasta, estilo = 'tranquilo') {
  const ruta = await intentar([desde, hasta], PERFIL_CORTO, () => {});
  return ruta ? { metros: ruta.metros, evaluacion: evaluar(ruta.tramos, 'pie', estilo), coords: ruta.coords } : null;
}

// Opciones con ida a pie hasta una estación Bike Itaú, vuelta en bici hasta la estación con anclajes libres
// más cercana al término y un último tramo a pie. La duración pedida se aplica a lo caminado.
export async function paseosConBici({ inicio, fin, rango, estaciones, avance = () => {}, prefs = PREFS_POR_DEFECTO }) {
  const perfil = perfilPie(prefs);
  const subidas = { evitarSubidas: prefs.evitarSubidas };
  const llegadas = estaciones
    .filter((e) => e.recibe && e.anclajes > 0)
    .map((e) => ({ estacion: e, d: distancia(e.punto, fin) }))
    .sort((a, b) => a.d - b.d);
  if (!llegadas.length) throw new ErrorDeRuta('Ninguna estación tiene anclajes libres en este momento.');
  const llegada = llegadas[0];
  if (llegada.d > 2500) {
    throw new ErrorDeRuta(
      `La estación con anclajes libres más cercana al término está a ${formatearDistancia(llegada.d)}. ` +
        'Elige un término dentro de la zona de Bike Itaú.',
    );
  }

  const final = llegada.d < 30 ? null : await intentar([llegada.estacion.punto, fin], perfil, avance, subidas);
  const metrosFinal = final ? final.metros : 0;
  const rangoIda = restar(rango, metrosFinal);
  if (!rangoIda) {
    throw new ErrorDeRuta('Solo la caminata desde la estación de llegada hasta el término ya supera el máximo.');
  }
  const metaIda = objetivo(rangoIda);
  const maxIda = rangoIda.max ?? metaIda * 1.5;

  // Estaciones de salida con bicis, a una distancia que calce con la caminata pedida, en distintas
  // direcciones. Se descartan las muy cercanas a la llegada: no tendría sentido tomar la bici.
  const ideal = metaIda / DESVIO_CALLES;
  const porSector = new Map();
  for (const e of estaciones) {
    if (!e.operativa || e.bicis <= 0) continue;
    if (distancia(e.punto, llegada.estacion.punto) < 600) continue;
    const d = distancia(inicio, e.punto);
    if (d * 1.1 > maxIda) continue;
    const sector = Math.floor(rumbo(inicio, e.punto) / 90);
    const error = Math.abs(d - ideal);
    if (!porSector.has(sector) || error < porSector.get(sector).error) porSector.set(sector, { estacion: e, d, error });
  }
  const salidas = [...porSector.values()].sort((a, b) => a.error - b.error).slice(0, 3);
  if (!salidas.length) {
    throw new ErrorDeRuta('No hay estaciones con bicis a una distancia que calce con la caminata pedida.');
  }

  // Caminata hasta cada estación: directa si alcanza, alargada con puntos intermedios si queda corta.
  const idas = [];
  for (const s of salidas) {
    const corta = rangoIda.min !== null && s.d * DESVIO_CALLES < rangoIda.min * 0.9;
    if (corta) {
      const [mejor] = await caminatas({
        inicio,
        fin: s.estacion.punto,
        rango: rangoIda,
        avance,
        maxConsultas: 5,
        variedad: false,
        prefs,
      });
      if (mejor) idas.push({ salida: s.estacion, caminata: mejor });
    } else {
      const ruta = await intentar([inicio, s.estacion.punto], perfil, avance, subidas);
      const [mejor] = ruta ? evaluarCandidatas([{ ruta }], rangoIda, prefs) : [];
      if (mejor) idas.push({ salida: s.estacion, caminata: mejor });
    }
  }
  if (!idas.length) throw new ErrorDeRuta('No se encontró una caminata hasta las estaciones cercanas.');

  const opciones = [];
  for (const ida of idas) {
    const bici = await intentar([ida.salida.punto, llegada.estacion.punto], PERFIL_BICI, avance);
    if (!bici) continue;
    const evalBici = evaluar(bici.tramos, 'bici');
    const evalFinal = final ? evaluar(final.tramos, 'pie', prefs.estilo) : null;
    const evalPie = combinar([ida.caminata.evaluacion, evalFinal].filter(Boolean));
    const metrosPie = ida.caminata.ruta.metros + metrosFinal;
    const partes = [
      { modo: 'pie', ruta: ida.caminata.ruta, evaluacion: ida.caminata.evaluacion },
      { modo: 'bici', ruta: bici, evaluacion: evalBici },
    ];
    if (final) partes.push({ modo: 'pie', ruta: final, evaluacion: evalFinal });
    opciones.push({
      partes,
      metrosPie,
      metrosBici: bici.metros,
      evaluacionPie: evalPie,
      evaluacionBici: evalBici,
      enRango: cumple(metrosPie, rango),
      repetida: ida.caminata.repetida,
      extras: ida.caminata.extras,
      nota: (evalPie.puntaje + evalBici.puntaje) / 2 - ida.caminata.repetida * CASTIGO_REPETIR,
      estacionSalida: ida.salida,
      estacionLlegada: llegada.estacion,
      estilo: prefs.estilo,
    });
  }
  if (!opciones.length) throw new ErrorDeRuta('No se encontró una ruta en bici entre las estaciones.');
  opciones.sort((a, b) => Number(b.enRango) - Number(a.enRango) || b.nota - a.nota);
  return opciones.slice(0, MAX_OPCIONES);
}
