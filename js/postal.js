// Postal del paseo para compartir (por WhatsApp, por ejemplo): una imagen con el recorrido dibujado, las cifras y lo
// nuevo del Pasaporte. Se dibuja en el celular con un canvas y no usa el mapa de fondo (las teselas de OSM no se
// pueden copiar a una imagen sin permiso de su servidor).

import { formatearDistancia, formatearMinutos, formatearKcal } from './duracion.js';

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

// La cordillera en línea, como al pie de las páginas de la app (mismo dibujo, en un cuadro de 360 × 76).
const CORDILLERA = [
  'M0 52L14 44L24 48L38 30L48 38L62 20L72 30L84 24L98 36L112 22L124 30L138 12L150 26L162 20L176 34L190 18L204 28L218 16L232 30L246 24L260 38L274 26L288 34L302 22L316 32L330 26L344 36L360 30',
  'M0 76V64Q30 50 58 60Q66 56 74 62V76M34 55v-5M32 51.5h4',
  'M250 76V38l3-4 3 4V76M246 76V50h14V76',
  'M110 76V66h10v-6h7v6h12V76M180 76V62h16V76M200 76V68h22V76M290 76V64h12v-4h6v4h10V76',
];
const PAPEL = '#fcfbf8';
const TINTA = '#151515';
const TERRACOTA = '#c0502f';

// Acorta un texto (con "…") hasta que quepa en `ancho` píxeles con la letra actual del canvas.
function ajustar(c, texto, ancho) {
  if (c.measureText(texto).width <= ancho) return texto;
  let corto = texto;
  while (corto.length > 1 && c.measureText(`${corto}…`).width > ancho) corto = corto.slice(0, -1);
  return `${corto.trimEnd()}…`;
}

// Estilo "Pasaporte": papel, tinta y la cordillera al pie. Espera las letras de la app para dibujar con ellas.
export async function dibujarPostal(registro, { capturas = [], semana = '' } = {}) {
  await Promise.all([document.fonts?.load('700 56px "Bricolage Grotesque"'), document.fonts?.load('600 36px "IBM Plex Mono"')]).catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const c = canvas.getContext('2d');
  const fuente = (peso, tamano) => `${peso} ${tamano}px "Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const mono = (peso, tamano) => `${peso} ${tamano}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;

  c.fillStyle = PAPEL;
  c.fillRect(0, 0, ANCHO, ALTO);
  c.strokeStyle = '#e3e0d8';
  c.lineWidth = 3;
  c.strokeRect(36, 36, ANCHO - 72, ALTO - 72);

  c.fillStyle = TERRACOTA;
  c.font = mono(600, 30);
  c.fillText('PASEOS · SANTIAGO', 72, 116);
  const fecha = new Date(registro.inicio).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  c.fillStyle = TINTA;
  c.font = fuente(700, 60);
  c.fillText(fecha.charAt(0).toUpperCase() + fecha.slice(1), 72, 186);
  c.font = fuente(500, 36);
  c.fillStyle = '#57534b';
  c.fillText(registro.titulo, 72, 238);

  // Recorrido
  const caja = { x: 110, y: 300, ancho: ANCHO - 220, alto: 540 };
  if (registro.rastro.length > 1) {
    const puntos = proyectar(registro.rastro, caja);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const [ancho, color] of [[24, 'rgba(192,80,47,0.16)'], [10, TERRACOTA]]) {
      c.strokeStyle = color;
      c.lineWidth = ancho;
      c.beginPath();
      puntos.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
    for (const [[x, y], color] of [[puntos[0], TINTA], [puntos[puntos.length - 1], TERRACOTA]]) {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, 18, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Cifras
  c.fillStyle = TINTA;
  c.font = mono(600, 88);
  c.fillText(formatearDistancia(registro.metros), 72, 1010);
  const minutos = formatearMinutos(Math.round(registro.minutos));
  c.textAlign = 'right';
  c.fillText(minutos, ANCHO - 72, 1010);
  c.textAlign = 'left';
  c.font = fuente(500, 36);
  c.fillStyle = '#57534b';
  const extra = [registro.kcal && `≈ ${formatearKcal(registro.kcal)}`, registro.energicos >= 1 && `${Math.round(registro.energicos)} min a paso enérgico`].filter(Boolean).join(' · ');
  c.fillText(extra, 72, 1066);

  let y = 1132;
  c.font = fuente(600, 34);
  c.fillStyle = TINTA;
  for (const l of capturas.slice(0, 2)) {
    c.fillText(ajustar(c, `Nuevo timbre en tu Pasaporte: ${l.nombre}`, ANCHO - 144), 72, y);
    y += 50;
  }
  if (semana) {
    c.fillStyle = '#57534b';
    c.fillText(semana, 72, Math.max(y, 1200));
  }
  // La cordillera al pie, en terracota.
  // Se escala el dibujo y no el trazo, para que la línea tenga el mismo grosor en todas direcciones.
  const escala = new DOMMatrix([(ANCHO - 72) / 360, 0, 0, 96 / 76, 36, ALTO - 36 - 96]);
  const dibujo = new Path2D();
  for (const d of CORDILLERA) dibujo.addPath(new Path2D(d), escala);
  c.strokeStyle = TERRACOTA;
  c.lineWidth = 3;
  c.lineJoin = 'round';
  c.stroke(dibujo);
  return new Promise((resolver) => canvas.toBlob(resolver, 'image/png'));
}
