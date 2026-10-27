// Seguimiento en vivo: lee el GPS, ubica la posición sobre la ruta y calcula lo que falta.
// También mantiene la pantalla encendida mientras dura el paseo (si el navegador lo permite).

import { acumuladas, ubicarEnLinea } from './geo.js';

const FUERA_DE_RUTA_M = 40;

export function unirPartes(partes) {
  const coords = [];
  const limites = [];
  for (const parte of partes) {
    const inicio = Math.max(0, coords.length - 1);
    coords.push(...(coords.length ? parte.ruta.coords.slice(1) : parte.ruta.coords));
    limites.push({ modo: parte.modo, desdeIndice: inicio, hastaIndice: coords.length - 1 });
  }
  const acc = acumuladas(coords);
  return {
    coords,
    acc,
    total: acc[acc.length - 1] || 0,
    tramos: limites.map((l) => ({ modo: l.modo, desde: acc[l.desdeIndice], hasta: acc[l.hastaIndice] })),
  };
}

// Cuánto falta en total, a pie y en bici, desde `recorrido` metros.
export function faltante(linea, recorrido) {
  let pie = 0;
  let bici = 0;
  let modoActual = linea.tramos[0]?.modo || 'pie';
  for (const t of linea.tramos) {
    const resto = Math.max(0, t.hasta - Math.max(t.desde, recorrido));
    if (t.modo === 'bici') bici += resto;
    else pie += resto;
    if (recorrido >= t.desde && recorrido < t.hasta) modoActual = t.modo;
  }
  return { total: Math.max(0, linea.total - recorrido), pie, bici, modoActual };
}

export class Seguimiento {
  constructor(opcion, { alActualizar, alError }) {
    this.linea = unirPartes(opcion.partes);
    this.alActualizar = alActualizar;
    this.alError = alError;
    this.indice = 0;
    this.recorrido = 0;
    this.idGps = null;
    this.bloqueo = null;
    this.alVolver = () => {
      if (document.visibilityState === 'visible' && this.idGps !== null) this.mantenerPantalla();
    };
  }

  iniciar() {
    if (!('geolocation' in navigator)) {
      this.alError('Este navegador no da acceso al GPS.');
      return;
    }
    this.idGps = navigator.geolocation.watchPosition(
      (pos) => this.nuevaPosicion(pos),
      (err) => this.alError(mensajeGps(err)),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    this.mantenerPantalla();
    document.addEventListener('visibilitychange', this.alVolver);
  }

  detener() {
    if (this.idGps !== null) navigator.geolocation.clearWatch(this.idGps);
    this.idGps = null;
    document.removeEventListener('visibilitychange', this.alVolver);
    this.bloqueo?.release().catch(() => {});
    this.bloqueo = null;
  }

  async mantenerPantalla() {
    try {
      if ('wakeLock' in navigator) this.bloqueo = await navigator.wakeLock.request('screen');
    } catch {
      // Sin bloqueo de pantalla el seguimiento funciona igual; solo se puede apagar la pantalla.
    }
  }

  nuevaPosicion(pos) {
    const punto = [pos.coords.latitude, pos.coords.longitude];
    const { coords, acc } = this.linea;
    const ubicacion = ubicarEnLinea(coords, acc, punto, this.indice);
    if (ubicacion && ubicacion.distancia <= FUERA_DE_RUTA_M) {
      this.indice = ubicacion.indice;
      this.recorrido = ubicacion.recorrido;
    }
    this.alActualizar({
      punto,
      precision: pos.coords.accuracy,
      fueraDeRuta: !ubicacion || ubicacion.distancia > FUERA_DE_RUTA_M,
      distanciaARuta: ubicacion ? ubicacion.distancia : null,
      recorrido: this.recorrido,
      faltante: faltante(this.linea, this.recorrido),
      total: this.linea.total,
    });
  }
}

export function mensajeGps(err) {
  if (err.code === 1) return 'No diste permiso para usar tu ubicación. Actívalo en los ajustes del navegador.';
  if (err.code === 2) return 'No se pudo obtener tu ubicación. Revisa que el GPS esté encendido.';
  if (err.code === 3) return 'El GPS está tardando en responder.';
  return 'Error de GPS.';
}

// Pide la ubicación una sola vez (para usarla como partida o término).
export function ubicacionActual() {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) {
      rechazar(new Error('Este navegador no da acceso al GPS.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolver([pos.coords.latitude, pos.coords.longitude]),
      (err) => rechazar(new Error(mensajeGps(err))),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
    );
  });
}
