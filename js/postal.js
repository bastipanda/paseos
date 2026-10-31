// Postal del paseo para compartir (por WhatsApp, por ejemplo): una imagen con el recorrido dibujado, las cifras y lo
// nuevo de la Santiagodex. Se dibuja en el celular con un canvas y no usa el mapa de fondo (las teselas de OSM no se
// pueden copiar a una imagen sin permiso de su servidor).

import { formatearDistancia, formatearMinutos, formatearKcal } from './duracion.js';
import { ICONO_TIPO } from './plazas.js';

const ANCHO = 1080;
const ALTO = 1350;

// Proyecta el recorrido (lat, lon) dentro de un rectángulo, manteniendo las proporciones.
function proyectar(coords, caja) {
  const k = Math.cos((coords[0][0] * Math.PI) / 180);
  const xs = coords.map((p) => p[1] * k);
  const ys = coords.map((p) => -p[0]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const escala = Math.min(caja.ancho / Math.max(maxX - minX, 1e-6), caja.alto / Math.max(maxY - minY, 1e-6));
  const dx = caja.x + (caja.ancho - (maxX - minX) * escala) / 2;
  const dy = caja.y + (caja.alto - (maxY - minY) * escala) / 2;
  return coords.map((_, i) => [dx + (xs[i] - minX) * escala, dy + (ys[i] - minY) * escala]);
}

export function dibujarPostal(registro, { capturas = [], semana = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const c = canvas.getContext('2d');
  const fuente = (peso, tamano) => `${peso} ${tamano}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  const fondo = c.createLinearGradient(0, 0, 0, ALTO);
  fondo.addColorStop(0, '#1d6b4f');
  fondo.addColorStop(1, '#0c2f23');
  c.fillStyle = fondo;
  c.fillRect(0, 0, ANCHO, ALTO);

  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.font = fuente(700, 34);
  c.fillText('PASEOS · SANTIAGO', 72, 110);
  const fecha = new Date(registro.inicio).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  c.fillStyle = '#ffffff';
  c.font = fuente(800, 56);
  c.fillText(fecha.charAt(0).toUpperCase() + fecha.slice(1), 72, 180);
  c.font = fuente(500, 36);
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.fillText(registro.titulo, 72, 232);

  // Recorrido
  const caja = { x: 110, y: 290, ancho: ANCHO - 220, alto: 560 };
  c.fillStyle = 'rgba(255,255,255,0.07)';
  c.beginPath();
  c.roundRect(caja.x - 40, caja.y - 40, caja.ancho + 80, caja.alto + 80, 36);
  c.fill();
  if (registro.rastro.length > 1) {
    const puntos = proyectar(registro.rastro, caja);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const [ancho, color] of [[26, 'rgba(255,255,255,0.18)'], [12, '#ffffff']]) {
      c.strokeStyle = color;
      c.lineWidth = ancho;
      c.beginPath();
      puntos.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
    for (const [[x, y], color] of [[puntos[0], '#7be0b5'], [puntos[puntos.length - 1], '#ffd166']]) {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, 18, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Cifras
  c.fillStyle = '#ffffff';
  c.font = fuente(800, 96);
  c.fillText(formatearDistancia(registro.metros), 72, 1010);
  const minutos = formatearMinutos(Math.round(registro.minutos));
  c.textAlign = 'right';
  c.fillText(minutos, ANCHO - 72, 1010);
  c.textAlign = 'left';
  c.font = fuente(500, 36);
  c.fillStyle = 'rgba(255,255,255,0.8)';
  const extra = [registro.kcal && `≈ ${formatearKcal(registro.kcal)}`, registro.energicos >= 1 && `${Math.round(registro.energicos)} min a paso enérgico`].filter(Boolean).join(' · ');
  c.fillText(extra, 72, 1066);

  let y = 1140;
  c.font = fuente(600, 34);
  c.fillStyle = '#ffd166';
  for (const l of capturas.slice(0, 2)) {
    c.fillText(`${ICONO_TIPO[l.tipo] || '⭐'} Nuevo en la Santiagodex: ${l.nombre}`.slice(0, 52), 72, y);
    y += 50;
  }
  if (semana) {
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.fillText(semana, 72, Math.max(y, 1240));
  }
  return new Promise((resolver) => canvas.toBlob(resolver, 'image/png'));
}
