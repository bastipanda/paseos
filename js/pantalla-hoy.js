// Pantalla "Hoy" (la de inicio): cómo va la semana y propuestas para salir con un motivo ("Para hoy": completar la
// semana, un timbre nuevo cerca y el destino sellado), salir por tiempo, rutas favoritas y avisos.

import * as almacen from './almacen.js';
import { escapar } from './mapa.js';
import { $ } from './ui.js';
import { estadoSemanas, propuestaMeta, conMeta } from './historial.js';
import { formatearDistancia, formatearMinutos, desdeMetros } from './duracion.js';
import { ESTILOS } from './tranquilidad.js';
import { cargarDex } from './datos.js';
import { estadoDe } from './dex.js';
import { distancia } from './geo.js';
import { tipoLugar } from './plazas.js';
import { timbreSVG } from './timbres.js';
import { ubicacionSiHayPermiso, ultimaUbicacion } from './ubicacion.js';
import { ubicacionActual } from './seguimiento.js';

// Los timbres que se proponen están a lo más a esta distancia en línea recta (unos 25 min caminando de ida).
const TIMBRE_MAXIMO = 2000;
const TIMBRE_MINIMO = 80;

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_SIN_RESPALDO = 30;
const GIROS = [-9, 7, -4, 10, -7, 5, -11];
const diaCorto = (d) => d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');

// El día que caminaste queda timbrado: un timbre redondo con la letra y el número del día.
const selloDia = (letra, numero, i) =>
  `<svg class="sello-dia" viewBox="0 0 40 40" style="transform:rotate(${GIROS[i]}deg)" aria-hidden="true">` +
  '<g fill="none" stroke="currentColor" filter="url(#tinta)"><circle cx="20" cy="20" r="16" stroke-width="2.2"/><circle cx="20" cy="20" r="12.5" stroke-width="0.8"/></g>' +
  `<g fill="currentColor" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600"><text x="20" y="18.5" font-size="8">${letra}</text><text x="20" y="27.5" font-size="8">${numero}</text></g></svg>`;

export function iniciarHoy({ salirAhora, salirSellado, irACapturar, abrirFavorita, exportarRespaldo, guardarPendiente, siguiendo }) {
  let semana = null;
  let cercanos = null;
  let cualCercano = 0;

  function mostrar() {
    pintarSemana();
    pintarPropuestas();
    pintarPropuesta();
    pintarAyudaSalir();
    pintarFavoritas();
    pintarRespaldo();
    pintarPendiente();
  }

  function pintarSemana() {
    const { lista } = almacen.metas();
    const e = estadoSemanas(almacen.historial(), lista);
    semana = e;
    const minutos = Math.round(e.minutos);
    $('#anillo-cifra').textContent = minutos;
    $('#semana-meta').textContent = e.meta === null ? 'min' : `de ${e.meta} min`;
    const fraccion = e.meta ? Math.min(1, e.minutos / e.meta) : 0;
    const barra = $('#anillo-avance');
    barra.style.width = `${(fraccion * 100).toFixed(1)}%`;
    barra.classList.toggle('cumplida', fraccion >= 1);
    $('#pregunta-meta').hidden = e.meta !== null;
    let detalle;
    if (e.meta === null) detalle = 'Elige una meta semanal para ver tu avance.';
    else if (e.minutos >= e.meta) detalle = `${minutos} de ${e.meta} min: ¡meta cumplida!`;
    else {
      const falta = Math.ceil(e.meta - e.minutos);
      const paseos = Math.max(1, Math.round(falta / 30));
      detalle = `Te faltan ${formatearMinutos(falta)} (${paseos === 1 ? 'un paseo' : `unos ${paseos} paseos`} de 30 min).`;
    }
    const ahora = new Date();
    const hoy = (ahora.getDay() + 6) % 7;
    const lunes = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - hoy);
    const fechaDe = (i) => new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
    $('#semana-titulo').textContent = `Esta semana · ${diaCorto(lunes)} – ${diaCorto(fechaDe(6))}`;
    const racha = e.seguidas ? ` ${e.seguidas === 1 ? '1 semana cumplida' : `${e.seguidas} semanas cumplidas seguidas`}.` : '';
    $('#semana-detalle').textContent = detalle + racha;
    $('#semana-dias').innerHTML = e.dias
      .map((hubo, i) => {
        const numero = fechaDe(i).getDate();
        const clase = `dia${hubo ? ' hubo' : ''}${i === hoy ? ' hoy' : ''}`;
        return hubo
          ? `<span class="${clase}" title="Caminaste">${selloDia(DIAS[i], numero, i)}</span>`
          : `<span class="${clase}">${DIAS[i]}<small>${numero}</small></span>`;
      })
      .join('');
  }

  // ---------- Para hoy ----------

  // Minutos para completar la semana, redondeados a 5 y entre 15 y 60 (o 30 si ya cumpliste o no hay meta).
  function minutosParaLaSemana() {
    if (!semana?.meta || semana.minutos >= semana.meta) return 30;
    return Math.min(60, Math.max(15, Math.ceil((semana.meta - semana.minutos) / 5) * 5));
  }

  function pintarPropuestas() {
    const caja = $('#propuestas');
    const m = minutosParaLaSemana();
    const fraccion = semana?.meta ? Math.min(1, semana.minutos / semana.meta) : 0;
    let titulo;
    let detalle;
    if (!semana?.meta) [titulo, detalle] = ['Una vuelta de 30 min', 'Elige tu meta semanal y te digo cuánto te falta'];
    else if (semana.minutos >= semana.meta) [titulo, detalle] = ['Ya cumpliste tu semana', 'Una vuelta de 30 min igual suma y se siente bien'];
    else [titulo, detalle] = ['Completa tu semana', `Una vuelta de ${m} min y llegas a ${semana.meta}`];
    const arco = 2 * Math.PI * 12;
    caja.innerHTML = `
      <div class="propuesta">
        <button type="button" class="propuesta-principal" data-accion="semana">
          <svg class="propuesta-icono" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="12" fill="none" stroke="var(--borde)" stroke-width="4"/>
            <circle cx="15" cy="15" r="12" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="${(fraccion * arco).toFixed(1)} ${arco.toFixed(1)}" transform="rotate(-90 15 15)"/></svg>
          <span class="propuesta-texto"><strong>${escapar(titulo)}</strong><span>${escapar(detalle)}</span></span>
          <span class="propuesta-dato">${m}'</span>
        </button>
      </div>
      <div class="propuesta" id="propuesta-timbre"></div>
      <div class="propuesta sellada">
        <div class="propuesta-principal">
          <span class="lacre-grande" aria-hidden="true"></span>
          <span class="propuesta-texto"><strong>Destino sellado</strong><span>Un lugar sin timbrar. Sabrás cuál es al llegar.</span></span>
        </div>
        <div class="chips-sellado">${[15, 30, 45, 60].map((n) => `<button type="button" data-sellado="${n}">${n === 60 ? '1 h' : `${n} min`}</button>`).join('')}</div>
      </div>`;
    caja.querySelector('[data-accion="semana"]').addEventListener('click', () => salirAhora(m));
    caja.querySelectorAll('[data-sellado]').forEach((b) => b.addEventListener('click', () => salirSellado(Number(b.dataset.sellado))));
    pintarTimbreCerca();
  }

  // "Un timbre nuevo cerca": el lugar sin timbrar más cercano (con "Otro" para ver el siguiente). Sin permiso del GPS
  // todavía, la tarjeta lo busca al tocarla.
  async function pintarTimbreCerca(punto = null) {
    const caja = $('#propuesta-timbre');
    if (!caja) return;
    const aj = almacen.ajustes();
    const desde = punto || ultimaUbicacion() || (await ubicacionSiHayPermiso());
    if (!desde) {
      caja.innerHTML = `<button type="button" class="propuesta-principal" data-accion="buscar">
          ${timbreSVG('plaza', { modo: 'punteado', clase: 'propuesta-icono' })}
          <span class="propuesta-texto"><strong>Un timbre nuevo cerca</strong><span>Toca y busco el lugar sin timbrar más cercano a ti</span></span>
        </button>`;
      caja.querySelector('button').addEventListener('click', async () => {
        caja.querySelector('.propuesta-texto span').textContent = 'Buscando tu ubicación…';
        try {
          await pintarTimbreCerca(await ubicacionActual());
        } catch (err) {
          caja.querySelector('.propuesta-texto span').textContent = err.message;
        }
      });
      return;
    }
    try {
      const [dex, estado] = [await cargarDex(), almacen.dex()];
      cercanos = dex
        .map((l) => ({ l, d: distancia(desde, l.punto), e: estadoDe(l, estado) }))
        .filter((x) => x.e !== 'capturado' && x.d >= TIMBRE_MINIMO && x.d <= TIMBRE_MAXIMO)
        .sort((a, b) => a.d - b.d)
        .slice(0, 8);
    } catch {
      cercanos = [];
    }
    if (!$('#propuesta-timbre')) return;
    if (!cercanos.length) {
      caja.innerHTML = `<div class="propuesta-principal">${timbreSVG('plaza', { modo: 'punteado', clase: 'propuesta-icono' })}
        <span class="propuesta-texto"><strong>Un timbre nuevo cerca</strong><span>No hay lugares sin timbrar a menos de ${formatearDistancia(TIMBRE_MAXIMO)}. Prueba el destino sellado.</span></span></div>`;
      return;
    }
    cualCercano %= cercanos.length;
    const { l, d, e } = cercanos[cualCercano];
    const nombre = e === 'nuevo' && !aj.verNombresDex ? `Un lugar por descubrir (${tipoLugar(l)})` : l.nombre;
    const ida = Math.max(1, Math.round(desdeMetros(d * 1.3, 'minutos', aj)));
    caja.innerHTML = `<button type="button" class="propuesta-principal" data-accion="ir" data-tipo="${escapar(l.tipo)}">
        ${timbreSVG(l.tipo, { modo: e === 'falta' ? 'pendiente' : 'punteado', clase: 'propuesta-icono' })}
        <span class="propuesta-texto"><strong>Un timbre nuevo cerca</strong><span>${escapar(nombre)} · a ${ida} min${e === 'falta' ? ' · falta tu foto' : ''}</span></span>
        <span class="propuesta-dato">${Math.round(ida * 2.2)}'</span>
      </button>
      ${cercanos.length > 1 ? '<button type="button" class="propuesta-otro" aria-label="Ver otro lugar cercano">Otro</button>' : ''}`;
    caja.querySelector('[data-accion="ir"]').addEventListener('click', () => irACapturar(l));
    caja.querySelector('.propuesta-otro')?.addEventListener('click', () => {
      cualCercano++;
      pintarTimbreCerca(desde);
    });
  }

  function guardarMeta(minutos) {
    almacen.guardarMetas({ lista: conMeta(almacen.metas().lista, minutos) });
    mostrar();
  }

  document.querySelectorAll('#opciones-meta [data-meta]').forEach((b) =>
    b.addEventListener('click', () => guardarMeta(Number(b.dataset.meta))),
  );

  function pintarPropuesta() {
    const m = almacen.metas();
    const p = propuestaMeta(almacen.historial(), m.lista, new Date(), m.respondida);
    const caja = $('#propuesta-meta');
    caja.hidden = !p;
    if (!p) return;
    $('#propuesta-meta-texto').textContent =
      p.tipo === 'subir'
        ? `La semana pasada caminaste ${Math.round(p.minutos)} min y cumpliste tu meta de ${p.actual}. ¿Subimos a ${p.nueva} min?`
        : `Las últimas dos semanas quedaste lejos de los ${p.actual} min. ¿Bajamos a ${p.nueva} min para retomar el ritmo?`;
    $('#propuesta-aceptar').textContent = p.tipo === 'subir' ? `Subir a ${p.nueva}` : `Bajar a ${p.nueva}`;
    $('#propuesta-aceptar').onclick = () => {
      almacen.guardarMetas({ lista: conMeta(m.lista, p.nueva), respondida: semanaActual() });
      mostrar();
    };
    $('#propuesta-mantener').onclick = () => {
      almacen.guardarMetas({ respondida: semanaActual() });
      mostrar();
    };
  }

  const semanaActual = () => estadoSemanas([], []).clave;

  function pintarAyudaSalir() {
    const f = almacen.formularioGuardado() || {};
    const estilo = ESTILOS[f.estilo]?.nombre || 'Tranquilo';
    const extras = [f.explorar && 'explorando', f.pasarPor?.interes && 'por lugares interesantes'].filter(Boolean);
    $('#ayuda-salir').textContent =
      `Una vuelta desde donde estás, por calles de estilo ${estilo}${extras.length ? `, ${extras.join(' y ')}` : ''} ` +
      '(lo último que elegiste en Armar).';
  }

  document.querySelectorAll('.boton-salir').forEach((b) => b.addEventListener('click', () => salirAhora(Number(b.dataset.minutos))));

  function pintarFavoritas() {
    const lista = almacen.favoritas();
    $('#bloque-favoritas').hidden = !lista.length;
    const ul = $('#lista-favoritas');
    ul.innerHTML = '';
    for (const f of lista) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="nombre">${escapar(f.nombre)} <small class="secundario">${escapar(formatearDistancia(f.metros))}</small></span>
        <button type="button" class="boton-texto" data-accion="ir">Ir</button>
        <button type="button" class="boton-texto" data-accion="renombrar">Renombrar</button>
        <button type="button" class="boton-texto" data-accion="borrar" style="color:var(--peligro)">Borrar</button>`;
      li.querySelector('[data-accion="ir"]').addEventListener('click', () => abrirFavorita(f));
      li.querySelector('[data-accion="renombrar"]').addEventListener('click', () => {
        const nombre = prompt('Nuevo nombre', f.nombre);
        if (nombre && nombre.trim()) {
          almacen.renombrarFavorita(f.id, nombre);
          pintarFavoritas();
        }
      });
      li.querySelector('[data-accion="borrar"]').addEventListener('click', () => {
        if (!confirm(`¿Borrar la favorita "${f.nombre}"?`)) return;
        almacen.borrarFavorita(f.id);
        pintarFavoritas();
      });
      ul.append(li);
    }
  }

  // Los paseos son datos que no se pueden regenerar: una vez al mes se recuerda descargar el respaldo.
  function pintarRespaldo() {
    const caja = $('#aviso-respaldo');
    const conPaseos = almacen.historial().some((r) => r.origen === 'gps');
    const ultimo = Date.parse(almacen.ajustes().ultimoRespaldo || '');
    const dias = Number.isNaN(ultimo) ? Infinity : (Date.now() - ultimo) / 86400000;
    caja.hidden = !conPaseos || dias < DIAS_SIN_RESPALDO;
    if (caja.hidden) return;
    caja.innerHTML = `${Number.isFinite(dias) ? 'Hace más de un mes que no descargas un respaldo.' : 'Todavía no descargas un respaldo de tus paseos.'}
      Si se borran los datos del navegador, se pierden. <button type="button" class="boton-texto">Descargar respaldo</button>`;
    caja.querySelector('button').addEventListener('click', () => {
      exportarRespaldo();
      pintarRespaldo();
    });
  }

  // Un paseo que quedó a medias (por ejemplo, si se cerró el navegador sin "Terminar").
  function pintarPendiente() {
    const p = almacen.paseoEnCurso();
    const caja = $('#paseo-pendiente');
    caja.hidden = !p || siguiendo();
    if (caja.hidden) return;
    const inicio = new Date(p.inicio);
    $('#paseo-pendiente-texto').textContent =
      `Quedó un paseo sin terminar (${inicio.toLocaleString('es-CL', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}). ` +
      '¿Lo guardo en el historial?';
    $('#pendiente-guardar').onclick = () => {
      guardarPendiente(p);
      mostrar();
    };
    $('#pendiente-descartar').onclick = () => {
      almacen.borrarPaseoEnCurso();
      mostrar();
    };
  }

  return { mostrar };
}
