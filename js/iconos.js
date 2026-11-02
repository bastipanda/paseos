// Íconos de línea propios (en vez de emojis, que traen cada uno su estilo y color). Todos en un cuadro de 24 × 24,
// del color del texto que los rodea.

import { TIPOS_DEX } from './dex.js';
import { iconoTipo } from './timbres.js';

const TRAZOS = {
  camara: 'M4 8h3l2-3h6l2 3h3v11H4z M12 10.5a3 3 0 1 1 0 6a3 3 0 1 1 0-6',
  galeria: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M9 8.5a1.2 1.2 0 1 1 0 .1',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z M12 7a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5',
  bandera: 'M6 21V4h11l-2.5 4.5L17 13H6',
  bici: 'M6 17.5a3.5 3.5 0 1 1 0-.1 M18 17.5a3.5 3.5 0 1 1 0-.1 M6 17.5l4-7h5l3 7 M9 7h3 M15 10.5l-1.5-3.5H16',
  metro: 'M5 19V6l7 8 7-8v13',
  reloj: 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16 M12 8v4l3 2',
  sobre: 'M4 6h16v12H4z M4 7l8 6 8-6',
  ojo: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z M12 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  vuelta: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3 M19.5 4.5v4h-4',
  lupa: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13 M15.5 15.5L20 20',
  guardado: 'M7 4h10v16l-5-4-5 4z',
  tramite: 'M6 7h12l-1 13H7z M9 7a3 3 0 0 1 6 0',
  mira: 'M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8 M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3',
  supermercado: 'M3 5h3l2.2 10h10L20 8H7 M9.5 19a1.3 1.3 0 1 1 0-.1 M17 19a1.3 1.3 0 1 1 0-.1',
  farmacia: 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z',
  panaderia: 'M4 15c0-5 3.6-8 8-8s8 3 8 8v3H4z M9 10.5v3 M12 9.5v4 M15 10.5v3',
  feria: 'M4 10h16l-2 9H6z M8 10l4-6 4 6',
  cajero: 'M3 6h18v12H3z M3 10h18 M7 15h4',
  ferreteria: 'M14 4l6 6-3 3-6-6z M11.5 6.5L3 15l3 3 8.5-8.5',
};

export function icono(nombre, clase = '') {
  const d = TRAZOS[nombre] || TRAZOS.pin;
  return `<svg class="ico ${clase}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// El ícono de un lugar: la forma de su timbre si es de la Dex; si no, el de su tipo (trámites, estaciones) o un pin.
export function iconoLugar(tipo, clase = '') {
  if (TIPOS_DEX.includes(tipo)) return iconoTipo(tipo, clase);
  return icono(tipo === 'estacion' ? 'metro' : tipo, clase);
}
