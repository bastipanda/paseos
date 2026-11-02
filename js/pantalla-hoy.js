// Pantalla "Hoy" (la de inicio): cómo va la semana, la meta, salir ahora, rutas favoritas y avisos.

import * as almacen from './almacen.js';
import { escapar } from './mapa.js';
import { $ } from './ui.js';
import { estadoSemanas, propuestaMeta, conMeta } from './historial.js';
import { formatearDistancia, formatearMinutos } from './duracion.js';
import { ESTILOS } from './tranquilidad.js';

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_SIN_RESPALDO = 30;
const GIROS = [-9, 7, -4, 10, -7, 5, -11];
const diaCorto = (d) => d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');

// El día que caminaste queda timbrado: un timbre redondo con la letra y el número del día.
const selloDia = (letra, numero, i) =>
  `<svg class="sello-dia" viewBox="0 0 40 40" style="transform:rotate(${GIROS[i]}deg)" aria-hidden="true">` +
  '<g fill="none" stroke="currentColor" filter="url(#tinta)"><circle cx="20" cy="20" r="16" stroke-width="2.2"/><circle cx="20" cy="20" r="12.5" stroke-width="0.8"/></g>' +
  `<g fill="currentColor" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600"><text x="20" y="18.5" font-size="8">${letra}</text><text x="20" y="27.5" font-size="8">${numero}</text></g></svg>`;

export function iniciarHoy({ salirAhora, abrirFavorita, exportarRespaldo, guardarPendiente, siguiendo }) {
  function mostrar() {
    pintarSemana();
    pintarPropuesta();
    pintarAyudaSalir();
    pintarFavoritas();
    pintarRespaldo();
    pintarPendiente();
  }

  function pintarSemana() {
    const { lista } = almacen.metas();
    const e = estadoSemanas(almacen.historial(), lista);
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
      `Ida y vuelta desde donde estás, estilo ${estilo}${extras.length ? `, ${extras.join(' y ')}` : ''}. ` +
      'Usa lo último que elegiste en "Armar".';
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
