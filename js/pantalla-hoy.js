// Pantalla "Hoy" (la de inicio): cómo va la semana, la meta, salir ahora, rutas favoritas y avisos.

import * as almacen from './almacen.js';
import { escapar } from './mapa.js';
import { $ } from './ui.js';
import { estadoSemanas, propuestaMeta, conMeta } from './historial.js';
import { formatearDistancia, formatearMinutos } from './duracion.js';
import { ESTILOS } from './tranquilidad.js';

const CIRCUNFERENCIA = 2 * Math.PI * 50;
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_SIN_RESPALDO = 30;

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
    const fraccion = e.meta ? Math.min(1, e.minutos / e.meta) : 0;
    const anillo = $('#anillo-avance');
    anillo.style.strokeDasharray = `${(fraccion * CIRCUNFERENCIA).toFixed(1)} ${CIRCUNFERENCIA.toFixed(1)}`;
    anillo.classList.toggle('cumplida', fraccion >= 1);
    anillo.style.opacity = fraccion > 0 ? 1 : 0;
    $('#pregunta-meta').hidden = e.meta !== null;
    let detalle;
    if (e.meta === null) detalle = 'Elige una meta semanal para ver tu avance.';
    else if (e.minutos >= e.meta) detalle = `${minutos} de ${e.meta} min: ¡meta cumplida!`;
    else {
      const falta = Math.ceil(e.meta - e.minutos);
      const paseos = Math.max(1, Math.round(falta / 30));
      detalle = `${minutos} de ${e.meta} min. Te faltan ${formatearMinutos(falta)} (${paseos === 1 ? 'un paseo' : `unos ${paseos} paseos`} de 30 min).`;
    }
    $('#semana-titulo').textContent = 'Esta semana';
    const racha = e.seguidas ? ` ${e.seguidas === 1 ? '1 semana cumplida' : `${e.seguidas} semanas cumplidas seguidas`}.` : '';
    $('#semana-detalle').textContent = detalle + racha;
    const hoy = (new Date().getDay() + 6) % 7;
    $('#semana-dias').innerHTML = e.dias
      .map((hubo, i) => `<span class="dia${hubo ? ' hubo' : ''}${i === hoy ? ' hoy' : ''}" title="${hubo ? 'Hubo paseo' : ''}">${DIAS[i]}</span>`)
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
