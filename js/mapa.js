// Todo lo que se dibuja en el mapa (Leaflet, cargado como script global `L` en index.html).

import { categoria } from './tranquilidad.js';
import { describirTramo } from './explicar.js';
import { nombreLugar, tipoLugar } from './plazas.js';

export const COLORES = { buena: '#1a9850', media: '#e0a100', mala: '#d73027' };
const CENTRO_SANTIAGO = [-33.4372, -70.6106];

const icono = (clase, texto = '', tamano = 30) =>
  L.divIcon({
    className: '',
    html: `<div class="marcador ${clase}">${texto}</div>`,
    iconSize: [tamano, tamano],
    iconAnchor: [tamano / 2, tamano / 2],
  });

export class Mapa {
  constructor(elemento) {
    this.mapa = L.map(elemento, { zoomControl: false }).setView(CENTRO_SANTIAGO, 13);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.mapa);
    L.control.zoom({ position: 'topright' }).addTo(this.mapa);
    this.capaRuta = L.layerGroup().addTo(this.mapa);
    this.capaPuntos = L.layerGroup().addTo(this.mapa);
    this.capaEstaciones = L.layerGroup();
    this.yo = null;
    this.precision = null;
  }

  alTocar(funcion) {
    this.mapa.on('click', (e) => funcion([e.latlng.lat, e.latlng.lng]));
  }

  // Marcadores de partida y término mientras se arma la búsqueda.
  mostrarPuntos(partida, termino) {
    this.capaPuntos.clearLayers();
    if (partida) L.marker(partida, { icon: icono('partida', 'A') }).addTo(this.capaPuntos);
    if (termino) L.marker(termino, { icon: icono('termino', 'B') }).addTo(this.capaPuntos);
  }

  // Dibuja una opción: cada tramo con el color de su calidad. Los tramos en bici van con línea punteada.
  dibujarOpcion(opcion, margenes = {}) {
    this.capaRuta.clearLayers();
    const limites = L.latLngBounds([]);
    for (const parte of opcion.partes) {
      const { coords, tramos } = parte.ruta;
      L.polyline(coords, { color: '#ffffff', weight: 9, opacity: 0.9, interactive: false }).addTo(this.capaRuta);
      const piezas = tramos.length ? tramos : [{ desde: 0, hasta: coords.length - 1, tags: {} }];
      for (const t of piezas) {
        const tramo = coords.slice(t.desde, t.hasta + 1);
        if (tramo.length < 2) continue;
        L.polyline(tramo, {
          color: COLORES[categoria(t.tags, parte.modo, opcion.estilo)],
          weight: 5,
          opacity: 0.95,
          dashArray: parte.modo === 'bici' ? '10 7' : null,
          lineCap: parte.modo === 'bici' ? 'butt' : 'round',
          interactive: false,
        }).addTo(this.capaRuta);
        // Línea invisible y gruesa encima, para que sea fácil tocar el tramo con el dedo y ver qué es.
        const { titulo, detalle } = describirTramo(t.tags, parte.modo, opcion.estilo);
        L.polyline(tramo, { color: '#000', weight: 22, opacity: 0 })
          .bindPopup(`<strong>${escapar(titulo)}${parte.modo === 'bici' ? ' (en bici)' : ''}</strong><br>${escapar(detalle)}`)
          .addTo(this.capaRuta);
      }
      coords.forEach((c) => limites.extend(c));
    }
    const primera = opcion.partes[0].ruta.coords;
    const ultima = opcion.partes[opcion.partes.length - 1].ruta.coords;
    L.marker(primera[0], { icon: icono('partida', 'A') }).addTo(this.capaRuta);
    if (!sonCercanos(primera[0], ultima[ultima.length - 1])) {
      L.marker(ultima[ultima.length - 1], { icon: icono('termino', 'B') }).addTo(this.capaRuta);
    }
    const extras = opcion.extras || {};
    for (const l of (extras.plazas || []).filter((p) => p !== opcion.plaza).slice(0, 8)) {
      L.marker(l.punto, { icon: icono('lugar-ruta', '', 14) })
        .bindTooltip(escapar(nombreLugar(l)))
        .addTo(this.capaRuta);
    }
    for (const l of (extras.interes || []).slice(0, 10)) {
      L.marker(l.punto, { icon: icono('interes', '★', 22) })
        .bindPopup(() => popupInteres(l))
        .addTo(this.capaRuta);
    }
    for (const s of extras.servicios || []) {
      L.marker(s.punto, { icon: icono('servicio', s.tipo === 'agua' ? '💧' : '🚻', 22) })
        .bindTooltip(escapar(s.nombre || nombreLugar(s)))
        .addTo(this.capaRuta);
    }
    if (opcion.plaza) {
      L.marker(opcion.plaza.punto, { icon: icono('plaza', '🌳') })
        .bindPopup(`<strong>${escapar(nombreLugar(opcion.plaza))}</strong><br>Destino del paseo (${tipoLugar(opcion.plaza)})`)
        .addTo(this.capaRuta);
    }
    for (const e of [opcion.estacionSalida, opcion.estacionLlegada].filter(Boolean)) {
      L.marker(e.punto, { icon: icono('estacion', '🚲') })
        .bindPopup(`<strong>${escapar(e.nombre)}</strong><br>${e.bicis} bicis · ${e.anclajes} anclajes libres`)
        .addTo(this.capaRuta);
    }
    this.capaPuntos.clearLayers();
    if (limites.isValid()) this.encuadrar(limites, margenes);
  }

  limpiarRuta() {
    this.capaRuta.clearLayers();
    this.ocultarCorto();
  }

  // Modo explorar: los cuadros que ya conoces, en morado transparente.
  mostrarConocidas(rectangulos) {
    if (!this.capaConocidas) this.capaConocidas = L.layerGroup();
    this.capaConocidas.clearLayers();
    const renderer = this.rendererCanvas || (this.rendererCanvas = L.canvas({ padding: 0.3 }));
    for (const r of rectangulos) {
      L.rectangle(r, { renderer, stroke: false, fillColor: '#7e57c2', fillOpacity: 0.35, interactive: false }).addTo(this.capaConocidas);
    }
    this.capaConocidas.addTo(this.mapa);
  }

  ocultarConocidas() {
    this.capaConocidas?.remove();
  }

  // El camino más corto, en gris punteado, para comparar con la ruta elegida.
  mostrarCorto(coords) {
    this.ocultarCorto();
    this.lineaCorta = L.polyline(coords, { color: '#555', weight: 4, opacity: 0.7, dashArray: '2 8', interactive: false }).addTo(this.mapa);
  }

  ocultarCorto() {
    this.lineaCorta?.remove();
    this.lineaCorta = null;
  }

  // `margenes` deja espacio para el panel, que tapa parte del mapa (abajo en celular, a la izquierda en pantalla ancha).
  encuadrar(limites, { abajo = 0, izquierda = 0 } = {}) {
    this.mapa.fitBounds(limites, { paddingTopLeft: [20 + izquierda, 70], paddingBottomRight: [20, 20 + abajo] });
  }

  // Muestra los lugares guardados como puntos morados (solo en la vista de lugares).
  mostrarLugares(lugares) {
    this.capaPuntos.clearLayers();
    for (const l of lugares) {
      L.marker([l.lat, l.lon], { icon: icono('lugar', '★', 24) })
        .bindTooltip(escapar(l.nombre))
        .addTo(this.capaPuntos);
    }
  }

  centrarEn(punto, zoom) {
    this.mapa.setView(punto, zoom ?? Math.max(this.mapa.getZoom(), 16));
  }

  mostrarYo(punto, precision) {
    if (!this.yo) {
      this.yo = L.marker(punto, {
        icon: L.divIcon({ className: '', html: '<div class="yo"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        zIndexOffset: 1000,
        interactive: false,
      }).addTo(this.mapa);
      this.precision = L.circle(punto, { radius: precision, color: '#1e88e5', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(this.mapa);
    } else {
      this.yo.setLatLng(punto);
      this.precision.setLatLng(punto).setRadius(precision);
    }
  }

  ocultarYo() {
    this.yo?.remove();
    this.precision?.remove();
    this.yo = null;
    this.precision = null;
  }

  mostrarEstaciones(estaciones) {
    this.capaEstaciones.clearLayers();
    for (const e of estaciones) {
      const vacia = !e.operativa || e.bicis === 0;
      L.marker(e.punto, {
        icon: L.divIcon({ className: '', html: `<div class="punto-estacion${vacia ? ' vacia' : ''}"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] }),
      })
        .bindPopup(`<strong>${escapar(e.nombre)}</strong><br>${e.bicis} bicis · ${e.anclajes} anclajes libres`)
        .addTo(this.capaEstaciones);
    }
    this.capaEstaciones.addTo(this.mapa);
  }

  ocultarEstaciones() {
    this.capaEstaciones.remove();
  }

  invalidar() {
    this.mapa.invalidateSize();
  }
}

// Popup de un lugar interesante. Si tiene artículo en Wikipedia, se carga el resumen al abrirlo.
function popupInteres(lugar) {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${escapar(nombreLugar(lugar))}</strong><br><span>${escapar(tipoLugar(lugar))}</span>`;
  const m = /^(\w{2,3}):(.+)$/.exec(lugar.wikipedia || '');
  if (m) {
    const resumen = document.createElement('p');
    resumen.className = 'resumen-wiki';
    resumen.textContent = 'Cargando resumen de Wikipedia…';
    div.append(resumen);
    const [, idioma, titulo] = m;
    fetch(`https://${idioma}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo.replace(/ /g, '_'))}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((j) => {
        resumen.textContent = j.extract ? `${j.extract.slice(0, 280)}${j.extract.length > 280 ? '…' : ''}` : '';
        if (j.content_urls?.mobile?.page) {
          const a = document.createElement('a');
          a.href = j.content_urls.mobile.page;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = ' Leer en Wikipedia';
          resumen.append(a);
        }
      })
      .catch(() => resumen.remove());
  }
  return div;
}

function sonCercanos(a, b) {
  return Math.abs(a[0] - b[0]) < 0.0008 && Math.abs(a[1] - b[1]) < 0.0008;
}

export function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
