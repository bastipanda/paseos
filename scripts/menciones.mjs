// Genera datos/menciones.json: para los lugares de la Santiagodex sin artículo propio, una frase textual de un artículo
// de Wikipedia que los nombra. Va en tres pasos, porque un lugar puede tener el mismo nombre que otro (hay "Plaza
// Ercilla" en Santiago y en La Florida) y eso no lo resuelve un programa:
//   1. node scripts/menciones.mjs
//      Busca cada lugar en Wikipedia y deja las frases que lo nombran en scripts/.cache/menciones-candidatas.json.
//   2. Claude Code lee las candidatas y anota en scripts/.cache/menciones-elegidas.json cuál habla de ese lugar
//      ({ "id del lugar": número de la frase }). No escribe texto: solo elige ("subraya").
//   3. node scripts/menciones.mjs --verificar
//      Vuelve a bajar cada artículo, revisa que la frase elegida esté letra por letra y guarda datos/menciones.json.

import { readFile, writeFile } from 'node:fs/promises';
import { santiagodex, wikimedia, avance, esperar, normalizar, leerDatos, guardarDatos } from './comun.mjs';

const CANDIDATAS = new URL('./.cache/menciones-candidatas.json', import.meta.url);
const ELEGIDAS = new URL('./.cache/menciones-elegidas.json', import.meta.url);
const POR_LUGAR = 4;
// Si el nombre no dice qué es (por ejemplo "Abraham Lincoln", una estatua), la frase tiene que nombrar también un tipo
// de lugar o la comuna: si no, casi siempre habla de la persona.
const TIPO_DE_LUGAR = /\b(plaza|plazoleta|plazuela|parque|monumento|estatua|busto|escultura|memorial|museo|centro cultural|galeria|teatro|biblioteca|mirador|cerro|anfiteatro|sala|casa|iglesia|capilla|mural|obra)\b/;

const textos = new Map();
async function textoDe(titulo) {
  if (!textos.has(titulo)) {
    const r = await wikimedia('es.wikipedia.org', { action: 'query', prop: 'extracts', explaintext: 1, redirects: 1, titles: titulo });
    textos.set(titulo, Object.values(r.query?.pages || {})[0]?.extract || '');
  }
  return textos.get(titulo);
}

// Frases de un artículo: por párrafo y, dentro de cada párrafo, por punto seguido de mayúscula. Sin títulos de sección.
function frasesDe(texto) {
  return texto
    .split('\n')
    .filter((p) => p.trim() && !/^=+.*=+$/.test(p.trim()))
    .flatMap((p) => p.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«"(])/))
    .map((f) => f.trim())
    .filter((f) => f.length >= 30 && f.length <= 450);
}

const nombra = (frase, nombre) => ` ${normalizar(frase)} `.includes(` ${normalizar(nombre)} `);

if (process.argv.includes('--verificar')) {
  // --- 3. Verificar lo elegido contra el artículo actual ---
  const candidatas = JSON.parse(await readFile(CANDIDATAS, 'utf8'));
  const elegidas = JSON.parse(await readFile(ELEGIDAS, 'utf8'));
  const lugares = {};
  const rechazadas = [];
  for (const [id, i] of Object.entries(elegidas)) {
    const c = candidatas[id]?.candidatas[i];
    if (!c) {
      rechazadas.push(`${id}: no hay frase ${i}`);
      continue;
    }
    const plano = (t) => t.replace(/\s+/g, ' ');
    if (!plano(await textoDe(c.articulo)).includes(plano(c.frase))) {
      rechazadas.push(`${candidatas[id].nombre}: la frase ya no está en «${c.articulo}»`);
      continue;
    }
    lugares[id] = [c.articulo, c.frase];
    await esperar(100);
  }
  console.log(`Verificadas: ${Object.keys(lugares).length} · rechazadas: ${rechazadas.length}`);
  for (const r of rechazadas) console.log(`  ${r}`);
  await guardarDatos('menciones', {
    generado: new Date().toISOString().slice(0, 10),
    fuente: 'Wikipedia en español (frases textuales; Claude Code eligió cuál habla de cada lugar y un programa revisó que estén letra por letra)',
    campos: { lugar: '[artículo, frase]' },
    lugares,
  });
} else {
  // --- 1. Buscar candidatas ---
  const dex = await santiagodex({ conComunas: true });
  const conArticulo = new Set(Object.entries((await leerDatos('contexto')).lugares).filter(([, c]) => c.w).map(([id]) => id));
  const sinArticulo = dex.filter((l) => !l.wikipedia && !conArticulo.has(l.id));
  const hecho = await avance('menciones');
  console.log(`Lugares sin artículo propio: ${sinArticulo.length}; ya buscados: ${Object.keys(hecho.datos).length}.`);
  let n = 0;
  for (const l of sinArticulo) {
    if (hecho.tiene(l.id)) continue;
    const comuna = l.comuna || '';
    const r = await wikimedia('es.wikipedia.org', { action: 'query', list: 'search', srlimit: 6, srsearch: `"${l.nombre}" ${comuna}`.trim() });
    const necesitaTipo = !TIPO_DE_LUGAR.test(normalizar(l.nombre));
    const candidatas = [];
    for (const a of r.query?.search || []) {
      if (candidatas.length >= POR_LUGAR) break;
      const texto = await textoDe(a.title);
      // El artículo tiene que nombrar la comuna (o ser de la comuna de Santiago, que casi todos nombran).
      if (comuna && !normalizar(texto).includes(normalizar(comuna))) continue;
      for (const frase of frasesDe(texto)) {
        if (candidatas.length >= POR_LUGAR) break;
        if (!nombra(frase, l.nombre)) continue;
        const f = normalizar(frase);
        if (necesitaTipo && !TIPO_DE_LUGAR.test(f) && !(comuna && f.includes(normalizar(comuna)))) continue;
        if (candidatas.some((c) => c.frase === frase)) continue;
        candidatas.push({ articulo: a.title, frase });
      }
      await esperar(100);
    }
    await hecho.poner(l.id, { nombre: l.nombre, tipo: l.tipo, comuna, candidatas });
    if (++n % 100 === 0) console.log(`  ${Object.keys(hecho.datos).length} de ${sinArticulo.length}…`);
    await esperar(150);
  }
  await hecho.guardar();
  const conCandidatas = Object.fromEntries(Object.entries(hecho.datos).filter(([, v]) => v.candidatas.length));
  await writeFile(CANDIDATAS, JSON.stringify(conCandidatas, null, 1));
  const frases = Object.values(conCandidatas).reduce((s, v) => s + v.candidatas.length, 0);
  console.log(`\nCon alguna frase candidata: ${Object.keys(conCandidatas).length} lugares (${frases} frases).`);
  console.log('Siguiente paso: elegir en scripts/.cache/menciones-elegidas.json y correr con --verificar.');
}
