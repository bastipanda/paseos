// Pequeñas utilidades de pantalla que usan varias partes de la app.

import { ErrorDeRuta } from './brouter.js';

export const $ = (selector) => document.querySelector(selector);

export function mostrarEstado(elemento, texto, esError = false) {
  elemento.textContent = texto;
  elemento.classList.toggle('error', esError);
}

export function mensajeDeError(err) {
  if (err instanceof ErrorDeRuta) return err.message;
  if (err instanceof TypeError) return 'No hay conexión o un servicio no respondió. Intenta de nuevo.';
  return err?.message || 'Algo falló.';
}

// En el celular intenta abrir el menú de compartir (para elegir una app); si no se puede, descarga el archivo.
export async function compartirODescargar(archivo, titulo) {
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: titulo });
      return 'compartido';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelado';
    }
  }
  descargar(archivo);
  return 'descargado';
}

export function descargar(archivo) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = archivo.name;
  enlace.click();
  // Un minuto de margen: el respaldo con fotos pesa varios MB y el celular puede tardar en leerlo.
  setTimeout(() => URL.revokeObjectURL(enlace.href), 60000);
}

const fechaCorta = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
const hora = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

export const formatearFecha = (d) => fechaCorta.format(d);
export const formatearHora = (d) => hora.format(d);
