// Pantalla principal: conecta el formulario, el mapa, la generación de rutas y el seguimiento.

import { Mapa, escapar, COLORES } from './mapa.js';
import * as almacen from './almacen.js';
import { buscarDireccion } from './busqueda.js';
import { cargarEstaciones } from './bikeitau.js';
import { paseosAPie, paseosConBici, paseosAPlaza, caminoCorto } from './generador.js';
import { ErrorDeRuta } from './brouter.js';
import { cargarPlazas, lugaresEnRuta, nombreLugar, tipoLugar } from './plazas.js';
import { resumir, textoComparacion } from './explicar.js';
import { crearGpx, nombreArchivo } from './gpx.js';
import { Voz, fraseHablada } from './guia.js';
import { distancia } from './geo.js';
import {
  aMetros,
  desdeMetros,
  rangoEnMetros,
  resumen,
  formatearPasos,
  formatearDistancia,
  formatearMinutos,
} from './duracion.js';
import { Seguimiento, ubicacionActual } from './seguimiento.js';

const $ = (selector) => document.querySelector(selector);
const panel = $('#panel');
const mapa = new Mapa('mapa');

const estado = {
  vista: 'formulario',
  // Puntos elegidos en el mapa o con el buscador: { punto, etiqueta, origen: 'mapa' | 'buscar' }.
  puntos: { partida: null, termino: null },
  opciones: [],
  indice: 0,
  seguimiento: null,
  seguirme: true,
  esperando: null,
  buscando: false,
  unidad: 'pasos',
};

// ---------- Vistas y panel ----------

function irA(vista) {
  if (estado.seguimiento && vista !== 'seguimiento') terminarSeguimiento(false);
  estado.vista = vista;
  document.querySelectorAll('.vista').forEach((v) => {
    v.hidden = v.dataset.vista !== vista;
  });
  panel.classList.remove('chico', 'grande');
  // En resultados y seguimiento el panel es más bajo para que se vea la ruta.
  panel.classList.toggle('compacto', vista === 'resultados' || vista === 'seguimiento');
  panel.scrollTop = 0;
  if (vista === 'formulario') {
    mapa.limpiarRuta();
    actualizarMarcadores();
  }
  if (vista === 'lugares') {
    mapa.limpiarRuta();
    mostrarLugares();
  }
  if (vista === 'ajustes') cargarAjustes();
}

function margenesPanel() {
  if (window.innerWidth >= 720) return { izquierda: panel.offsetWidth + 16, abajo: 0 };
  return { izquierda: 0, abajo: panel.offsetHeight };
}

$('#asa').addEventListener('click', () => panel.classList.toggle('chico'));
document.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => irA(b.dataset.ir)));

function mostrarEstado(elemento, texto, esError = false) {
  elemento.textContent = texto;
  elemento.classList.toggle('error', esError);
}

function mensajeDeError(err) {
  if (err instanceof ErrorDeRuta) return err.message;
  if (err instanceof TypeError) return 'No hay conexión o un servicio no respondió. Intenta de nuevo.';
  return err?.message || 'Algo falló.';
}

// ---------- Elegir puntos en el mapa ----------

function esperarClic(destino, texto) {
  estado.esperando = destino;
  $('#aviso-mapa-texto').textContent = texto;
  $('#aviso-mapa').hidden = false;
  panel.classList.add('chico');
}

function terminarEspera() {
  estado.esperando = null;
  $('#aviso-mapa').hidden = true;
  panel.classList.remove('chico');
}

$('#aviso-mapa-cancelar').addEventListener('click', terminarEspera);

mapa.alTocar((punto) => {
  const destino = estado.esperando;
  if (!destino) return;
  terminarEspera();
  if (destino === 'lugar') {
    guardarLugar(punto, 'Punto en el mapa');
    return;
  }
  estado.puntos[destino] = { punto, etiqueta: 'Punto en el mapa', origen: 'mapa' };
  pintarExtra(destino);
  actualizarMarcadores();
  guardarFormulario();
});

// ---------- Buscador de direcciones ----------

function crearBuscador(contenedor, alElegir, enfocar = true) {
  contenedor.innerHTML = `
    <div class="buscador">
      <div class="fila">
        <input type="search" placeholder="Dirección o lugar" enterkeyhint="search" aria-label="Dirección o lugar">
        <button type="button" class="boton-secundario">Buscar</button>
      </div>
      <ul class="resultados-busqueda"></ul>
      <p class="estado"></p>
    </div>`;
  const entrada = contenedor.querySelector('input');
  const lista = contenedor.querySelector('ul');
  const aviso = contenedor.querySelector('.estado');
  const buscar = async () => {
    const texto = entrada.value.trim();
    if (texto.length < 3) {
      mostrarEstado(aviso, 'Escribe al menos 3 letras.', true);
      return;
    }
    mostrarEstado(aviso, 'Buscando…');
    lista.innerHTML = '';
    try {
      const resultados = await buscarDireccion(texto);
      mostrarEstado(aviso, resultados.length ? '' : 'Sin resultados. Prueba agregando la comuna.');
      for (const r of resultados) {
        const li = document.createElement('li');
        li.innerHTML = `<button type="button"><strong>${escapar(r.corto)}</strong>${escapar(r.nombre)}</button>`;
        li.querySelector('button').addEventListener('click', () => alElegir(r));
        lista.append(li);
      }
    } catch (err) {
      mostrarEstado(aviso, mensajeDeError(err), true);
    }
  };
  contenedor.querySelector('button').addEventListener('click', buscar);
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscar();
    }
  });
  if (enfocar) entrada.focus();
}

// ---------- Formulario: partida y término ----------

const NOMBRES = { partida: 'la partida', termino: 'el término' };

function llenarSelector(cual) {
  const select = $(`#${cual}-tipo`);
  const anterior = select.value;
  select.innerHTML = '';
  const agregar = (padre, valor, texto) => {
    const o = document.createElement('option');
    o.value = valor;
    o.textContent = texto;
    padre.append(o);
  };
  if (cual === 'termino') {
    agregar(select, 'igual', 'Volver a la partida (circular)');
    agregar(select, 'plaza', 'Ir a una plaza y volver');
  }
  agregar(select, 'gps', 'Mi ubicación (GPS)');
  agregar(select, 'mapa', 'Marcar en el mapa');
  agregar(select, 'buscar', 'Buscar una dirección');
  const lugares = almacen.lugares();
  if (lugares.length) {
    const grupo = document.createElement('optgroup');
    grupo.label = 'Lugares guardados';
    for (const l of lugares) agregar(grupo, `lugar:${l.id}`, l.nombre);
    select.append(grupo);
  }
  if ([...select.options].some((o) => o.value === anterior)) select.value = anterior;
}

function lugarPorTipo(tipo) {
  return almacen.lugares().find((l) => `lugar:${l.id}` === tipo) || null;
}

// `enfocar` abre el teclado en el buscador; no se usa al cargar la página para no sorprender.
function pintarExtra(cual, enfocar = true) {
  const tipo = $(`#${cual}-tipo`).value;
  const caja = $(`#${cual}-extra`);
  const p = estado.puntos[cual];
  caja.innerHTML = '';
  if (tipo === 'gps') {
    caja.innerHTML = '<p class="ayuda">Se usa tu ubicación al momento de buscar.</p>';
  } else if (tipo === 'plaza') {
    caja.innerHTML =
      '<p class="ayuda">La app elige una plaza, plazoleta, parque o plaza de juegos a la distancia justa para tu ' +
      'duración, y vuelves por otras calles. Con las flechas del resultado ves otras plazas.</p>';
  } else if (tipo === 'mapa') {
    caja.innerHTML = `<div class="punto-elegido"><span>${p ? 'Punto marcado en el mapa' : 'Aún no marcas el punto'}</span>
      <button type="button" class="boton-texto">${p ? 'Mover' : 'Tocar el mapa'}</button></div>`;
    caja.querySelector('button').addEventListener('click', () => esperarClic(cual, `Toca el mapa para marcar ${NOMBRES[cual]}`));
  } else if (tipo === 'buscar') {
    if (p) {
      caja.innerHTML = `<div class="punto-elegido"><span>📍 ${escapar(p.etiqueta)}</span>
        <button type="button" class="boton-texto">Cambiar</button></div>`;
      caja.querySelector('button').addEventListener('click', () => {
        estado.puntos[cual] = null;
        pintarExtra(cual);
        actualizarMarcadores();
      });
    } else {
      crearBuscador(caja, (r) => {
        estado.puntos[cual] = { punto: r.punto, etiqueta: r.corto, origen: 'buscar' };
        pintarExtra(cual);
        actualizarMarcadores();
        mapa.centrarEn(r.punto, 16);
        guardarFormulario();
      }, enfocar);
    }
  }
}

// La vuelta en Bike Itaú todavía no se combina con "ir a una plaza" (quedó como idea en el backlog).
function actualizarBici() {
  const conPlaza = $('#termino-tipo').value === 'plaza';
  const casilla = $('#con-bici');
  casilla.disabled = conPlaza;
  if (conPlaza) casilla.checked = false;
  casilla.closest('label').title = conPlaza ? 'No disponible al ir a una plaza' : '';
  $('#ayuda-bici').hidden = !casilla.checked;
}

function alCambiarTipo(cual) {
  const tipo = $(`#${cual}-tipo`).value;
  const p = estado.puntos[cual];
  if (p && p.origen !== tipo) estado.puntos[cual] = null;
  if (cual === 'termino') actualizarBici();
  pintarExtra(cual);
  actualizarMarcadores();
  guardarFormulario();
  if (tipo === 'mapa' && !estado.puntos[cual]) esperarClic(cual, `Toca el mapa para marcar ${NOMBRES[cual]}`);
  const lugar = lugarPorTipo(tipo);
  if (lugar) mapa.centrarEn([lugar.lat, lugar.lon], 15);
}

$('#partida-tipo').addEventListener('change', () => alCambiarTipo('partida'));
$('#termino-tipo').addEventListener('change', () => alCambiarTipo('termino'));

// Punto ya conocido sin preguntar al GPS (para dibujar los marcadores A y B).
function puntoConocido(cual) {
  const tipo = $(`#${cual}-tipo`).value;
  const lugar = lugarPorTipo(tipo);
  if (lugar) return [lugar.lat, lugar.lon];
  if (tipo === 'mapa' || tipo === 'buscar') return estado.puntos[cual]?.punto || null;
  return null;
}

function actualizarMarcadores() {
  if (estado.vista !== 'formulario') return;
  const termino = $('#termino-tipo').value === 'igual' ? null : puntoConocido('termino');
  mapa.mostrarPuntos(puntoConocido('partida'), termino);
}

async function resolverPunto(cual) {
  const tipo = $(`#${cual}-tipo`).value;
  if (tipo === 'gps') return { punto: await ubicacionActual(), etiqueta: 'Tu ubicación' };
  if (tipo.startsWith('lugar:')) {
    const lugar = lugarPorTipo(tipo);
    if (!lugar) throw new Error('Ese lugar guardado ya no existe.');
    return { punto: [lugar.lat, lugar.lon], etiqueta: lugar.nombre };
  }
  const p = estado.puntos[cual];
  if (!p) throw new Error(`Falta marcar ${NOMBRES[cual]}.`);
  return p;
}

// ---------- Formulario: duración ----------

function unidadElegida() {
  return document.querySelector('input[name="unidad"]:checked').value;
}

function redondear(valor, unidad) {
  if (unidad === 'pasos') return Math.round(valor / 100) * 100;
  if (unidad === 'minutos') return Math.round(valor);
  return Math.round(valor * 10) / 10;
}

// Al cambiar de unidad se convierten los valores ya escritos (8.000 pasos pasan a 6 km, por ejemplo).
document.querySelectorAll('input[name="unidad"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    const nueva = unidadElegida();
    const aj = almacen.ajustes();
    for (const id of ['minimo', 'maximo']) {
      const entrada = $(`#${id}`);
      if (entrada.value === '') continue;
      const metros = aMetros(Number(entrada.value), estado.unidad, aj);
      entrada.value = redondear(desdeMetros(metros, nueva, aj), nueva);
    }
    estado.unidad = nueva;
    actualizarAyudaDuracion();
    guardarFormulario();
  }),
);

function actualizarAyudaDuracion() {
  const aj = almacen.ajustes();
  const unidad = unidadElegida();
  const partes = [];
  for (const [id, nombre] of [['minimo', 'mín.'], ['maximo', 'máx.']]) {
    const v = $(`#${id}`).value;
    if (v === '' || Number(v) <= 0) continue;
    const r = resumen(aMetros(Number(v), unidad, aj), aj);
    const equivalentes = [
      unidad !== 'pasos' && formatearPasos(r.pasos),
      unidad !== 'km' && formatearDistancia(r.metros),
      unidad !== 'minutos' && formatearMinutos(r.minutos),
    ].filter(Boolean);
    partes.push(`${nombre} ≈ ${equivalentes.join(' · ')}`);
  }
  $('#ayuda-duracion').textContent = partes.join(' — ');
}

for (const id of ['minimo', 'maximo']) {
  $(`#${id}`).addEventListener('input', () => {
    actualizarAyudaDuracion();
    guardarFormulario();
  });
}

$('#con-bici').addEventListener('change', () => {
  $('#ayuda-bici').hidden = !$('#con-bici').checked;
  guardarFormulario();
});

function guardarFormulario() {
  almacen.guardarFormulario({
    unidad: unidadElegida(),
    minimo: $('#minimo').value,
    maximo: $('#maximo').value,
    conBici: $('#con-bici').checked,
    partidaTipo: $('#partida-tipo').value,
    terminoTipo: $('#termino-tipo').value,
    puntos: estado.puntos,
  });
}

function restaurarFormulario() {
  llenarSelector('partida');
  llenarSelector('termino');
  const f = almacen.formularioGuardado();
  if (f) {
    const radio = document.querySelector(`input[name="unidad"][value="${f.unidad}"]`);
    if (radio) radio.checked = true;
    $('#minimo').value = f.minimo ?? '';
    $('#maximo').value = f.maximo ?? '';
    $('#con-bici').checked = Boolean(f.conBici);
    for (const [cual, tipo] of [['partida', f.partidaTipo], ['termino', f.terminoTipo]]) {
      const select = $(`#${cual}-tipo`);
      if ([...select.options].some((o) => o.value === tipo)) select.value = tipo;
    }
    if (f.puntos) estado.puntos = { partida: f.puntos.partida || null, termino: f.puntos.termino || null };
  } else {
    $('#minimo').value = 8000;
    $('#maximo').value = 10000;
  }
  estado.unidad = unidadElegida();
  actualizarBici();
  pintarExtra('partida', false);
  pintarExtra('termino', false);
  actualizarAyudaDuracion();
}

// ---------- Buscar rutas ----------

$('#formulario').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (estado.buscando) return;
  const aviso = $('#estado-busqueda');
  const boton = $('#buscar');
  const aj = almacen.ajustes();
  let rango;
  try {
    rango = rangoEnMetros({ min: $('#minimo').value, max: $('#maximo').value, unidad: unidadElegida() }, aj);
  } catch (err) {
    mostrarEstado(aviso, err.message, true);
    return;
  }
  guardarFormulario();
  estado.buscando = true;
  boton.disabled = true;
  boton.textContent = 'Buscando…';
  try {
    mostrarEstado(aviso, 'Ubicando la partida y el término…');
    const tipoTermino = $('#termino-tipo').value;
    const partida = await resolverPunto('partida');
    const termino = tipoTermino === 'igual' || tipoTermino === 'plaza' ? partida : await resolverPunto('termino');
    // Las plazas sirven para el modo "ir a una plaza" y para nombrar lugares en las explicaciones.
    const plazas = cargarPlazas().catch((err) => {
      console.error(err);
      return [];
    });
    let consultas = 0;
    const avance = () => {
      consultas++;
      mostrarEstado(aviso, `Calculando rutas… (${consultas} consultas)`);
    };
    let opciones;
    if (tipoTermino === 'plaza') {
      const lista = await plazas;
      if (!lista.length) throw new Error('No se pudo cargar la lista de plazas. Intenta de nuevo.');
      opciones = await paseosAPlaza({ inicio: partida.punto, rango, plazas: lista, avance });
    } else if ($('#con-bici').checked) {
      mostrarEstado(aviso, 'Revisando las estaciones Bike Itaú…');
      const estaciones = await cargarEstaciones({ forzar: true });
      opciones = await paseosConBici({ inicio: partida.punto, fin: termino.punto, rango, estaciones, avance });
    } else {
      opciones = await paseosAPie({ inicio: partida.punto, fin: termino.punto, rango, avance });
    }
    if (!opciones.length) throw new ErrorDeRuta('No encontré rutas. Prueba con otra duración o con otro punto.');
    const lista = await plazas;
    for (const o of opciones) {
      o.lugares = lugaresEnRuta(o.partes.flatMap((p) => p.ruta.coords), lista).filter((l) => l.nombre && l !== o.plaza);
      o.explicacion = resumir(o, lista);
    }
    estado.plazas = lista;
    estado.comparaciones = new Map();
    estado.opciones = opciones;
    estado.indice = 0;
    mostrarEstado(aviso, '');
    irA('resultados');
    mostrarOpcion();
  } catch (err) {
    console.error(err);
    mostrarEstado(aviso, mensajeDeError(err), true);
  } finally {
    estado.buscando = false;
    boton.disabled = false;
    boton.textContent = 'Buscar rutas';
  }
});

// ---------- Resultados ----------

const TEXTOS_CALIDAD = {
  pie: { buena: 'tranquilas', media: 'intermedias', mala: 'avenidas o ruidosas' },
  bici: { buena: 'ciclovías o calles tranquilas', media: 'con algo de tráfico', mala: 'sin ciclovía, peatonales o avenidas' },
};

function bloqueCalidad(titulo, evaluacion, modo) {
  const pct = (k) => (evaluacion.total ? (evaluacion.metros[k] / evaluacion.total) * 100 : 0);
  const textos = TEXTOS_CALIDAD[modo];
  const barras = ['buena', 'media', 'mala']
    .map((k) => `<span style="width:${pct(k).toFixed(1)}%;background:${COLORES[k]}"></span>`)
    .join('');
  return `<div class="bloque">
    <h3>${titulo}: ${Math.round(pct('buena'))} % por ${textos.buena}</h3>
    <div class="barra-calidad">${barras}</div>
    <p>${Math.round(pct('media'))} % ${textos.media} · ${Math.round(pct('mala'))} % ${textos.mala}</p>
  </div>`;
}

function mostrarOpcion() {
  const o = estado.opciones[estado.indice];
  const total = estado.opciones.length;
  const aj = almacen.ajustes();
  $('#titulo-opcion').textContent = `Opción ${estado.indice + 1} de ${total}`;
  $('#anterior').disabled = estado.indice === 0;
  $('#siguiente').disabled = estado.indice === total - 1;

  const pie = resumen(o.metrosPie, aj);
  let html = `<p class="cifras">${formatearPasos(pie.pasos)}</p>
    <p class="secundario">${formatearDistancia(pie.metros)} a pie · ${formatearMinutos(pie.minutos)} caminando${
      o.metrosBici ? ` · ${formatearDistancia(o.metrosBici)} en bici` : ''
    }</p>`;
  if (!o.enRango) html += '<p class="alerta">No encontré una ruta dentro del rango pedido. Esta es la más cercana.</p>';
  if (o.plaza) {
    html += `<div class="bloque"><h3>Destino: ${escapar(nombreLugar(o.plaza))}</h3>
      <p>${escapar(tipoLugar(o.plaza)).replace(/^./, (c) => c.toUpperCase())}. Con las flechas de arriba ves otras plazas.</p></div>`;
  }
  if (o.explicacion?.length) {
    html += `<div class="bloque"><h3>Por qué esta ruta</h3>
      <ul class="explicacion">${o.explicacion.map((f) => `<li>${escapar(f)}</li>`).join('')}</ul>
      <p class="nota-limites">La app sabe el tipo de calle, el ruido estimado, el verde cercano y las ciclovías. Todavía no sabe
        el ambiente, el comercio, cuánta gente pasa ni la seguridad.</p></div>`;
  }
  html += bloqueCalidad('A pie', o.evaluacionPie, 'pie');
  if (o.evaluacionBici) html += bloqueCalidad('En bici', o.evaluacionBici, 'bici');
  if (o.estacionSalida) {
    html += `<div class="bloque"><h3>Estaciones Bike Itaú</h3>
      <p>Tomas la bici en <strong>${escapar(o.estacionSalida.nombre)}</strong> (${o.estacionSalida.bicis} bicis ahora).</p>
      <p>La dejas en <strong>${escapar(o.estacionLlegada.nombre)}</strong> (${o.estacionLlegada.anclajes} anclajes libres ahora).</p>
      <p class="ayuda">La disponibilidad cambia minuto a minuto.</p></div>`;
  }
  if (o.repetida > 0.15 && !o.plaza) html += '<p class="alerta">Parte de la ruta va y vuelve por la misma calle.</p>';
  html += '<div class="bloque" id="comparacion" hidden></div>';
  html += `<div class="leyenda">
    <span><i style="background:${COLORES.buena}"></i>Tranquila</span>
    <span><i style="background:${COLORES.media}"></i>Intermedia</span>
    <span><i style="background:${COLORES.mala}"></i>Avenida o sin ciclovía</span>
    ${o.metrosBici ? '<span>- - - en bici</span>' : ''}
  </div>
  <p class="ayuda">Toca un tramo de la ruta en el mapa para ver qué tipo de calle es.</p>`;
  $('#detalle-opcion').innerHTML = html;
  mapa.dibujarOpcion(o, margenesPanel());
  mostrarComparacion(o);
}

// Qué se compara con el camino más corto: toda la ruta (A→B), la ida y vuelta a la plaza, o la caminata hasta la
// estación Bike Itaú. En un paseo circular no hay "camino más corto" con qué comparar.
function datosComparacion(o) {
  const coords = o.partes[0].ruta.coords;
  if (o.plaza) {
    return {
      desde: coords[0],
      hasta: o.plaza.punto,
      factor: 2,
      ruta: { metros: o.metrosPie, evaluacion: o.evaluacionPie },
      destino: ' a la plaza',
      etiqueta: 'Esta ruta, ida y vuelta,',
    };
  }
  if (o.estacionSalida) {
    const ida = { metros: o.partes[0].ruta.metros, evaluacion: o.partes[0].evaluacion };
    return {
      desde: coords[0],
      hasta: o.estacionSalida.punto,
      factor: 1,
      ruta: ida,
      destino: ' hasta la estación',
      etiqueta: 'Tu caminata hasta la estación',
    };
  }
  const fin = coords[coords.length - 1];
  if (distancia(coords[0], fin) < 80) return null;
  return { desde: coords[0], hasta: fin, factor: 1, ruta: { metros: o.metrosPie, evaluacion: o.evaluacionPie }, destino: '' };
}

async function mostrarComparacion(o) {
  const datos = datosComparacion(o);
  const caja = $('#comparacion');
  if (!datos || !caja) return;
  const clave = datos.desde.concat(datos.hasta).map((x) => x.toFixed(5)).join(',');
  caja.hidden = false;
  caja.innerHTML = '<h3>Comparado con el camino más corto</h3><p class="ayuda">Calculando…</p>';
  try {
    if (!estado.comparaciones.has(clave)) estado.comparaciones.set(clave, caminoCorto(datos.desde, datos.hasta));
    const corto = await estado.comparaciones.get(clave);
    if (estado.opciones[estado.indice] !== o) return;
    if (!corto) {
      caja.hidden = true;
      return;
    }
    const frases = textoComparacion({ corto, ...datos });
    caja.innerHTML = `<h3>Comparado con el camino más corto</h3>
      <ul class="explicacion">${frases.map((f) => `<li>${escapar(f)}</li>`).join('')}</ul>
      <button type="button" class="boton-texto" id="ver-corto">Ver el camino más corto en el mapa</button>`;
    $('#ver-corto').addEventListener('click', (e) => {
      if (mapa.lineaCorta) {
        mapa.ocultarCorto();
        e.target.textContent = 'Ver el camino más corto en el mapa';
      } else {
        mapa.mostrarCorto(corto.coords);
        e.target.textContent = 'Ocultar el camino más corto';
      }
    });
  } catch (err) {
    console.error(err);
    caja.hidden = true;
  }
}

// ---------- Exportar a otra app (GPX) ----------

$('#exportar-gpx').addEventListener('click', async () => {
  const o = estado.opciones[estado.indice];
  const fecha = new Date();
  const nombre = o.plaza ? `Paseo a ${nombreLugar(o.plaza)}` : 'Paseo';
  const texto = crearGpx(o, { nombre, fecha });
  const archivo = new File([texto], nombreArchivo(fecha), { type: 'application/gpx+xml' });
  // En el celular se intenta abrir el menú de compartir para elegir OsmAnd u Organic Maps directamente.
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = archivo.name;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
});

$('#anterior').addEventListener('click', () => {
  if (estado.indice > 0) {
    estado.indice--;
    mostrarOpcion();
  }
});
$('#siguiente').addEventListener('click', () => {
  if (estado.indice < estado.opciones.length - 1) {
    estado.indice++;
    mostrarOpcion();
  }
});

// ---------- Seguimiento en vivo ----------

$('#empezar').addEventListener('click', () => {
  const opcion = estado.opciones[estado.indice];
  irA('seguimiento');
  document.body.classList.add('siguiendo');
  estado.seguirme = true;
  $('#centrar').textContent = 'Siguiéndote';
  $('#aviso-ruta').hidden = true;
  $('#faltan-principal').textContent = 'Buscando tu ubicación…';
  $('#faltan-detalle').textContent = '';
  $('#barra-progreso').style.width = '0';
  $('#proximo').hidden = true;
  estado.anunciadas = new Set();
  pintarBotonVoz();
  // Hablar dentro del toque en "Empezar" deja la voz habilitada en el celular para el resto del paseo.
  if (vozActiva()) voz.decir('Comienza el paseo');
  estado.seguimiento = new Seguimiento(opcion, {
    alActualizar: actualizarSeguimiento,
    alError: (mensaje) => {
      $('#aviso-ruta').textContent = mensaje;
      $('#aviso-ruta').hidden = false;
    },
  });
  estado.seguimiento.iniciar();
});

function actualizarSeguimiento(d) {
  const aj = almacen.ajustes();
  const f = d.faltante;
  mapa.mostrarYo(d.punto, d.precision);
  if (estado.seguirme) mapa.centrarEn(d.punto);
  $('#modo-actual').textContent = f.modoActual === 'bici' ? 'Tramo en bici' : 'Tramo a pie';
  if (f.total < 25 && d.recorrido > 0) {
    $('#faltan-principal').textContent = '¡Llegaste!';
    $('#faltan-detalle').textContent = `Caminaste unos ${formatearPasos(Math.round(desdeMetros(estado.opciones[estado.indice].metrosPie, 'pasos', aj)))}.`;
  } else if (f.pie > 0) {
    $('#faltan-principal').textContent = `Faltan ${formatearPasos(Math.round(desdeMetros(f.pie, 'pasos', aj)))}`;
    $('#faltan-detalle').textContent = `${formatearDistancia(f.pie)} a pie · ${formatearMinutos(Math.round(desdeMetros(f.pie, 'minutos', aj)))}${
      f.bici > 0 ? ` · ${formatearDistancia(f.bici)} en bici` : ''
    }`;
  } else {
    $('#faltan-principal').textContent = `Faltan ${formatearDistancia(f.bici)} en bici`;
    $('#faltan-detalle').textContent = '';
  }
  $('#barra-progreso').style.width = `${d.total ? Math.min(100, (d.recorrido / d.total) * 100) : 0}%`;
  mostrarProximo(d.siguiente);
  const aviso = $('#aviso-ruta');
  if (d.fueraDeRuta) {
    aviso.textContent = d.distanciaARuta
      ? `Estás a ${formatearDistancia(d.distanciaARuta)} de la ruta.`
      : 'Estás fuera de la ruta.';
    aviso.hidden = false;
  } else {
    aviso.hidden = true;
  }
}

// ---------- Guía giro a giro ----------

const voz = new Voz();
const vozActiva = () => voz.disponible && almacen.ajustes().voz !== false;

function pintarBotonVoz() {
  const boton = $('#voz');
  boton.hidden = !voz.disponible;
  boton.textContent = vozActiva() ? 'Voz: sí' : 'Voz: no';
  boton.setAttribute('aria-pressed', String(vozActiva()));
}

$('#voz').addEventListener('click', () => {
  almacen.guardarAjustes({ voz: !vozActiva() });
  if (!vozActiva()) voz.callar();
  pintarBotonVoz();
});

// Muestra la próxima indicación y la dice en voz alta una vez, cuando falta poco para llegar a ella.
function mostrarProximo(siguiente) {
  const caja = $('#proximo');
  if (!siguiente) {
    caja.hidden = true;
    return;
  }
  caja.hidden = false;
  $('#proximo-distancia').textContent = siguiente.distancia < 15 ? 'Ahora' : `En ${formatearDistancia(siguiente.distancia)}`;
  $('#proximo-texto').textContent = siguiente.texto;
  const umbral = siguiente.tipo === 'giro' ? 45 : 35;
  if (siguiente.distancia <= umbral && !estado.anunciadas.has(siguiente.recorrido)) {
    estado.anunciadas.add(siguiente.recorrido);
    if (vozActiva()) voz.decir(fraseHablada(siguiente, siguiente.distancia));
  }
}

mapa.mapa.on('dragstart', () => {
  if (!estado.seguimiento) return;
  estado.seguirme = false;
  $('#centrar').textContent = 'Seguirme';
});

$('#centrar').addEventListener('click', () => {
  estado.seguirme = true;
  $('#centrar').textContent = 'Siguiéndote';
  if (mapa.yo) mapa.centrarEn([mapa.yo.getLatLng().lat, mapa.yo.getLatLng().lng]);
});

function terminarSeguimiento(volver = true) {
  voz.callar();
  estado.seguimiento?.detener();
  estado.seguimiento = null;
  mapa.ocultarYo();
  document.body.classList.remove('siguiendo');
  if (volver) {
    irA('resultados');
    mostrarOpcion();
  }
}

$('#terminar').addEventListener('click', () => terminarSeguimiento(true));

// ---------- Lugares guardados ----------

function mostrarLugares() {
  const lista = almacen.lugares();
  const ul = $('#lista-lugares');
  ul.innerHTML = '';
  if (!lista.length) {
    ul.innerHTML = '<li class="vacia">Todavía no tienes lugares guardados.</li>';
  }
  for (const l of lista) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="nombre">${escapar(l.nombre)}</span>
      <button type="button" class="boton-texto" data-accion="ver">Ver</button>
      <button type="button" class="boton-texto" data-accion="renombrar">Renombrar</button>
      <button type="button" class="boton-texto" data-accion="borrar" style="color:var(--peligro)">Borrar</button>`;
    li.querySelector('[data-accion="ver"]').addEventListener('click', () => mapa.centrarEn([l.lat, l.lon], 16));
    li.querySelector('[data-accion="renombrar"]').addEventListener('click', () => {
      const nombre = prompt('Nuevo nombre', l.nombre);
      if (nombre && nombre.trim()) {
        almacen.renombrarLugar(l.id, nombre);
        alCambiarLugares();
      }
    });
    li.querySelector('[data-accion="borrar"]').addEventListener('click', () => {
      if (confirm(`¿Borrar "${l.nombre}"?`)) {
        almacen.borrarLugar(l.id);
        alCambiarLugares();
      }
    });
    ul.append(li);
  }
  mapa.mostrarLugares(lista);
}

function alCambiarLugares() {
  mostrarLugares();
  llenarSelector('partida');
  llenarSelector('termino');
}

function guardarLugar(punto, nombrePorDefecto) {
  const entrada = $('#nombre-lugar');
  const nombre = entrada.value.trim() || nombrePorDefecto;
  almacen.agregarLugar(nombre, punto);
  entrada.value = '';
  alCambiarLugares();
  mostrarEstado($('#estado-lugares'), `Guardado: ${nombre}.`);
}

$('#lugar-gps').addEventListener('click', async () => {
  const aviso = $('#estado-lugares');
  mostrarEstado(aviso, 'Obteniendo tu ubicación…');
  try {
    guardarLugar(await ubicacionActual(), 'Mi lugar');
  } catch (err) {
    mostrarEstado(aviso, mensajeDeError(err), true);
  }
});

$('#lugar-mapa').addEventListener('click', () => esperarClic('lugar', 'Toca el mapa para guardar el lugar'));

$('#agregar-lugar').addEventListener('toggle', () => {
  if ($('#agregar-lugar').open) crearBuscador($('#lugar-buscador'), (r) => guardarLugar(r.punto, r.corto));
});

$('#exportar').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(almacen.respaldo(), null, 2)], { type: 'application/json' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `paseos-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
});

$('#importar').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  if (!archivo) return;
  const aviso = $('#estado-lugares');
  try {
    const agregados = almacen.restaurar(JSON.parse(await archivo.text()));
    alCambiarLugares();
    mostrarEstado(aviso, agregados === 1 ? 'Se agregó 1 lugar.' : `Se agregaron ${agregados} lugares.`);
  } catch (err) {
    mostrarEstado(aviso, err instanceof SyntaxError ? 'El archivo no es un respaldo válido.' : err.message, true);
  }
});

// ---------- Ajustes ----------

function cargarAjustes() {
  const aj = almacen.ajustes();
  $('#largo-paso').value = aj.largoPaso;
  $('#velocidad').value = aj.velocidadKmh;
  $('#ver-estaciones').checked = Boolean(aj.verEstaciones);
  mostrarEstado($('#estado-ajustes'), '');
}

$('#form-ajustes').addEventListener('submit', (e) => {
  e.preventDefault();
  const aviso = $('#estado-ajustes');
  const largoPaso = Number($('#largo-paso').value);
  const velocidadKmh = Number($('#velocidad').value);
  if (!(largoPaso >= 0.3 && largoPaso <= 1.5)) {
    mostrarEstado(aviso, 'El largo del paso debe estar entre 0,3 y 1,5 metros.', true);
    return;
  }
  if (!(velocidadKmh >= 2 && velocidadKmh <= 8)) {
    mostrarEstado(aviso, 'La velocidad debe estar entre 2 y 8 km/h.', true);
    return;
  }
  almacen.guardarAjustes({ largoPaso, velocidadKmh, verEstaciones: $('#ver-estaciones').checked });
  aplicarEstaciones();
  actualizarAyudaDuracion();
  mostrarEstado(aviso, 'Guardado.');
});

async function aplicarEstaciones() {
  if (!almacen.ajustes().verEstaciones) {
    mapa.ocultarEstaciones();
    return;
  }
  try {
    mapa.mostrarEstaciones(await cargarEstaciones());
  } catch (err) {
    console.error(err);
  }
}

// ---------- Inicio ----------

restaurarFormulario();
irA('formulario');
aplicarEstaciones();

// Si el permiso de ubicación ya estaba dado, centra el mapa en ti sin preguntar.
navigator.permissions
  ?.query({ name: 'geolocation' })
  .then((p) => {
    if (p.state === 'granted') return ubicacionActual().then((punto) => mapa.centrarEn(punto, 15));
  })
  .catch(() => {});
