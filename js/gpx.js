// Exporta una opción como archivo GPX, el formato estándar para rutas que abren OsmAnd, Organic Maps y otras apps.
// Toda la ruta va en un solo trazado continuo, para que la app de navegación la siga de principio a fin. Las
// estaciones y el destino van como puntos marcados.

import { distancia } from './geo.js';
import { nombreLugar } from './plazas.js';

const escapar = (texto) =>
  String(texto).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

const punto = ([lat, lon]) => `lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"`;

export function crearGpx(opcion, { nombre = 'Paseo', fecha = new Date() } = {}) {
  const coords = [];
  for (const parte of opcion.partes) coords.push(...(coords.length ? parte.ruta.coords.slice(1) : parte.ruta.coords));
  const inicio = coords[0];
  const fin = coords[coords.length - 1];
  const marcas = [[inicio, 'Partida']];
  if (opcion.destino) marcas.push([opcion.destino.punto, nombreLugar(opcion.destino)]);
  if (opcion.estacionSalida) marcas.push([opcion.estacionSalida.punto, `Tomar bici: ${opcion.estacionSalida.nombre}`]);
  if (opcion.estacionLlegada) marcas.push([opcion.estacionLlegada.punto, `Dejar bici: ${opcion.estacionLlegada.nombre}`]);
  if (distancia(inicio, fin) > 50) marcas.push([fin, 'Término']);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Paseos (https://bastipanda.github.io/paseos/)" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${escapar(nombre)}</name><time>${fecha.toISOString()}</time></metadata>`,
    ...marcas.map(([p, n]) => `  <wpt ${punto(p)}><name>${escapar(n)}</name></wpt>`),
    `  <trk><name>${escapar(nombre)}</name><trkseg>`,
    ...coords.map((p) => `    <trkpt ${punto(p)}/>`),
    '  </trkseg></trk>',
    '</gpx>',
    '',
  ].join('\n');
}

export function nombreArchivo(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  return `paseo-${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}-${dos(fecha.getHours())}${dos(fecha.getMinutes())}.gpx`;
}
