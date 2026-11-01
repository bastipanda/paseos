// "Una razón para ir" (v1.7): los textos de la ficha de la Santiagodex que salen del entorno de cada lugar (qué hay,
// árboles, especies, horario, obra, monumentos, calles, altura y puntos de referencia). Funciones puras: reciben los
// datos ya cargados (scripts/entorno.mjs, especies.mjs, contexto.mjs) y devuelven texto, para probarlas sin navegador.
// Nada se inventa: si un dato no está, la línea no aparece.

import { distancia, rumbo } from './geo.js';
import { formatearDistancia } from './duracion.js';
import { listar } from './explicar.js';
import { puntoCardinal } from './guia.js';

// Radio donde se buscan especies en iNaturalist: en una plaza o parque, todo el lugar; en un punto (una estatua, un
// museo), 100 m a la redonda. Lo usan el script que genera los datos y el enlace "ver todas" de la ficha.
export const radioEspecies = (l) => Math.round(Math.min(400, Math.max(100, (l.tamano || 0) / 2 + 50)));

const numero = new Intl.NumberFormat('es-CL');
const cantidad = (n, uno, varios) => (n === 1 ? uno : `${n} ${varios}`);

// --- Qué hay ---

const DEPORTES = {
  soccer: 'fútbol',
  basketball: 'básquetbol',
  tennis: 'tenis',
  volleyball: 'vóleibol',
  beachvolleyball: 'vóleibol playa',
  multi: 'multicancha',
  padel: 'pádel',
  baseball: 'béisbol',
  futsal: 'futsal',
  rugby: 'rugby',
  field_hockey: 'hockey',
  table_tennis: 'pimpón',
  boules: 'petanca',
  athletics: 'atletismo',
};

// h = { j: juegos, e: máquinas de ejercicio, p: área para perros, b: bebederos, c: { deporte: canchas } }
export function textoQueHay(h) {
  if (!h) return '';
  const partes = [];
  if (h.j) partes.push('juegos infantiles');
  if (h.e) partes.push('máquinas de ejercicio');
  const canchas = { ...(h.c || {}) };
  const skate = canchas.skateboard || 0;
  delete canchas.skateboard;
  const totalCanchas = Object.values(canchas).reduce((s, n) => s + n, 0);
  if (totalCanchas) {
    const deportes = [...new Set(Object.keys(canchas).map((d) => DEPORTES[d]).filter(Boolean))];
    partes.push(`${cantidad(totalCanchas, 'una cancha', 'canchas')}${deportes.length ? ` (${listar(deportes)})` : ''}`);
  }
  if (skate) partes.push('una pista de skate');
  if (h.b) partes.push(cantidad(h.b, 'un bebedero', 'bebederos'));
  if (h.p) partes.push('un área para perros');
  return partes.length ? `En el lugar o junto a él: ${listar(partes)}.` : '';
}

// r = [árboles, [[especie, cantidad]…]] (los que el mapa tiene catastrados con su especie).
export function textoArboles(r) {
  if (!r?.[0]) return '';
  const [total, especies] = r;
  const lista = especies.map(([e, n]) => `${e} (${n})`).join(' · ');
  return `${cantidad(total, 'Un árbol identificado', 'árboles identificados')} en el mapa${lista ? `: ${lista}` : ''}.`;
}

export const GRUPOS_ESPECIES = { a: 'Aves', p: 'Plantas', i: 'Insectos', m: 'Mamíferos', r: 'Reptiles', n: 'Anfibios', c: 'Arácnidos', o: 'Moluscos', h: 'Hongos', '': 'Otras' };

// esp = [especies registradas, [[nombre común, grupo]…]] → { titulo, grupos: ['Aves: Chincol, Zorzal y Tordo', …] }
export function textoEspecies(esp) {
  if (!esp?.[0]) return null;
  const [total, especies] = esp;
  const porGrupo = new Map(Object.keys(GRUPOS_ESPECIES).map((g) => [g, []]));
  for (const [nombre, grupo] of especies) (porGrupo.get(grupo) || porGrupo.get('')).push(nombre);
  return {
    titulo: `${cantidad(total, 'Una especie registrada', 'especies registradas')} aquí por la gente en iNaturalist.`,
    grupos: [...porGrupo.entries()].filter(([, n]) => n.length).map(([g, n]) => `${GRUPOS_ESPECIES[g]}: ${listar(n)}`),
    hayMas: total > especies.length,
  };
}

export function enlaceINaturalist(l) {
  const [lat, lng] = l.punto;
  return `https://www.inaturalist.org/observations?${new URLSearchParams({ lat, lng, radius: (radioEspecies(l) / 1000).toFixed(2), quality_grade: 'research', view: 'species', locale: 'es', preferred_place_id: 7182 })}`;
}

// Horario en el formato de OpenStreetMap ("Mo-Fr 08:30-17:30; Sa 10:00-14:00") en palabras. Si no se entiende, se
// muestra tal cual (es mejor que adivinar).
const DIAS = { Mo: 'lunes', Tu: 'martes', We: 'miércoles', Th: 'jueves', Fr: 'viernes', Sa: 'sábado', Su: 'domingo', PH: 'festivos' };
const hora = (h) => h.replace(/^0(\d)/, '$1');
export function textoHorario(o) {
  if (!o) return '';
  if (o.trim() === '24/7') return 'Abierto siempre.';
  const reglas = o.split(';').map((r) => r.trim()).filter(Boolean);
  const partes = [];
  for (const regla of reglas) {
    const m = /^((?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su|PH))*)?\s*(.*)$/.exec(regla);
    const dias = (m[1] || '')
      .replace(/\s+/g, '')
      .split(',')
      .filter(Boolean)
      .map((d) => d.split('-').map((x) => DIAS[x]).join(' a '));
    const resto = m[2].trim();
    let horas;
    if (/^(off|closed)$/i.test(resto)) horas = 'cerrado';
    else if (/^\d{1,2}:\d{2}-\d{1,2}:\d{2}(\s*,\s*\d{1,2}:\d{2}-\d{1,2}:\d{2})*$/.test(resto)) {
      horas = resto
        .split(',')
        .map((t) => t.trim().split('-').map(hora))
        .map(([a, b]) => `de ${a} a ${b}`)
        .join(' y ');
    } else return `Horario (como lo anota el mapa): ${o}`;
    partes.push(`${dias.length ? `${listar(dias)} ` : ''}${horas}`);
  }
  const texto = partes.join('; ');
  return `Horario: ${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`;
}

// --- Su historia ---

const OBRAS = {
  bust: 'Busto',
  statue: 'Estatua',
  sculpture: 'Escultura',
  mural: 'Mural',
  relief: 'Relieve',
  installation: 'Instalación',
  mosaic: 'Mosaico',
  graffiti: 'Grafiti',
  fountain: 'Fuente',
  painting: 'Pintura',
  stone: 'Piedra tallada',
  obelisk: 'Obelisco',
};
const MATERIALES = {
  bronze: 'bronce',
  stone: 'piedra',
  marble: 'mármol',
  granite: 'granito',
  steel: 'acero',
  metal: 'metal',
  iron: 'fierro',
  copper: 'cobre',
  aluminium: 'aluminio',
  concrete: 'hormigón',
  wood: 'madera',
  ceramic: 'cerámica',
  glass: 'vidrio',
  brick: 'ladrillo',
  plastic: 'plástico',
};

// c = contexto del lugar: k = [tipo de obra, material], a = artista, y = año.
export function textoObra(c) {
  if (!c) return '';
  const [tipo, material] = c.k || [];
  const obra = OBRAS[tipo];
  const de = MATERIALES[(material || '').split(';')[0]];
  const partes = [];
  if (obra) partes.push(`${obra}${de ? ` de ${de}` : ''}`);
  if (c.a) partes.push(partes.length ? `obra de ${c.a}` : `Obra de ${c.a}`);
  if (c.y) partes.push(partes.length ? `del año ${c.y}` : `Del año ${c.y}`);
  return partes.length ? `${partes.join(', ')}.` : '';
}

// m = [[categoría, nombre, año, decreto, cerca?]…] del Consejo de Monumentos Nacionales: el lugar está dentro de su
// contorno o, si el monumento es solo un punto, a menos de 60 m (cerca = 1). Si el lugar es el monumento mismo ("Museo
// Palacio Cousiño" y "Palacio Cousiño y Jardines"), se dice que lo es.
const sinTildes = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const RELLENO = new Set(['museo', 'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'jardines', 'ex']);
const palabras = (t) => sinTildes(t).split(' ').filter((p) => p && !RELLENO.has(p));
function mismoNombre(a, b) {
  const [pa, pb] = [palabras(a), palabras(b)];
  if (!pa.length || !pb.length) return false;
  const [corto, largo] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
  return corto.every((p) => largo.includes(p));
}
export function textosMonumentos(m, nombreLugar) {
  return (m || []).map(([categoria, nombre, anio, decreto, cerca]) => {
    const femenino = categoria === 'Zona Típica';
    const declarado = anio ? `, ${femenino ? 'declarada' : 'declarado'} en ${anio}` : '';
    const articulo = femenino ? 'de la' : 'del';
    const texto = mismoNombre(nombre, nombreLugar)
      ? `Es ${categoria}${anio ? ` desde ${anio}` : ''} (Consejo de Monumentos Nacionales).`
      : `${cerca ? `Junto al` : `Está dentro ${articulo}`} ${categoria} «${nombre}»${declarado} (Consejo de Monumentos Nacionales).`;
    return { texto, enlace: decreto || null };
  });
}

// p = [artículo de la persona, descripción]. Es una coincidencia de nombre, no una afirmación: puede haber homónimos.
export function textoPersona(p) {
  if (!p) return '';
  const [titulo, descripcion] = p;
  return `Su nombre coincide con el de ${titulo.replace(/\s*\(.*\)$/, '')}${descripcion ? `: ${descripcion}` : ''}.`;
}

// --- Dónde estás ---

const LADOS = { n: 'norte', o: 'oriente', s: 'sur', p: 'poniente' };
// c = [[calle, lado]…]: n, o, s, p (norte, oriente, sur, poniente); e = el lugar (un punto) está en esa calle; j = el
// lugar (una plaza o parque grande) está junto a ella.
export function textoCalles(c) {
  if (!c?.length) return '';
  const [primera, ...resto] = c;
  const conLado = (lista) => listar(lista.map(([calle, lado]) => `${calle} (al ${LADOS[lado]})`));
  const otras = resto.filter(([, lado]) => LADOS[lado]).slice(0, 3);
  if (primera[1] === 'e' || primera[1] === 'j') {
    return `${primera[1] === 'e' ? 'Está en' : 'Junto a'} ${primera[0]}${otras.length ? `; cerca: ${conLado(otras)}` : ''}.`;
  }
  return `Calles alrededor: ${conLado(c.filter(([, lado]) => LADOS[lado]))}.`;
}

// Id de OSM de la Plaza de Armas en la Santiagodex: su altura es la referencia para comparar.
export const PLAZA_DE_ARMAS = 'r10272414';

// z = altura del lugar; ref = altura de la Plaza de Armas.
export function textoAltura(z, ref, esCerro = false) {
  if (!Number.isFinite(z)) return '';
  const base = `${esCerro ? 'Su cumbre está' : 'Está'} a ${numero.format(z)} m sobre el nivel del mar`;
  if (!Number.isFinite(ref)) return `${base}.`;
  const d = Math.round(z - ref);
  if (Math.abs(d) < 5) return `${base}, casi a la misma altura que la Plaza de Armas.`;
  return `${base}: ${numero.format(Math.abs(d))} m más ${d > 0 ? 'arriba' : 'abajo'} que la Plaza de Armas.`;
}

// Puntos de referencia que se ven desde casi todo Santiago, para ubicarse ("Aprender a ubicarme").
export const REFERENCIAS = [
  { nombre: 'la Gran Torre', punto: [-33.41693, -70.60679] },
  { nombre: 'el cerro San Cristóbal', punto: [-33.42032, -70.62985] },
];

export function textoReferencias(punto, referencias = REFERENCIAS) {
  const partes = referencias
    .map((r) => ({ ...r, d: distancia(punto, r.punto) }))
    .filter((r) => r.d >= 400)
    .map((r, i) => `${r.nombre}${i ? '' : ' queda'} a ${formatearDistancia(r.d)} al ${puntoCardinal(rumbo(punto, r.punto))}`);
  if (!partes.length) return '';
  return `Desde aquí, ${listar(partes)}.`;
}
