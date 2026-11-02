// Trámites ("ir a hacer algo y volver"), replanteados en la v1.9: la necesidad manda y la duración se adapta. Antes la
// app buscaba un local que calzara con los minutos pedidos y casi nunca encontraba el que uno quería (con 30 min solo
// servían los que estaban entre ~500 m y ~1,1 km). Ahora eliges el lugar (o el más cercano de un tipo) y el paseo dura
// al menos la ida y vuelta, alargándose hasta el tiempo pedido. La búsqueda entiende palabras comunes ("remedios",
// "plata", "pan") y nombres de cadenas; lo que no está en los datos se busca en OpenStreetMap (app.js).

import { distancia, rumbo } from './geo.js';

export const TIPOS_MANDADO = {
  supermercado: 'Súper',
  farmacia: 'Farmacia',
  panaderia: 'Panadería',
  feria: 'Feria',
  cajero: 'Cajero',
  ferreteria: 'Ferretería',
};

// Cómo se nombra el más cercano de cada tipo en la frase de Armar.
export const MAS_CERCANO = {
  supermercado: 'el súper más cercano',
  farmacia: 'la farmacia más cercana',
  panaderia: 'la panadería más cercana',
  feria: 'la feria más cercana',
  cajero: 'el cajero más cercano',
  ferreteria: 'la ferretería más cercana',
};

// Lo que la gente escribe para cada tipo (sin tildes ni mayúsculas).
const SINONIMOS = {
  supermercado: ['super', 'supermercado', 'almacen', 'lider', 'jumbo', 'unimarc', 'tottus', 'santa isabel', 'acuenta', 'mayorista', 'compras'],
  farmacia: ['farmacia', 'remedio', 'remedios', 'medicamento', 'cruz verde', 'salcobrand', 'ahumada', 'simi'],
  panaderia: ['pan', 'panaderia', 'amasanderia', 'pasteleria', 'hallulla', 'marraqueta'],
  feria: ['feria', 'verdura', 'verduras', 'fruta', 'frutas', 'vega', 'mercado'],
  cajero: ['cajero', 'banco', 'plata', 'efectivo', 'redbanc', 'atm'],
  ferreteria: ['ferreteria', 'herramienta', 'herramientas', 'clavos', 'tornillos', 'pintura', 'easy', 'sodimac', 'construmart'],
};

export const normalizar = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Tipos de trámite que nombra un texto ("necesito remedios" → farmacia). Una palabra corta cuenta si empieza igual
// que un sinónimo ("ferre" → ferretería).
export function tiposDeTexto(texto) {
  const q = normalizar(texto);
  if (q.length < 2) return [];
  const palabras = q.split(' ');
  return Object.entries(SINONIMOS)
    .filter(([, lista]) =>
      lista.some((s) => q.includes(s) || palabras.some((p) => p.length >= 3 && s.startsWith(p))),
    )
    .map(([tipo]) => tipo);
}

// Busca en los datos de trámites: primero los que se llaman como lo escrito, después los del tipo que nombra; cada
// grupo ordenado por cercanía a `desde`. Devuelve los lugares con su `distancia`.
export function buscarMandados(texto, lugares, desde, { maximo = 6000, limite = 8 } = {}) {
  const q = normalizar(texto);
  if (q.length < 2) return [];
  const tipos = tiposDeTexto(q);
  return lugares
    .map((l) => ({ l, porNombre: normalizar(l.nombre).includes(q), d: distancia(desde, l.punto) }))
    .filter((x) => x.d <= maximo && (x.porNombre || tipos.includes(x.l.tipo)))
    .sort((a, b) => Number(b.porNombre) - Number(a.porNombre) || a.d - b.d)
    .slice(0, limite)
    .map(({ l, d }) => ({ ...l, distancia: d }));
}

// Los `n` lugares más cercanos a `desde`, separados entre sí al menos `separacion` metros (para no ofrecer dos
// farmacias de la misma esquina), sin contar los que están casi encima (menos de `minimo`).
export function masCercanos(lugares, desde, { n = 3, separacion = 150, minimo = 40, maximo = 6000 } = {}) {
  const ordenados = lugares
    .map((l) => ({ l, d: distancia(desde, l.punto) }))
    .filter((x) => x.d >= minimo && x.d <= maximo)
    .sort((a, b) => a.d - b.d);
  const elegidos = [];
  for (const x of ordenados) {
    if (elegidos.every((e) => distancia(e.l.punto, x.l.punto) >= separacion)) elegidos.push(x);
    if (elegidos.length >= n) break;
  }
  return elegidos.map((x) => x.l);
}

// La duración de un paseo a un lugar elegido por necesidad: al menos la ida y vuelta (la ida ≈ distancia × 1,1-1,8
// por las calles), y hasta lo pedido si es más.
export function rangoPorNecesidad(rango, d) {
  const min = Math.max(rango.min ?? 0, d * 2.2);
  const max = Math.max(rango.max ?? 0, d * 3.6, min * 1.15);
  return { min, max };
}

// Hacia dónde queda un lugar visto desde `desde`, para distinguir dos locales iguales ("al nororiente").
const PUNTOS = ['norte', 'nororiente', 'oriente', 'suroriente', 'sur', 'surponiente', 'poniente', 'norponiente'];
export const haciaDonde = (desde, punto) => PUNTOS[Math.round(((rumbo(desde, punto) % 360) + 360) % 360 / 45) % 8];
