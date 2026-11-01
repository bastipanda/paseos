// Carga los archivos de datos/ (generados desde OpenStreetMap con scripts/) una sola vez por sesión.

import { leerPlazas, leerInteres, leerServicios, leerTramites, leerMetro } from './plazas.js';
import { leerComercio } from './comercio.js';
import { leerComunas, leerDelitos } from './territorio.js';
import { crearDex } from './dex.js';

const cache = new Map();

function cargar(nombre, leer) {
  if (!cache.has(nombre)) {
    const promesa = fetch(new URL(`../datos/${nombre}.json`, import.meta.url))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`No se pudo cargar ${nombre}.json (${r.status}).`))))
      .then(leer)
      .catch((e) => {
        cache.delete(nombre);
        throw e;
      });
    cache.set(nombre, promesa);
  }
  return cache.get(nombre);
}

export const cargarPlazas = () => cargar('plazas', leerPlazas);
export const cargarInteres = () => cargar('interes', leerInteres);
export const cargarComercio = () => cargar('comercio', leerComercio);
export const cargarServicios = () => cargar('servicios', leerServicios);
// Estos se cargan solo cuando se usan (trámites, metro, Santiagodex, seguridad), para no gastar datos del celular.
export const cargarTramites = () => cargar('tramites', leerTramites);
export const cargarMetro = () => cargar('metro', leerMetro);
export const cargarComunas = () => cargar('comunas', leerComunas);
export const cargarDelitos = () => cargar('delitos', leerDelitos);
// Lo que se sabe de cada lugar de la Santiagodex, por id de OSM (cada archivo dice sus campos al principio):
// contexto (scripts/contexto.mjs), entorno (entorno.mjs), especies (especies.mjs) y menciones (menciones.mjs).
// Se cargan al abrir una ficha.
export const cargarContexto = () => cargar('contexto', (json) => json.lugares);
export const cargarEntorno = () =>
  cargar('entorno', (json) => {
    // Los monumentos vienen una sola vez en su lista; cada lugar trae sus posiciones.
    for (const e of Object.values(json.lugares)) if (e.m) e.m = e.m.map((i) => json.monumentos[i]);
    return json.lugares;
  });
export const cargarEspecies = () => cargar('especies', (json) => json.lugares);
export const cargarMenciones = () => cargar('menciones', (json) => json.lugares);

// La Santiagodex se arma una vez con las plazas, los lugares interesantes y (si cargan) las comunas y el contexto,
// que suma artículos de Wikipedia que el mapa no enlazaba.
let dexPromesa = null;
export function cargarDex() {
  if (!dexPromesa) {
    dexPromesa = Promise.all([cargarPlazas(), cargarInteres(), cargarComunas().catch(() => null), cargarContexto().catch(() => null)])
      .then(([plazas, interes, comunas, contexto]) => {
        const dex = crearDex(plazas, interes, comunas);
        if (contexto) for (const l of dex) if (!l.wikipedia && contexto[l.id]?.w) l.wikipedia = contexto[l.id].w;
        return dex;
      })
      .catch((e) => {
        dexPromesa = null;
        throw e;
      });
  }
  return dexPromesa;
}

// Todo junto. Si un archivo falla, ese dato queda vacío y la app sigue funcionando sin él.
export async function cargarDatos() {
  const [plazas, interes, comercio, servicios] = await Promise.allSettled([
    cargarPlazas(),
    cargarInteres(),
    cargarComercio(),
    cargarServicios(),
  ]);
  const valor = (r, porDefecto) => (r.status === 'fulfilled' ? r.value : (console.error(r.reason), porDefecto));
  return {
    plazas: valor(plazas, []),
    interes: valor(interes, []),
    comercio: valor(comercio, null),
    servicios: valor(servicios, []),
  };
}
