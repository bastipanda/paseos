// Lugares guardados y ajustes, en el navegador (localStorage). Nunca salen del celular salvo que se
// exporten a mano. El navegador puede borrar estos datos o bloquearlos (modo incógnito): por eso cada
// lectura y escritura está protegida y existe el respaldo en archivo.

import { AJUSTES_POR_DEFECTO } from './duracion.js';

const CLAVE_LUGARES = 'paseos.lugares';
const CLAVE_AJUSTES = 'paseos.ajustes';
const CLAVE_FORMULARIO = 'paseos.formulario';

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

// Respaldo: un archivo JSON con los lugares y ajustes.
export function respaldo() {
  return {
    app: 'paseos',
    version: 1,
    fecha: new Date().toISOString(),
    lugares: lugares(),
    ajustes: ajustes(),
  };
}

// Restaura un respaldo. Los lugares se suman a los existentes (sin duplicar por nombre y posición).
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
  return agregados;
}
