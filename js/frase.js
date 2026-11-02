// Armar como una frase para completar (v1.9): "Quiero caminar [30 min] desde [donde estoy] y [volver al inicio] por
// calles [tranquilas]". Cada caja abre una hoja con sus opciones en palabras de persona. Por debajo siguen las piezas
// del formulario de siempre (las listas de partida y término, mínimo y máximo, los botones de estilo y los detalles):
// este módulo solo las muestra de otra forma y avisa sus cambios con los mismos eventos, así app.js no cambia su
// lógica de búsqueda.

import * as almacen from './almacen.js';
import { $ } from './ui.js';
import { escapar } from './mapa.js';
import { icono } from './iconos.js';
import { iconoTipo } from './timbres.js';
import { aMetros, resumen, formatearPasos, formatearDistancia, formatearMinutos, formatearKcal } from './duracion.js';

const TITULOS = { tiempo: '¿Cuánto quieres caminar?', desde: '¿Desde dónde?', hasta: '¿Hasta dónde?', estilo: '¿Por qué calles?' };

// [título, para qué, ícono] de cada opción de las listas de partida y término.
const OPCIONES = {
  gps: ['Donde estoy', 'Tu ubicación al momento de buscar', () => icono('mira')],
  mapa: ['Un punto del mapa', 'Lo marcas tocando el mapa', () => icono('pin')],
  buscar: ['Una dirección', 'Calle y número, o el nombre de un lugar', () => icono('lupa')],
  metro: ['Una estación de metro', 'Llegas en metro y partes de ahí', () => icono('metro')],
  igual: ['Volver al inicio', 'Una vuelta, sin repetir calles', () => icono('vuelta')],
  timbre: ['Un timbre nuevo', 'Un lugar del Pasaporte que no tienes, a la distancia justa', () => iconoTipo('plaza')],
  plaza: ['Una plaza', 'La que calce con tu tiempo, y volver', () => icono('pin')],
  tramite: ['Un trámite', 'Súper, farmacia o lo que necesites, y volver', () => icono('tramite')],
  'metro-calce': ['El metro que calce', 'Terminas en una estación y vuelves en metro', () => icono('metro')],
};
const DESTINOS = ['igual', 'timbre', 'plaza', 'tramite', 'metro-calce'];
// Para el término, las opciones de punto llevan otro título ("Donde estoy" no se entiende como destino).
const COMO_TERMINO = { gps: ['Mi ubicación', 'Donde estés al momento de buscar'], metro: ['Una estación de metro', 'Terminas ahí y vuelves en metro'] };
// Las que necesitan algo más (elegir la estación, buscar la dirección, el trámite): la hoja queda abierta.
const CON_EXTRA = ['buscar', 'metro', 'tramite'];

const ESTILO_EN_FRASE = { tranquilo: 'tranquilas', vida: 'con vida', noche: 'iluminadas' };
const UNIDAD_CORTA = { minutos: 'min', pasos: 'pasos', km: 'km', kcal: 'kcal' };
const RAPIDOS = { minutos: [15, 30, 45, 60, 90], pasos: [2000, 4000, 6000, 8000, 10000], km: [1, 2, 3, 5, 8], kcal: [100, 150, 200, 300] };

let deps = null;

const unidad = () => document.querySelector('input[name="unidad"]:checked').value;
const numero = (v, u) => (u === 'km' ? v.toLocaleString('es-CL', { maximumFractionDigits: 1 }) : Math.round(v).toLocaleString('es-CL'));

function redondear(valor, u) {
  if (u === 'pasos') return Math.round(valor / 100) * 100;
  if (u === 'minutos') return Math.round(valor);
  if (u === 'kcal') return Math.round(valor / 10) * 10;
  return Math.round(valor * 10) / 10;
}

/**
 * deps: puntos() → { partida, termino } elegidos; textoMandado() → cómo se dice el trámite elegido (o null).
 */
export function iniciarFrase(dependencias) {
  deps = dependencias;
  document.querySelectorAll('#frase .hueco').forEach((b) => b.addEventListener('click', () => abrirHoja(b.dataset.hoja)));
  $('#hoja-fondo').addEventListener('click', cerrarHoja);
  $('#hoja-listo').addEventListener('click', cerrarHoja);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#hoja').hidden) cerrarHoja();
  });
  document.querySelectorAll('input[name="estilo"]').forEach((r) => r.addEventListener('change', () => setTimeout(cerrarHoja, 150)));
  document.querySelectorAll('input[name="unidad"]').forEach((r) => r.addEventListener('change', () => pintarRapidos()));
  for (const [chip, valor] of [['#chip-sin-subidas', 'evitar'], ['#chip-con-subidas', 'buscar']]) {
    $(chip).addEventListener('change', () => {
      const radio = document.querySelector(`input[name="subidas"][value="${$(chip).checked ? valor : 'igual'}"]`);
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      sincronizarSubidas();
    });
  }
}

function sincronizarSubidas() {
  const v = document.querySelector('input[name="subidas"]:checked').value;
  $('#chip-sin-subidas').checked = v === 'evitar';
  $('#chip-con-subidas').checked = v === 'buscar';
}

function abrirHoja(cual) {
  $('#hoja-titulo').textContent = TITULOS[cual];
  document.querySelectorAll('#hoja section').forEach((s) => {
    s.hidden = s.dataset.hoja !== cual;
  });
  if (cual === 'desde') pintarOpciones('partida');
  if (cual === 'hasta') pintarOpciones('termino');
  if (cual === 'tiempo') pintarRapidos();
  $('#hoja').hidden = false;
  $('#hoja-fondo').hidden = false;
  document.body.classList.add('con-hoja');
  $('#hoja').scrollTop = 0;
}

export function cerrarHoja() {
  $('#hoja').hidden = true;
  $('#hoja-fondo').hidden = true;
  document.body.classList.remove('con-hoja');
  pintarFrase();
}

// Las opciones de la hoja "desde" o "hasta", sacadas de la lista de siempre (así entran también los lugares guardados).
function pintarOpciones(cual) {
  const select = $(`#${cual}-tipo`);
  const ul = $(cual === 'partida' ? '#opciones-desde' : '#opciones-hasta');
  const fila = (o) => {
    const guardado = o.value.startsWith('lugar:');
    const [titulo, para, ico] = guardado
      ? [o.textContent, 'Lugar guardado', () => icono('guardado')]
      : [...(cual === 'termino' && COMO_TERMINO[o.value] ? COMO_TERMINO[o.value] : OPCIONES[o.value] || [o.textContent, '']), OPCIONES[o.value]?.[2] || (() => icono('pin'))];
    const elegida = select.value === o.value;
    return `<li><button type="button" class="opcion${elegida ? ' elegida' : ''}" data-valor="${escapar(o.value)}" aria-pressed="${elegida}">
      <span class="opcion-icono">${ico()}</span><span class="opcion-texto"><strong>${escapar(titulo)}</strong>${para ? `<span>${escapar(para)}</span>` : ''}</span>
      ${elegida ? icono('check', 'opcion-check') : ''}</button></li>`;
  };
  const opciones = [...select.querySelectorAll('option')];
  if (cual === 'termino') {
    const destinos = opciones.filter((o) => DESTINOS.includes(o.value));
    const puntos = opciones.filter((o) => !DESTINOS.includes(o.value));
    ul.innerHTML = destinos.map(fila).join('') + '<li class="opciones-separador">O termina en otro punto</li>' + puntos.map(fila).join('');
  } else {
    ul.innerHTML = opciones.map(fila).join('');
  }
  ul.querySelectorAll('[data-valor]').forEach((b) =>
    b.addEventListener('click', () => {
      const valor = b.dataset.valor;
      // "Tocar el mapa" cierra la hoja antes, para que se vea el mapa.
      if (valor === 'mapa') cerrarHoja();
      select.value = valor;
      select.dispatchEvent(new Event('change'));
      if (valor === 'mapa') return;
      if (CON_EXTRA.includes(valor)) {
        pintarOpciones(cual);
        $(`#${cual}-extra`).scrollIntoView({ block: 'nearest' });
      } else {
        cerrarHoja();
      }
    }),
  );
}

// Botones rápidos de tiempo según la unidad: fijan el mínimo y el máximo en ±10 %.
function pintarRapidos() {
  const u = unidad();
  const caja = $('#tiempo-rapido');
  caja.innerHTML = (RAPIDOS[u] || [])
    .map((v) => `<button type="button" data-valor="${v}">${numero(v, u)} <small>${UNIDAD_CORTA[u]}</small></button>`)
    .join('');
  caja.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      const v = Number(b.dataset.valor);
      for (const [id, f] of [['minimo', 0.9], ['maximo', 1.1]]) {
        $(`#${id}`).value = redondear(v * f, u);
        $(`#${id}`).dispatchEvent(new Event('input'));
      }
      cerrarHoja();
    }),
  );
}

function textoTiempo() {
  const u = unidad();
  const min = Number($('#minimo').value) || 0;
  const max = Number($('#maximo').value) || 0;
  const c = UNIDAD_CORTA[u];
  if (min && max) {
    if ((max - min) / max <= 0.25) return `${numero((min + max) / 2, u)} ${c}`;
    return `${numero(min, u)} a ${numero(max, u)} ${c}`;
  }
  if (max) return `hasta ${numero(max, u)} ${c}`;
  if (min) return `al menos ${numero(min, u)} ${c}`;
  return 'cuánto';
}

function textoPunto(cual) {
  const select = $(`#${cual}-tipo`);
  const tipo = select.value;
  const p = deps.puntos()[cual];
  if (tipo.startsWith('lugar:')) return select.selectedOptions[0]?.textContent || 'un lugar guardado';
  if (tipo === 'gps') return cual === 'partida' ? 'donde estoy' : 'mi ubicación';
  if (tipo === 'metro' && p?.estacion) return `la estación ${p.estacion}`;
  if (p?.etiqueta && ['mapa', 'buscar'].includes(tipo)) return p.etiqueta === 'Punto en el mapa' ? 'un punto del mapa' : p.etiqueta;
  return { mapa: 'un punto del mapa', buscar: 'una dirección', metro: 'una estación de metro' }[tipo] || 'donde estoy';
}

function textoDestino() {
  const tipo = $('#termino-tipo').value;
  if (tipo === 'igual') return ['y', 'volver al inicio'];
  if (tipo === 'timbre') return ['hasta', 'un timbre nuevo y volver'];
  if (tipo === 'plaza') return ['hasta', 'una plaza y volver'];
  if (tipo === 'tramite') return ['hasta', deps.textoMandado() ? `${deps.textoMandado()} y volver` : 'un trámite (elige cuál)'];
  if (tipo === 'metro-calce') return ['hasta', 'el metro que calce'];
  return ['hasta', textoPunto('termino')];
}

// Lo que dura el paseo en las otras unidades, para saber a qué equivale lo elegido.
function textoEstimacion() {
  const u = unidad();
  const aj = almacen.ajustes();
  const min = Number($('#minimo').value) || 0;
  const max = Number($('#maximo').value) || 0;
  const v = min && max ? (min + max) / 2 : max || min;
  if (!v || (u === 'kcal' && !(Number(aj.peso) > 0))) return '';
  const r = resumen(aMetros(v, u, aj), aj);
  return [
    u !== 'pasos' && formatearPasos(Math.round(r.pasos / 100) * 100),
    u !== 'km' && formatearDistancia(r.metros),
    u !== 'minutos' && formatearMinutos(Math.round(r.minutos)),
    u !== 'kcal' && r.kcal !== null && formatearKcal(r.kcal),
  ]
    .filter(Boolean)
    .map((t) => `≈ ${t}`)
    .join(' · ');
}

// Escribe la frase con lo que está elegido. app.js la llama cada vez que guarda el formulario.
export function pintarFrase() {
  if (!deps) return;
  $('#hueco-tiempo').textContent = textoTiempo();
  $('#hueco-desde').textContent = textoPunto('partida');
  const [conector, destino] = textoDestino();
  $('#frase-conector').textContent = conector;
  $('#hueco-hasta').textContent = destino;
  $('#hueco-estilo').textContent = ESTILO_EN_FRASE[document.querySelector('input[name="estilo"]:checked').value];
  $('#frase-estimacion').textContent = textoEstimacion();
  sincronizarSubidas();
}
