// Lo que comparten los scripts que generan datos/: pedir a Overpass, a Wikimedia y a otras API con reintentos, armar
// la Santiagodex igual que la app y guardar el avance de los scripts largos para seguir donde quedaron si se cortan.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import dns from 'node:dns';
import { leerPlazas, leerInteres } from '../js/plazas.js';
import { leerComunas } from '../js/territorio.js';
import { crearDex } from '../js/dex.js';

// En esta red, algunos servidores no responden por IPv6 y la consulta queda colgada hasta el tiempo límite.
dns.setDefaultResultOrder('ipv4first');

export const UA = { 'User-Agent': 'paseos (https://github.com/bastipanda/paseos)' };
const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Overpass se satura seguido (responde 429, 502 o 504): se prueba cada servidor por turno, con pausas que crecen.
export async function overpass(consulta) {
  for (let intento = 0; intento < 9; intento++) {
    const url = SERVIDORES[intento % SERVIDORES.length];
    try {
      console.log(`Overpass: consultando ${url}…`);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: consulta }),
        signal: AbortSignal.timeout(240_000),
      });
      const texto = await resp.text();
      if (resp.ok && texto.trim().startsWith('{')) return JSON.parse(texto).elements;
      console.log(`  falló (${resp.status})`);
    } catch (e) {
      console.log(`  falló: ${e.message}`);
    }
    await esperar(15_000 * (Math.floor(intento / SERVIDORES.length) + 1));
  }
  throw new Error('Ningún servidor de Overpass respondió. Intenta más tarde.');
}

// API de Wikimedia (Wikipedia, Wikidata o Commons), con reintentos cuando dice que está ocupada o se cae un rato
// (pasa: con pausas de hasta 30 s, espera unos dos minutos y medio antes de rendirse).
export async function wikimedia(sitio, params) {
  const url = `https://${sitio}/w/api.php?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let intento = 0; intento < 8; intento++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000) });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (json.error && /busy|ratelimit|toomany/i.test(`${json.error.code} ${json.error.info}`)) throw new Error(json.error.info);
      if (json.error) throw Object.assign(new Error(json.error.info), { definitivo: true });
      return json;
    } catch (e) {
      if (e.definitivo) throw e;
      await esperar(Math.min(30_000, 2500 * 2 ** intento));
    }
  }
  throw new Error(`${sitio} no respondió.`);
}

// Cualquier otra API que responde JSON (iNaturalist, Open-Meteo, el CMN). Reintenta si está ocupada o se cae.
export async function pedirJson(url, opciones = {}) {
  for (let intento = 0; intento < 6; intento++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60_000), ...opciones });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { definitivo: true });
      return await r.json();
    } catch (e) {
      if (e.definitivo) throw e;
      await esperar(3000 * (intento + 1));
    }
  }
  throw new Error(`${new URL(url).host} no respondió.`);
}

// "Plaza Ñuñoa" y "plaza ñuñoa (santiago)" se comparan igual: sin tildes, sin mayúsculas ni lo que va entre paréntesis.
export const normalizar = (t) =>
  t
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();

export const leerDatos = async (nombre) => JSON.parse(await readFile(new URL(`../datos/${nombre}.json`, import.meta.url), 'utf8'));

export async function guardarDatos(nombre, objeto) {
  await writeFile(new URL(`../datos/${nombre}.json`, import.meta.url), JSON.stringify(objeto));
  console.log(`\nGuardado datos/${nombre}.json`);
}

// La Santiagodex igual que en la app (con la comuna de cada lugar si se pide).
export async function santiagodex({ conComunas = false } = {}) {
  const comunas = conComunas ? leerComunas(await leerDatos('comunas')) : null;
  return crearDex(leerPlazas(await leerDatos('plazas')), leerInteres(await leerDatos('interes')), comunas);
}

// Avance de un script largo, guardado en scripts/.cache/ (no va al repo). Si el script se corta, al correrlo de nuevo
// se salta lo que ya hizo.
export async function avance(nombre) {
  const carpeta = new URL('./.cache/', import.meta.url);
  const archivo = new URL(`${nombre}.json`, carpeta);
  await mkdir(carpeta, { recursive: true });
  let datos = {};
  try {
    datos = JSON.parse(await readFile(archivo, 'utf8'));
  } catch {}
  let pendientes = 0;
  const guardar = () => writeFile(archivo, JSON.stringify(datos));
  return {
    datos,
    tiene: (k) => k in datos,
    async poner(k, v) {
      datos[k] = v;
      if (++pendientes >= 25) {
        pendientes = 0;
        await guardar();
      }
    },
    guardar,
  };
}
