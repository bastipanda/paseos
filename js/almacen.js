// Lugares guardados y ajustes, en el navegador (localStorage). Nunca salen del celular salvo que se
// exporten a mano. El navegador puede borrar estos datos o bloquearlos (modo incógnito): por eso cada
// lectura y escritura está protegida y existe el respaldo en archivo.

import { AJUSTES_POR_DEFECTO } from './duracion.js';
import { esRegistroValido } from './historial.js';

const CLAVE_LUGARES = 'paseos.lugares';
const CLAVE_AJUSTES = 'paseos.ajustes';
const CLAVE_FORMULARIO = 'paseos.formulario';
const CLAVE_CONOCIDAS = 'paseos.conocidas';
const CLAVE_HISTORIAL = 'paseos.historial';
const CLAVE_METAS = 'paseos.metas';
const CLAVE_FAVORITAS = 'paseos.favoritas';
const CLAVE_DEX = 'paseos.dex';
const CLAVE_EN_CURSO = 'paseos.en-curso';

function leer(clave, porDefecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? JSON.parse(texto) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function lugares() {
  const lista = leer(CLAVE_LUGARES, []);
  return Array.isArray(lista) ? lista.filter(esLugarValido) : [];
}

function esLugarValido(l) {
  return l && typeof l.nombre === 'string' && Number.isFinite(l.lat) && Number.isFinite(l.lon);
}

export function agregarLugar(nombre, punto) {
  const lista = lugares();
  const lugar = { id: crypto.randomUUID(), nombre: nombre.trim(), lat: punto[0], lon: punto[1] };
  lista.push(lugar);
  escribir(CLAVE_LUGARES, lista);
  return lugar;
}

export function borrarLugar(id) {
  escribir(
    CLAVE_LUGARES,
    lugares().filter((l) => l.id !== id),
  );
}

export function renombrarLugar(id, nombre) {
  escribir(
    CLAVE_LUGARES,
    lugares().map((l) => (l.id === id ? { ...l, nombre: nombre.trim() } : l)),
  );
}

export function ajustes() {
  return { ...AJUSTES_POR_DEFECTO, ...leer(CLAVE_AJUSTES, {}) };
}

export function guardarAjustes(nuevos) {
  escribir(CLAVE_AJUSTES, { ...ajustes(), ...nuevos });
}

export function formularioGuardado() {
  return leer(CLAVE_FORMULARIO, null);
}

export function guardarFormulario(datos) {
  escribir(CLAVE_FORMULARIO, datos);
}

// Modo explorar: cuadros de ~50 m que Bastián marcó como conocidos (ver explorar.js).
export function conocidas() {
  const lista = leer(CLAVE_CONOCIDAS, []);
  return new Set(Array.isArray(lista) ? lista.filter((c) => typeof c === 'string') : []);
}

// Devuelve solo los cuadros que eran nuevos, para poder deshacer exactamente lo que se agregó.
export function agregarConocidas(celdas) {
  const set = conocidas();
  const nuevas = celdas.filter((c) => !set.has(c));
  for (const c of nuevas) set.add(c);
  escribir(CLAVE_CONOCIDAS, [...set]);
  return nuevas;
}

export function quitarConocidas(celdas) {
  const set = conocidas();
  for (const c of celdas) set.delete(c);
  escribir(CLAVE_CONOCIDAS, [...set]);
}

export function borrarConocidas() {
  escribir(CLAVE_CONOCIDAS, []);
}

// Historial de paseos (ver historial.js), del más nuevo al más antiguo. `false` si no se pudo guardar (por
// ejemplo, si el navegador se quedó sin espacio).
export function historial() {
  const lista = leer(CLAVE_HISTORIAL, []);
  return (Array.isArray(lista) ? lista.filter(esRegistroValido) : []).sort((a, b) => b.inicio.localeCompare(a.inicio));
}

export function agregarAlHistorial(registro) {
  const lista = historial().filter((r) => r.id !== registro.id);
  lista.push(registro);
  return escribir(CLAVE_HISTORIAL, lista);
}

export function borrarDelHistorial(id) {
  escribir(
    CLAVE_HISTORIAL,
    historial().filter((r) => r.id !== id),
  );
}

// Meta semanal: { lista: [{ desde, minutos }], respondida: semana en que se respondió la última propuesta }.
export function metas() {
  const m = leer(CLAVE_METAS, null);
  return { lista: Array.isArray(m?.lista) ? m.lista : [], respondida: m?.respondida || null };
}

export function guardarMetas(nuevas) {
  escribir(CLAVE_METAS, { ...metas(), ...nuevas });
}

// Rutas favoritas: { id, nombre, creada, metros, receta, vista } (la receta permite pedir la misma ruta otra vez).
export function favoritas() {
  const lista = leer(CLAVE_FAVORITAS, []);
  return Array.isArray(lista) ? lista.filter((f) => f && typeof f.nombre === 'string' && f.receta) : [];
}

export function agregarFavorita(favorita) {
  return escribir(CLAVE_FAVORITAS, [...favoritas().filter((f) => f.id !== favorita.id), favorita]);
}

export function borrarFavorita(id) {
  escribir(
    CLAVE_FAVORITAS,
    favoritas().filter((f) => f.id !== id),
  );
}

export function renombrarFavorita(id, nombre) {
  escribir(
    CLAVE_FAVORITAS,
    favoritas().map((f) => (f.id === id ? { ...f, nombre: nombre.trim() } : f)),
  );
}

// Santiagodex: { capturados: { id: { fecha, como: 'gps' | 'mano' | 'foto', foto?: fecha } }, vistos: { id: fecha },
// notas: { id: texto } }. Sin `foto` el lugar está como "falta la foto". Las fotos mismas van en IndexedDB (fotos.js).
// Las notas las escribe Bastián en la ficha de cada lugar: no se regeneran, van en el respaldo.
export function dex() {
  const d = leer(CLAVE_DEX, null);
  return { capturados: d?.capturados || {}, vistos: d?.vistos || {}, notas: d?.notas || {} };
}

export function guardarDex(d) {
  escribir(CLAVE_DEX, d);
}

// Paseo en curso: se guarda cada tanto mientras caminas, para no perderlo si el navegador se cierra sin "Terminar".
export function paseoEnCurso() {
  return leer(CLAVE_EN_CURSO, null);
}

export function guardarPaseoEnCurso(datos) {
  escribir(CLAVE_EN_CURSO, datos);
}

export function borrarPaseoEnCurso() {
  try {
    localStorage.removeItem(CLAVE_EN_CURSO);
  } catch {
    // Nada que hacer: si el navegador bloquea el almacenamiento, tampoco había nada guardado.
  }
}

// Respaldo: un archivo JSON con todo lo que no se puede regenerar. Las fotos de la Santiagodex las agrega app.js
// (vienen de IndexedDB, que es asíncrono).
export function respaldo() {
  return {
    app: 'paseos',
    version: 4,
    fecha: new Date().toISOString(),
    lugares: lugares(),
    ajustes: ajustes(),
    conocidas: [...conocidas()],
    historial: historial(),
    metas: metas(),
    favoritas: favoritas(),
    dex: dex(),
  };
}

// Restaura un respaldo. Lo que ya existe se mantiene y se suma lo nuevo (lugares sin duplicar por nombre y
// posición; paseos y favoritas por su identificador). Devuelve cuántos lugares y paseos se agregaron.
export function restaurar(datos) {
  if (!datos || datos.app !== 'paseos' || !Array.isArray(datos.lugares)) {
    throw new Error('El archivo no es un respaldo de Paseos.');
  }
  const actuales = lugares();
  const clave = (l) => `${l.nombre}|${l.lat.toFixed(5)}|${l.lon.toFixed(5)}`;
  const existentes = new Set(actuales.map(clave));
  let agregados = 0;
  for (const l of datos.lugares.filter(esLugarValido)) {
    if (existentes.has(clave(l))) continue;
    actuales.push({ id: crypto.randomUUID(), nombre: l.nombre, lat: l.lat, lon: l.lon });
    existentes.add(clave(l));
    agregados++;
  }
  escribir(CLAVE_LUGARES, actuales);
  if (datos.ajustes) guardarAjustes(datos.ajustes);
  if (Array.isArray(datos.conocidas)) agregarConocidas(datos.conocidas.filter((c) => typeof c === 'string'));

  const paseos = historial();
  const ids = new Set(paseos.map((r) => r.id));
  const nuevosPaseos = (Array.isArray(datos.historial) ? datos.historial : []).filter((r) => esRegistroValido(r) && !ids.has(r.id));
  escribir(CLAVE_HISTORIAL, [...paseos, ...nuevosPaseos]);

  if (Array.isArray(datos.metas?.lista) && !metas().lista.length) guardarMetas(datos.metas);

  const favs = favoritas();
  const idsFav = new Set(favs.map((f) => f.id));
  const nuevasFav = (Array.isArray(datos.favoritas) ? datos.favoritas : []).filter((f) => f?.receta && !idsFav.has(f.id));
  escribir(CLAVE_FAVORITAS, [...favs, ...nuevasFav]);

  if (datos.dex) {
    const d = dex();
    // Una captura con foto del respaldo gana a la misma sin foto en este celular.
    for (const [id, c] of Object.entries(datos.dex.capturados || {})) {
      if (!d.capturados[id] || (c?.foto && !d.capturados[id].foto)) d.capturados[id] = c;
    }
    for (const [id, f] of Object.entries(datos.dex.vistos || {})) if (!d.vistos[id]) d.vistos[id] = f;
    // Una nota que ya está en este celular no se pisa.
    for (const [id, n] of Object.entries(datos.dex.notas || {})) if (!d.notas[id] && typeof n === 'string') d.notas[id] = n;
    guardarDex(d);
  }
  return { lugares: agregados, paseos: nuevosPaseos.length };
}
