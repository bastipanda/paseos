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

// La Santiagodex se arma una vez con las plazas, los lugares interesantes y (si cargan) las comunas.
let dexPromesa = null;
export function cargarDex() {
  if (!dexPromesa) {
    dexPromesa = Promise.all([cargarPlazas(), cargarInteres(), cargarComunas().catch(() => null)])
      .then(([plazas, interes, comunas]) => crearDex(plazas, interes, comunas))
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
