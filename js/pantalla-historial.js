// Pantalla "Historial": paseos hechos, minutos por semana y paseos agregados a mano.

import * as almacen from './almacen.js';
import { escapar } from './mapa.js';
import { $, mostrarEstado, formatearFecha, formatearHora } from './ui.js';
import { totales, ultimasSemanas, registroAMano, claveDia } from './historial.js';
import { formatearDistancia, formatearMinutos, formatearKcal } from './duracion.js';

export function iniciarHistorial({ mapa, margenes, verEnMapa, alCambiar }) {
  function mostrar() {
    const lista = almacen.historial();
    const ahora = new Date();
    const delMes = lista.filter((r) => {
      const d = new Date(r.inicio);
      return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    });
    const t = totales(delMes);
    $('#historial-totales').textContent = lista.length
      ? `Este mes: ${t.paseos} ${t.paseos === 1 ? 'paseo' : 'paseos'}, ${formatearMinutos(Math.round(t.minutos))}, ` +
        `${formatearDistancia(t.metros)}${t.kcal ? `, ≈ ${formatearKcal(t.kcal)}` : ''}.`
      : 'Todavía no hay paseos. Cada paseo con seguimiento se guarda solo al terminar.';
    pintarGrafico(lista);
    pintarLista(lista);
    $('#ver-todos').hidden = !lista.some((r) => r.rastro.length > 1);
    mapa.limpiarRuta();
  }

  // Barras de las últimas 8 semanas, con una raya donde está la meta de cada una.
  function pintarGrafico(lista) {
    const semanas = ultimasSemanas(lista, almacen.metas().lista, 8);
    const tope = Math.max(60, ...semanas.map((s) => Math.max(s.minutos, s.meta || 0)));
    $('#grafico-semanas').innerHTML = semanas
      .map((s) => {
        const alto = (s.minutos / tope) * 100;
        const meta = s.meta ? `<i class="raya-meta" style="bottom:${(s.meta / tope) * 100}%"></i>` : '';
        const cumplida = s.meta && s.minutos >= s.meta ? ' cumplida' : '';
        const [, mes, dia] = s.clave.split('-');
        return `<div class="columna" title="${Math.round(s.minutos)} min">
          <div class="pozo">${meta}<span class="barra${cumplida}" style="height:${alto.toFixed(1)}%"></span></div>
          <small>${Number(dia)}/${Number(mes)}</small></div>`;
      })
      .join('');
  }

  function pintarLista(lista) {
    const ul = $('#lista-historial');
    ul.innerHTML = '';
    for (const r of lista.slice(0, 60)) {
      const inicio = new Date(r.inicio);
      const li = document.createElement('li');
      const cifras = [formatearMinutos(Math.round(r.minutos)), formatearDistancia(r.metros), r.kcal && `≈ ${formatearKcal(r.kcal)}`]
        .filter(Boolean)
        .join(' · ');
      li.innerHTML = `<button type="button" class="paseo" ${r.rastro.length > 1 ? '' : 'disabled'}>
          <strong>${escapar(formatearFecha(inicio))}, ${escapar(formatearHora(inicio))}</strong>
          <span>${escapar(r.titulo)}${r.origen === 'mano' ? ' (a mano)' : ''}</span>
          <span class="secundario">${escapar(cifras)}</span>
        </button>
        <button type="button" class="boton-texto" style="color:var(--peligro)">Borrar</button>`;
      li.querySelector('.paseo').addEventListener('click', () => {
        verEnMapa(`${formatearFecha(inicio)}, ${formatearHora(inicio)}`);
        mapa.mostrarRecorridos([r.rastro], margenes());
      });
      li.querySelector('.boton-texto').addEventListener('click', () => {
        if (!confirm(`¿Borrar el paseo del ${formatearFecha(inicio)}? No se puede deshacer (salvo con un respaldo).`)) return;
        almacen.borrarDelHistorial(r.id);
        mostrar();
        alCambiar();
      });
      ul.append(li);
    }
    if (lista.length > 60) {
      const li = document.createElement('li');
      li.className = 'vacia';
      li.textContent = `Y ${lista.length - 60} paseos más antiguos (están en el respaldo).`;
      ul.append(li);
    }
  }

  $('#ver-todos').addEventListener('click', () => {
    verEnMapa('Todos tus paseos');
    mapa.mostrarRecorridos(almacen.historial().map((r) => r.rastro), margenes());
  });

  $('#agregar-paseo').addEventListener('toggle', () => {
    if (!$('#agregar-paseo').open) return;
    const ahora = new Date();
    if (!$('#paseo-fecha').value) $('#paseo-fecha').value = `${claveDia(ahora)}T${String(ahora.getHours()).padStart(2, '0')}:00`;
  });

  $('#paseo-agregar').addEventListener('click', () => {
    const aviso = $('#estado-historial');
    const fecha = $('#paseo-fecha').value;
    const minutos = Number($('#paseo-minutos').value);
    const km = $('#paseo-km').value === '' ? null : Number($('#paseo-km').value);
    if (!fecha || Number.isNaN(Date.parse(fecha))) return mostrarEstado(aviso, 'Elige la fecha y hora del paseo.', true);
    if (!(minutos >= 1 && minutos <= 600)) return mostrarEstado(aviso, 'Escribe cuántos minutos caminaste (1 a 600).', true);
    if (km !== null && !(km > 0 && km < 80)) return mostrarEstado(aviso, 'Los kilómetros deben ser un número mayor que cero.', true);
    const ok = almacen.agregarAlHistorial(registroAMano({ fecha, minutos, km, ajustes: almacen.ajustes() }));
    if (!ok) return mostrarEstado(aviso, 'No se pudo guardar: el navegador no tiene espacio o bloquea el almacenamiento.', true);
    $('#paseo-minutos').value = '';
    $('#paseo-km').value = '';
    $('#agregar-paseo').open = false;
    mostrar();
    mostrarEstado(aviso, 'Paseo agregado.');
    alCambiar();
  });

  return { mostrar };
}
