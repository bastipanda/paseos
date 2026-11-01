// Genera datos/especies.json: qué plantas y animales ha registrado la gente en iNaturalist en cada lugar de la
// Santiagodex. Solo cuentan las observaciones con "grado de investigación" (otra persona confirmó la especie), y los
// nombres son los que se usan en Chile (preferred_place_id=7182).
// iNaturalist pide ir lento (una consulta por segundo): con más de 3.000 lugares tarda cerca de una hora. El avance
// queda en scripts/.cache/ y, si se corta, al correrlo de nuevo sigue donde quedó.   node scripts/especies.mjs

import { santiagodex, pedirJson, avance, esperar, guardarDatos } from './comun.mjs';
import { radioEspecies } from '../js/entorno.js';

const CHILE = 7182;
const POR_LUGAR = 8;
// Grupos de iNaturalist ("iconic taxa") en una letra, para que el archivo pese poco. La app los traduce.
const GRUPOS = { Aves: 'a', Plantae: 'p', Insecta: 'i', Mammalia: 'm', Reptilia: 'r', Amphibia: 'n', Arachnida: 'c', Mollusca: 'o', Fungi: 'h' };

const dex = await santiagodex();
const hecho = await avance('especies');
console.log(`Santiagodex: ${dex.length} lugares; ya consultados: ${Object.keys(hecho.datos).length}.`);
let n = 0;
for (const l of dex) {
  if (hecho.tiene(l.id)) continue;
  const [lat, lon] = l.punto;
  const url =
    'https://api.inaturalist.org/v1/observations/species_counts?' +
    new URLSearchParams({ lat, lng: lon, radius: (radioEspecies(l) / 1000).toFixed(2), quality_grade: 'research', per_page: POR_LUGAR, locale: 'es', preferred_place_id: CHILE });
  const j = await pedirJson(url);
  const especies = (j.results || [])
    .filter((r) => r.taxon?.preferred_common_name)
    .map((r) => [r.taxon.preferred_common_name, GRUPOS[r.taxon.iconic_taxon_name] || '']);
  await hecho.poner(l.id, [j.total_results || 0, especies]);
  if (++n % 100 === 0) console.log(`  ${Object.keys(hecho.datos).length} de ${dex.length}…`);
  await esperar(1000);
}
await hecho.guardar();

const lugares = {};
for (const l of dex) {
  const [total, especies] = hecho.datos[l.id] || [0, []];
  if (total) lugares[l.id] = [total, especies];
}
const totales = Object.values(lugares).map(([t]) => t);
console.log(`\nCon al menos una especie registrada: ${totales.length} de ${dex.length} (mediana ${totales.sort((a, b) => a - b)[Math.floor(totales.length / 2)] || 0}).`);
await guardarDatos('especies', {
  generado: new Date().toISOString().slice(0, 10),
  fuente: 'iNaturalist (observaciones con grado de investigación; nombres comunes de Chile)',
  campos: { lugar: '[especies registradas, [[nombre común, grupo]…]]', grupos: Object.fromEntries(Object.entries(GRUPOS).map(([k, v]) => [v, k])) },
  lugares,
});
