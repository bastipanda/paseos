// Pantalla principal: conecta el formulario, el mapa, la generación de rutas y el seguimiento.

import { Mapa, escapar, COLORES } from './mapa.js';
import * as almacen from './almacen.js';
import { buscarDireccion } from './busqueda.js';
import { cargarEstaciones } from './bikeitau.js';
import {
  paseosAPie,
  paseosConBici,
  paseosIdaYVuelta,
  paseosHastaDestino,
  caminoCorto,
  recetaDe,
  rehacerOpcion,
  rutaHasta,
} from './generador.js';
import { ErrorDeRuta } from './brouter.js';
import { $, mostrarEstado, mensajeDeError, compartirODescargar, descargar, formatearHora } from './ui.js';
import { crearRegistro, estadoSemanas, conMeta } from './historial.js';
import { iniciarHoy } from './pantalla-hoy.js';
import { iniciarHistorial } from './pantalla-historial.js';
import { nombreLugar, tipoLugar, nombreEstacion, ICONO_TIPO } from './plazas.js';
import { cargarDatos, cargarTramites, cargarMetro, cargarComunas, cargarDelitos, cargarDex } from './datos.js';
import { radioCaptura, revisarRecorrido, anotarRecorrido, numeroDex, estadoDe } from './dex.js';
import { iniciarDex } from './pantalla-dex.js';
import { dibujarPostal } from './postal.js';
import { comunasDeRuta, textoDelitos, LIMITES_DELITOS } from './territorio.js';
import { resumir, textoComparacion, TEXTOS_ESTILO } from './explicar.js';
import { crearGpx, nombreArchivo } from './gpx.js';
import { Voz, fraseHablada } from './guia.js';
import { distancia } from './geo.js';
import { consultarClima, leerClima, mejorHora, textoMejorHora } from './clima.js';
import { crearIcs } from './calendario.js';
import { Metronomo, faseIntervalo, FRASE_FASE, ppmDeFase } from './metronomo.js';
import { medirMovimiento, ritmoReciente } from './movimiento.js';
import { celdasDeRuta, celdasDeZona, claveCelda, limitesCelda } from './explorar.js';
import {
  aMetros,
  desdeMetros,
  rangoEnMetros,
  resumen,
  tienePeso,
  kcalSubida,
  formatearPasos,
  formatearDistancia,
  formatearMinutos,
  formatearKcal,
} from './duracion.js';
import { Seguimiento, ubicacionActual } from './seguimiento.js';

const panel = $('#panel');
const mapa = new Mapa('mapa');

const estado = {
  vista: 'hoy',
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

// Las páginas ocupan toda la pantalla, sin mapa detrás; las demás vistas son el mapa con el panel abajo.
const PAGINAS = ['hoy', 'dex', 'mas', 'historial', 'lugares', 'respaldo', 'ajustes'];
// Resultados, paseo y resumen esconden la barra de pestañas: cada una tiene su salida y así se ve más mapa.
const SIN_PESTANAS = ['resultados', 'seguimiento', 'resumen'];
// Pestaña que queda marcada en cada vista.
const PESTANA = { resultados: 'formulario', historial: 'mas', lugares: 'mas', respaldo: 'mas', ajustes: 'mas' };

function irA(vista) {
  if (estado.esperando) terminarEspera();
  if (estado.seguimiento && vista !== 'seguimiento') terminarSeguimiento(false);
  estado.vista = vista;
  document.querySelectorAll('.vista').forEach((v) => {
    v.hidden = v.dataset.vista !== vista;
  });
  const pestana = PESTANA[vista] || vista;
  document.querySelectorAll('.pestana').forEach((b) => {
    b.classList.toggle('activa', b.dataset.ir === pestana);
    if (b.dataset.ir === pestana) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.body.classList.toggle('sin-pestanas', SIN_PESTANAS.includes(vista));
  panel.classList.remove('chico', 'grande');
  panel.classList.toggle('pagina', PAGINAS.includes(vista));
  // En resultados, seguimiento y resumen el panel es más bajo para que se vea la ruta.
  panel.classList.toggle('compacto', SIN_PESTANAS.includes(vista));
  panel.scrollTop = 0;
  if (vista === 'hoy') {
    mapa.limpiarRuta();
    mapa.mostrarPuntos(null, null);
    hoy.mostrar();
  }
  if (vista === 'formulario') {
    mapa.limpiarRuta();
    actualizarMarcadores();
  }
  if (vista === 'historial') historial.mostrar();
  if (vista === 'dex') dex.mostrar();
  if (vista === 'lugares') {
    mapa.limpiarRuta();
    mostrarLugares();
  }
  if (vista === 'ajustes') cargarAjustes();
}

// Cuánto tapan el panel y la barra de pestañas. En el celular se calcula con el alto final del panel (no el de ese
// instante), porque al cambiar de vista el panel se achica con una animación y el mapa se encuadraría mal.
function margenesPanel() {
  const barra = document.body.classList.contains('sin-pestanas') ? 0 : $('#pestanas').offsetHeight;
  if (document.body.classList.contains('viendo-mapa')) return { izquierda: 0, abajo: barra };
  if (window.innerWidth >= 720) return { izquierda: panel.offsetWidth + 16, abajo: barra };
  const tope = panel.classList.contains('chico') ? 74 : window.innerHeight * (panel.classList.contains('compacto') ? 0.46 : 0.62);
  return { izquierda: 0, abajo: Math.min(panel.scrollHeight, tope) + barra };
}

$('#asa').addEventListener('click', () => panel.classList.toggle('chico'));
document.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => irA(b.dataset.ir)));

// ---------- Elegir puntos en el mapa ----------

// Muestra el aviso de arriba y deja ver el mapa: en una página el mapa queda entero; en Armar el panel se achica.
function esperarClic(destino, texto, textoBoton = 'Cancelar') {
  estado.esperando = destino;
  $('#aviso-mapa-texto').textContent = texto;
  $('#aviso-mapa-cancelar').textContent = textoBoton;
  $('#aviso-mapa').hidden = false;
  if (panel.classList.contains('pagina')) document.body.classList.add('viendo-mapa');
  else panel.classList.add('chico');
}

// "Ver en el mapa" desde una página (historial, Dex): el mapa completo, con "Volver" para regresar a la página.
function verEnMapa(titulo) {
  esperarClic('ver', titulo, 'Volver');
}

function terminarEspera() {
  const eraConocidas = estado.esperando === 'conocidas';
  estado.esperando = null;
  $('#aviso-mapa').hidden = true;
  document.body.classList.remove('viendo-mapa');
  panel.classList.remove('chico');
  if (eraConocidas) {
    mapa.ocultarConocidas();
    mostrarResumenConocidas();
  }
}

$('#aviso-mapa-cancelar').addEventListener('click', terminarEspera);

mapa.alTocar((punto) => {
  const destino = estado.esperando;
  if (!destino || destino === 'ver') return;
  if (destino === 'conocidas') {
    // Modo pintar: cada toque marca una zona (~120 m) o la desmarca si ya estaba marcada. Sigue activo hasta "Listo".
    const zona = celdasDeZona(punto, 120);
    if (almacen.conocidas().has(claveCelda(punto))) almacen.quitarConocidas(zona);
    else almacen.agregarConocidas(zona);
    dibujarConocidas();
    return;
  }
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
    agregar(select, 'tramite', 'Ir a un trámite y volver (súper, farmacia…)');
    agregar(select, 'metro-calce', 'La estación de metro que calce');
  }
  agregar(select, 'gps', 'Mi ubicación (GPS)');
  agregar(select, 'mapa', 'Marcar en el mapa');
  agregar(select, 'buscar', 'Buscar una dirección');
  agregar(select, 'metro', 'Una estación de metro');
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
  } else if (tipo === 'tramite') {
    const f = almacen.formularioGuardado() || {};
    caja.innerHTML = `<div class="fila">
        <select id="tramite-tipo" aria-label="Tipo de trámite">
          ${Object.entries(TRAMITES).map(([v, t]) => `<option value="${v}"${f.tramite === v ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
        <input type="text" id="tramite-nombre" placeholder="Nombre (opcional)" value="${escapar(f.tramiteNombre || '')}" aria-label="Nombre del local (opcional)">
      </div>
      <p class="ayuda">La app elige uno a la distancia justa para tu duración (así el trámite suma minutos) y vuelves por
        otras calles. Si escribes un nombre (por ejemplo "Líder" o "Cruz Verde"), busca solo esos.</p>`;
    caja.querySelector('#tramite-tipo').addEventListener('change', guardarFormulario);
    caja.querySelector('#tramite-nombre').addEventListener('input', guardarFormulario);
  } else if (tipo === 'metro-calce') {
    caja.innerHTML =
      '<p class="ayuda">La app elige una estación de metro a la distancia justa para tu duración. Terminas ahí y ' +
      'vuelves en metro.</p>';
  } else if (tipo === 'metro') {
    caja.innerHTML = '<select aria-label="Estación de metro"><option value="">Cargando estaciones…</option></select>';
    const select = caja.querySelector('select');
    cargarMetro()
      .then(({ estaciones }) => {
        select.innerHTML =
          '<option value="">Elige una estación</option>' +
          estaciones.map((e, i) => `<option value="${i}"${p?.estacion === e.nombre ? ' selected' : ''}>${escapar(nombreEstacion(e))}</option>`).join('');
        select.addEventListener('change', () => {
          const e = estaciones[Number(select.value)];
          estado.puntos[cual] = e ? { punto: e.punto, etiqueta: `Estación ${e.nombre}`, origen: 'metro', estacion: e.nombre } : null;
          actualizarMarcadores();
          if (e) mapa.centrarEn(e.punto, 15);
          guardarFormulario();
        });
      })
      .catch(() => {
        select.innerHTML = '<option value="">No se pudieron cargar las estaciones</option>';
      });
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

// Para comparar nombres sin importar tildes ni mayúsculas ("Lider" encuentra "Líder").
const normalizarTexto = (t) =>
  [...(t || '').normalize('NFD')]
    .filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f)
    .join('')
    .toLowerCase()
    .trim();

const TRAMITES = {
  supermercado: 'Supermercado',
  farmacia: 'Farmacia',
  panaderia: 'Panadería',
  feria: 'Feria o mercado',
  cajero: 'Cajero o banco',
  ferreteria: 'Ferretería',
};

// La vuelta en Bike Itaú todavía no se combina con ir a un lugar y volver ni con terminar en el metro (quedó como
// idea en el backlog).
function actualizarBici() {
  const sinBici = ['plaza', 'tramite', 'metro-calce'].includes($('#termino-tipo').value);
  const casilla = $('#con-bici');
  casilla.disabled = sinBici;
  if (sinBici) casilla.checked = false;
  casilla.closest('label').title = sinBici ? 'No disponible con este término' : '';
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
  if (tipo === 'mapa' || tipo === 'buscar' || tipo === 'metro') return estado.puntos[cual]?.punto || null;
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
  if (!p) throw new Error(tipo === 'metro' ? `Elige la estación de metro para ${NOMBRES[cual]}.` : `Falta marcar ${NOMBRES[cual]}.`);
  return p;
}

// ---------- Formulario: duración ----------

function unidadElegida() {
  return document.querySelector('input[name="unidad"]:checked').value;
}

function redondear(valor, unidad) {
  if (unidad === 'pasos') return Math.round(valor / 100) * 100;
  if (unidad === 'minutos') return Math.round(valor);
  if (unidad === 'kcal') return Math.round(valor / 10) * 10;
  return Math.round(valor * 10) / 10;
}

// Al cambiar de unidad se convierten los valores ya escritos (8.000 pasos pasan a 6 km, por ejemplo).
// Las calorías necesitan el peso: sin él se vuelve a la unidad anterior y se pide el peso ahí mismo.
document.querySelectorAll('input[name="unidad"]').forEach((radio) =>
  radio.addEventListener('change', () => {
    const nueva = unidadElegida();
    const aj = almacen.ajustes();
    if (nueva === 'kcal' && !tienePeso(aj)) {
      document.querySelector(`input[name="unidad"][value="${estado.unidad}"]`).checked = true;
      $('#pedir-peso').hidden = false;
      mostrarEstado($('#error-peso'), '');
      $('#peso-rapido').focus();
      return;
    }
    $('#pedir-peso').hidden = true;
    for (const id of ['minimo', 'maximo']) {
      const entrada = $(`#${id}`);
      if (entrada.value === '') continue;
      const metros = aMetros(Number(entrada.value), estado.unidad, aj);
      entrada.value = redondear(desdeMetros(metros, nueva, aj), nueva);
    }
    estado.unidad = nueva;
    mostrarEstado($('#estado-busqueda'), '');
    actualizarAyudaDuracion();
    guardarFormulario();
  }),
);

// Guarda el peso escrito junto al selector de unidad y cambia a calorías.
function usarCalorias() {
  const peso = Number($('#peso-rapido').value);
  if (!(peso >= 30 && peso <= 250)) {
    mostrarEstado($('#error-peso'), 'Escribe un peso entre 30 y 250 kg.', true);
    return;
  }
  almacen.guardarAjustes({ peso });
  $('#pedir-peso').hidden = true;
  const kcal = document.querySelector('input[name="unidad"][value="kcal"]');
  kcal.checked = true;
  kcal.dispatchEvent(new Event('change'));
}

$('#usar-kcal').addEventListener('click', usarCalorias);
$('#peso-rapido').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    usarCalorias();
  }
});

function actualizarAyudaDuracion() {
  const aj = almacen.ajustes();
  const unidad = unidadElegida();
  const partes = [];
  for (const [id, nombre] of [['minimo', 'mín.'], ['maximo', 'máx.']]) {
    const v = $(`#${id}`).value;
    if (v === '' || Number(v) <= 0) continue;
    if (unidad === 'kcal' && !tienePeso(aj)) continue;
    const r = resumen(aMetros(Number(v), unidad, aj), aj);
    const equivalentes = [
      unidad !== 'pasos' && formatearPasos(r.pasos),
      unidad !== 'km' && formatearDistancia(r.metros),
      unidad !== 'minutos' && formatearMinutos(r.minutos),
      unidad !== 'kcal' && r.kcal !== null && formatearKcal(r.kcal),
    ].filter(Boolean);
    partes.push(`${nombre} ≈ ${equivalentes.join(' · ')}`);
  }
  $('#ayuda-duracion').textContent = partes.join(' — ');
}

// ---------- Formulario: estilo, "Pasar por…", subidas y explorar ----------

const AYUDA_ESTILO = {
  tranquilo: 'Poco ruido y verde: pasajes, calles residenciales, parques y senderos.',
  vida: 'Calles con gente y comercio: veredas de avenidas y paseos peatonales. Evita senderos y callejones aislados.',
  noche:
    'Iluminado y transitado, a cualquier hora: calles principales con luz. Evita callejones, pasajes, senderos, ' +
    'parques oscuros y escaleras. No hay datos de delitos: es una aproximación.',
};

const estiloElegido = () => document.querySelector('input[name="estilo"]:checked').value;
const subidasElegidas = () => document.querySelector('input[name="subidas"]:checked').value;
const pasarPorElegido = () =>
  Object.fromEntries([...document.querySelectorAll('input[name="pasar"]')].map((c) => [c.value, c.checked]));

function actualizarAyudaEstilo() {
  $('#ayuda-estilo').textContent = AYUDA_ESTILO[estiloElegido()];
}

function actualizarAyudaExplorar() {
  const ayuda = $('#ayuda-explorar');
  ayuda.hidden = !$('#explorar').checked;
  const n = almacen.conocidas().size;
  ayuda.textContent = n
    ? `Prefiere calles fuera de lo que marcaste como conocido (${n} cuadras).`
    : 'Todavía no marcas nada como conocido. Hazlo al terminar un paseo, con "Ya conozco esta ruta" o en Lugares.';
}

document.querySelectorAll('input[name="estilo"]').forEach((r) =>
  r.addEventListener('change', () => {
    actualizarAyudaEstilo();
    guardarFormulario();
  }),
);
document.querySelectorAll('input[name="pasar"]').forEach((c) => c.addEventListener('change', guardarFormulario));
document.querySelectorAll('input[name="subidas"]').forEach((r) =>
  r.addEventListener('change', () => {
    $('#ayuda-subidas').hidden = subidasElegidas() !== 'buscar';
    guardarFormulario();
  }),
);
$('#explorar').addEventListener('change', () => {
  actualizarAyudaExplorar();
  guardarFormulario();
});

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
    estilo: estiloElegido(),
    pasarPor: pasarPorElegido(),
    subidas: subidasElegidas(),
    explorar: $('#explorar').checked,
    tramite: $('#tramite-tipo')?.value || almacen.formularioGuardado()?.tramite || 'supermercado',
    tramiteNombre: $('#tramite-nombre') ? $('#tramite-nombre').value : almacen.formularioGuardado()?.tramiteNombre || '',
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
    const estilo = document.querySelector(`input[name="estilo"][value="${f.estilo}"]`);
    if (estilo) estilo.checked = true;
    for (const c of document.querySelectorAll('input[name="pasar"]')) c.checked = Boolean(f.pasarPor?.[c.value]);
    // Los formularios guardados antes de la v1.3 tenían solo "evitar subidas" (sí o no).
    const subidas = f.subidas || (f.evitarSubidas ? 'evitar' : 'igual');
    const radioSubidas = document.querySelector(`input[name="subidas"][value="${subidas}"]`);
    if (radioSubidas) radioSubidas.checked = true;
    $('#ayuda-subidas').hidden = subidas !== 'buscar';
    $('#explorar').checked = Boolean(f.explorar);
    // Si se borró el peso, las calorías ya no se pueden usar.
    if (f.unidad === 'kcal' && !tienePeso(almacen.ajustes())) document.querySelector('input[name="unidad"][value="pasos"]').checked = true;
  } else {
    $('#minimo').value = 8000;
    $('#maximo').value = 10000;
  }
  estado.unidad = unidadElegida();
  actualizarAyudaEstilo();
  actualizarAyudaExplorar();
  actualizarBici();
  pintarExtra('partida', false);
  pintarExtra('termino', false);
  actualizarAyudaDuracion();
}

// ---------- Buscar rutas ----------

// Preferencias del paseo según el formulario (también las usa "Salir ahora", con lo último que se eligió).
function prefsDelFormulario(datos) {
  return {
    estilo: estiloElegido(),
    subidas: subidasElegidas(),
    evitarSubidas: subidasElegidas() === 'evitar',
    pasarPor: pasarPorElegido(),
    datos,
    conocidas: $('#explorar').checked ? almacen.conocidas() : null,
  };
}

// Busca opciones y las muestra. `pedir(avance, prefs)` llama al generador que corresponda; `aviso` es donde se
// cuenta el avance; `origen` es la vista a la que vuelve "Cambiar búsqueda".
async function buscarYMostrar({ pedir, aviso, origen, prefsExtra = {} }) {
  if (estado.buscando) return;
  estado.buscando = true;
  try {
    // Plazas, lugares interesantes, comercio y servicios: para "Pasar por…", las explicaciones y el modo plaza.
    mostrarEstado(aviso, 'Cargando lugares…');
    const datos = await cargarDatos();
    const prefs = { ...prefsDelFormulario(datos), ...prefsExtra };
    let consultas = 0;
    const avance = () => {
      consultas++;
      mostrarEstado(aviso, `Calculando rutas… (${consultas} consultas)`);
    };
    const opciones = await pedir(avance, prefs, datos);
    if (!opciones.length) throw new ErrorDeRuta('No encontré rutas. Prueba con otra duración o con otro punto.');
    for (const o of opciones) o.explicacion = resumir(o, { pasarPor: prefs.pasarPor });
    estado.comparaciones = new Map();
    estado.opciones = opciones;
    estado.indice = 0;
    estado.origenBusqueda = origen;
    mostrarEstado(aviso, '');
    irA('resultados');
    mostrarOpcion();
  } catch (err) {
    console.error(err);
    mostrarEstado(aviso, mensajeDeError(err), true);
  } finally {
    estado.buscando = false;
  }
}

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
  boton.disabled = true;
  boton.textContent = 'Buscando…';
  try {
    mostrarEstado(aviso, 'Ubicando la partida y el término…');
    const tipoTermino = $('#termino-tipo').value;
    const partida = await resolverPunto('partida');
    const sinTermino = ['igual', 'plaza', 'tramite', 'metro-calce'].includes(tipoTermino);
    const termino = sinTermino ? partida : await resolverPunto('termino');
    const conBici = $('#con-bici').checked;
    await buscarYMostrar({
      aviso,
      origen: 'formulario',
      pedir: async (avance, prefs, datos) => {
        if (tipoTermino === 'plaza') {
          if (!datos.plazas.length) throw new Error('No se pudo cargar la lista de plazas. Intenta de nuevo.');
          return paseosIdaYVuelta({ inicio: partida.punto, rango, lugares: datos.plazas, avance, prefs, sinLugares: 'No encontré plazas a una distancia que calce con la duración pedida.' });
        }
        if (tipoTermino === 'tramite') {
          const tipo = $('#tramite-tipo').value;
          const filtro = normalizarTexto($('#tramite-nombre').value);
          const lugares = (await cargarTramites()).filter((l) => l.tipo === tipo && (!filtro || normalizarTexto(l.nombre).includes(filtro)));
          if (!lugares.length) throw new Error(`No encontré ${TRAMITES[tipo].toLowerCase()} con ese nombre en el mapa.`);
          return paseosIdaYVuelta({ inicio: partida.punto, rango, lugares, avance, prefs, sinLugares: `No encontré un local de ese tipo a una distancia que calce con la duración pedida.` });
        }
        if (tipoTermino === 'metro-calce') {
          const { estaciones } = await cargarMetro();
          return paseosHastaDestino({ inicio: partida.punto, rango, lugares: estaciones, avance, prefs });
        }
        if (conBici) {
          mostrarEstado(aviso, 'Revisando las estaciones Bike Itaú…');
          const estaciones = await cargarEstaciones({ forzar: true });
          return paseosConBici({ inicio: partida.punto, fin: termino.punto, rango, estaciones, avance, prefs });
        }
        const opciones = await paseosAPie({ inicio: partida.punto, fin: termino.punto, rango, avance, prefs });
        // Si el término es una estación de metro elegida, se muestra como destino (nombre y líneas).
        const estacion = $('#termino-tipo').value === 'metro' && (await cargarMetro()).estaciones.find((e) => e.nombre === termino.estacion);
        if (estacion) for (const o of opciones) o.destino = { ...estacion, idaYVuelta: false };
        return opciones;
      },
    });
  } catch (err) {
    console.error(err);
    mostrarEstado(aviso, mensajeDeError(err), true);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Buscar rutas';
  }
});

// "Salir ahora" (pantalla Hoy): ida y vuelta desde tu ubicación, de unos `minutos` (±12 %), con lo último que
// elegiste en el formulario (estilo, pasar por, explorar).
async function salirAhora(minutos) {
  const aviso = $('#estado-salir');
  if (estado.buscando) return;
  const aj = almacen.ajustes();
  const metros = aMetros(minutos, 'minutos', aj);
  const rango = { min: metros * 0.88, max: metros * 1.12 };
  try {
    mostrarEstado(aviso, 'Buscando tu ubicación…');
    const punto = await ubicacionActual();
    if ($('#sorpresa').checked) return await salirSorpresa(punto, rango, aviso);
    await buscarYMostrar({
      aviso,
      origen: 'hoy',
      pedir: (avance, prefs) => paseosAPie({ inicio: punto, fin: punto, rango, avance, prefs }),
    });
  } catch (err) {
    mostrarEstado(aviso, mensajeDeError(err), true);
  }
}

// Paseo sorpresa: ida y vuelta a un lugar de la Santiagodex que todavía no capturas, elegido al azar entre los mejores,
// y parte de inmediato sin mostrar adónde (se revela al llegar).
async function salirSorpresa(punto, rango, aviso) {
  if (estado.buscando) return;
  estado.buscando = true;
  try {
    mostrarEstado(aviso, 'Eligiendo un lugar sorpresa…');
    const [datos, dexLista] = await Promise.all([cargarDatos(), cargarDex()]);
    const d = almacen.dex();
    // Sin capturar y no tan cerca como para "llegar" apenas se parte.
    const lugares = dexLista.filter((l) => !d.capturados[l.id] && distancia(punto, l.punto) > radioCaptura(l) + 100);
    let consultas = 0;
    const opciones = await paseosIdaYVuelta({
      inicio: punto,
      rango,
      lugares,
      prefs: prefsDelFormulario(datos),
      avance: () => mostrarEstado(aviso, `Armando el paseo sorpresa… (${++consultas} consultas)`),
      sinLugares: 'No encontré lugares nuevos de la Santiagodex a esa distancia. Prueba con otra duración.',
    });
    const buenas = opciones.filter((o) => o.enRango).slice(0, 3);
    const opcion = (buenas.length ? buenas : opciones)[Math.floor(Math.random() * Math.min(3, (buenas.length ? buenas : opciones).length))];
    opcion.misterio = true;
    opcion.explicacion = resumir(opcion, {});
    estado.opciones = [opcion];
    estado.indice = 0;
    estado.comparaciones = new Map();
    estado.origenBusqueda = 'hoy';
    mostrarEstado(aviso, '');
    empezarPaseo(opcion);
  } finally {
    estado.buscando = false;
  }
}

// "Ir a capturarlo" (Santiagodex): ida y vuelta desde donde estás hasta ese lugar, por otras calles a la vuelta.
async function irACapturar(lugar) {
  const aviso = $('#estado-dex');
  try {
    mostrarEstado(aviso, 'Buscando tu ubicación…');
    const punto = await ubicacionActual();
    const d = distancia(punto, lugar.punto);
    if (d < 60) return mostrarEstado(aviso, 'Ya estás ahí: camina hasta el lugar o márcalo con "Ya lo conocía".');
    if (d > 8000) {
      return mostrarEstado(aviso, `Está a ${formatearDistancia(d)} en línea recta. Mejor ve en metro y arma el paseo desde la estación más cercana (Armar → Partida: una estación de metro).`, true);
    }
    // Ida ≈ distancia × 1,3 y la vuelta un poco más larga, por otras calles.
    await buscarYMostrar({
      aviso,
      origen: 'dex',
      pedir: (avance, prefs) => paseosIdaYVuelta({ inicio: punto, rango: { min: d * 2.2, max: d * 3.6 }, lugares: [lugar], avance, prefs }),
    });
  } catch (err) {
    mostrarEstado(aviso, mensajeDeError(err), true);
  }
}

// Abre una ruta favorita: la pide otra vez a BRouter con los mismos puntos.
async function abrirFavorita(favorita) {
  const aviso = $('#estado-salir');
  await buscarYMostrar({
    aviso,
    origen: 'hoy',
    pedir: async (avance, prefs) => {
      mostrarEstado(aviso, `Pidiendo "${favorita.nombre}"…`);
      const opcion = await rehacerOpcion(favorita.receta, prefs);
      opcion.favorita = favorita.id;
      return [opcion];
    },
  });
}

$('#cambiar-busqueda').addEventListener('click', () => irA(estado.origenBusqueda || 'formulario'));

// ---------- Resultados ----------

const TEXTOS_BICI = { buena: 'ciclovías o calles tranquilas', media: 'con algo de tráfico', mala: 'sin ciclovía, peatonales o avenidas' };

function bloqueCalidad(titulo, evaluacion, modo, estilo) {
  const pct = (k) => (evaluacion.total ? (evaluacion.metros[k] / evaluacion.total) * 100 : 0);
  const textos = modo === 'bici' ? TEXTOS_BICI : TEXTOS_ESTILO[estilo] || TEXTOS_ESTILO.tranquilo;
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

  const estilo = o.estilo || 'tranquilo';
  const textosEstilo = TEXTOS_ESTILO[estilo];
  const pie = resumen(o.metrosPie, aj);
  const subida = o.partes.filter((p) => p.modo === 'pie').reduce((s, p) => s + (p.ruta.subida || 0), 0);
  const kcal = pie.kcal === null ? null : pie.kcal + kcalSubida(subida, aj);
  const detalles = [
    `${formatearDistancia(pie.metros)} a pie`,
    `${formatearMinutos(pie.minutos)} caminando`,
    kcal !== null && `≈ ${formatearKcal(kcal)}`,
    o.metrosBici && `${formatearDistancia(o.metrosBici)} en bici`,
    subida >= 10 && `sube ${Math.round(subida)} m`,
  ].filter(Boolean);
  let html = `<p class="cifras">${formatearPasos(pie.pasos)}</p>
    <p class="secundario">${detalles.join(' · ')} · estilo ${escapar(ESTILO_NOMBRE[estilo])}</p>`;
  const clima = estado.clima && leerClima(estado.clima);
  if (clima?.avisos.length) html += `<p class="alerta">${clima.avisos.map(escapar).join(' ')}</p>`;
  if (!o.enRango) html += '<p class="alerta">No encontré una ruta dentro del rango pedido. Esta es la más cercana.</p>';
  if (o.destino && !o.misterio) {
    const d = o.destino;
    const otras = estado.opciones.length > 1 ? ' Con las flechas de arriba ves otros destinos.' : '';
    const detalle = d.tipo === 'estacion' ? `Línea ${d.lineas.join(' y ')} del metro.` : `${mayuscula(tipoLugar(d))}${d.idaYVuelta ? ', ida y vuelta' : ''}.`;
    html += `<div class="bloque"><h3>${ICONO_TIPO[d.tipo] || '📍'} Destino: ${escapar(mayuscula(nombreLugar(d)))}</h3>
      <p>${escapar(detalle)}${otras}</p></div>`;
  }
  if (o.explicacion?.length) {
    html += `<div class="bloque"><h3>Por qué esta ruta</h3>
      <ul class="explicacion">${o.explicacion.map((f) => `<li>${escapar(f)}</li>`).join('')}</ul>
      <p class="nota-limites">${escapar(textosEstilo.limites)}</p></div>`;
  }
  html += bloqueCalidad('A pie', o.evaluacionPie, 'pie', estilo);
  if (o.evaluacionBici) html += bloqueCalidad('En bici', o.evaluacionBici, 'bici');
  if (o.estacionSalida) {
    html += `<div class="bloque"><h3>Estaciones Bike Itaú</h3>
      <p>Tomas la bici en <strong>${escapar(o.estacionSalida.nombre)}</strong> (${o.estacionSalida.bicis} bicis ahora).</p>
      <p>La dejas en <strong>${escapar(o.estacionLlegada.nombre)}</strong> (${o.estacionLlegada.anclajes} anclajes libres ahora).</p>
      <p class="ayuda">La disponibilidad cambia minuto a minuto.</p></div>`;
  }
  if (o.repetida > 0.15 && !o.destino?.idaYVuelta) html += '<p class="alerta">Parte de la ruta va y vuelve por la misma calle.</p>';
  html += '<div class="bloque" id="comparacion" hidden></div>';
  html += '<div class="bloque" id="seguridad" hidden></div>';
  html += `<div class="leyenda">
    <span><i style="background:${COLORES.buena}"></i>${escapar(mayuscula(textosEstilo.buena))}</span>
    <span><i style="background:${COLORES.media}"></i>${escapar(mayuscula(textosEstilo.media))}</span>
    <span><i style="background:${COLORES.mala}"></i>${escapar(mayuscula(textosEstilo.mala))}</span>
    ${o.metrosBici ? '<span>- - - en bici</span>' : ''}
    ${o.extras?.interes?.length ? '<span>★ lugar interesante</span>' : ''}
  </div>
  <p class="ayuda">Toca un tramo de la ruta en el mapa para ver qué tipo de calle es.</p>`;
  $('#detalle-opcion').innerHTML = html;
  mostrarEstado($('#estado-resultados'), '');
  pintarBotonFavorita();
  $('#cambiar-busqueda').textContent = estado.origenBusqueda === 'formulario' ? 'Cambiar búsqueda' : 'Volver';
  mapa.dibujarOpcion(o, margenesPanel());
  mostrarComparacion(o);
  mostrarSeguridad(o);
}

// Lo que se sabe de seguridad, con datos reales: si terminarías de noche (puesta de sol de Open-Meteo), el cierre del
// metro y los robos violentos de las comunas por las que pasa la ruta (CEAD). Nada de esto es por calle.
async function mostrarSeguridad(o) {
  const caja = $('#seguridad');
  if (!caja) return;
  const aj = almacen.ajustes();
  const avisos = [];
  const ahora = new Date();
  // En bici se calcula a unos 15 km/h (250 m por minuto).
  const minutos = desdeMetros(o.metrosPie, 'minutos', aj) + (o.metrosBici || 0) / 250;
  const fin = new Date(ahora.getTime() + minutos * 60000);
  const puesta = estado.clima?.puesta;
  const salida = estado.clima?.salida;
  const sugerirNoche = o.estilo === 'noche' ? '' : ' Si no conoces la zona, considera el estilo Noche o un paseo más corto.';
  if (salida && ahora < new Date(salida.getTime() - 20 * 60000)) {
    avisos.push(o.estilo === 'noche' ? 'Todavía no amanece: vas con el estilo Noche (iluminado y con movimiento).' : `Todavía no amanece (el sol sale a las ${formatearHora(salida)}).${sugerirNoche}`);
  } else if (puesta && ahora > new Date(puesta.getTime() + 20 * 60000)) {
    avisos.push(o.estilo === 'noche' ? 'Ya oscureció: vas con el estilo Noche (iluminado y con movimiento).' : `Ya oscureció (el sol se puso a las ${formatearHora(puesta)}).${sugerirNoche}`);
  } else if (puesta && fin > new Date(puesta.getTime() + 10 * 60000)) {
    avisos.push(`Si sales ahora, terminarías cerca de las ${formatearHora(fin)}, después de la puesta de sol (${formatearHora(puesta)}).${sugerirNoche}`);
  }
  if (o.destino?.tipo === 'estacion' && (fin.getHours() >= 23 || (fin.getHours() === 22 && fin.getMinutes() >= 30))) {
    avisos.push('Ojo: el metro suele cerrar cerca de las 23:00 (según la prensa). Revisa el horario del día en metro.cl.');
  }
  let delitos = null;
  try {
    const [comunas, datosDelitos] = await Promise.all([cargarComunas(), cargarDelitos()]);
    if (estado.opciones[estado.indice] !== o) return;
    delitos = textoDelitos(comunasDeRuta(o.partes.flatMap((p) => p.ruta.coords), comunas), datosDelitos);
  } catch (err) {
    console.error(err);
  }
  if (!avisos.length && !delitos) {
    caja.hidden = true;
    return;
  }
  caja.innerHTML =
    `<h3>Seguridad: lo que se sabe</h3>${avisos.map((a) => `<p>${escapar(a)}</p>`).join('')}` +
    (delitos ? `<p>${escapar(delitos)}</p><p class="nota-limites">${escapar(LIMITES_DELITOS)}</p>` : '');
  caja.hidden = false;
}

const ESTILO_NOMBRE = { tranquilo: 'Tranquilo', vida: 'Con vida', noche: 'Noche' };
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Qué se compara con el camino más corto: toda la ruta (A→B), la ida y vuelta a la plaza, o la caminata hasta la
// estación Bike Itaú. En un paseo circular no hay "camino más corto" con qué comparar.
function datosComparacion(o) {
  const coords = o.partes[0].ruta.coords;
  if (o.destino?.idaYVuelta) {
    return {
      desde: coords[0],
      hasta: o.destino.punto,
      factor: 2,
      ruta: { metros: o.metrosPie, evaluacion: o.evaluacionPie },
      destino: ` a ${nombreLugar(o.destino)}`,
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
  const estilo = o.estilo || 'tranquilo';
  const clave = `${estilo}:${datos.desde.concat(datos.hasta).map((x) => x.toFixed(5)).join(',')}`;
  caja.hidden = false;
  caja.innerHTML = '<h3>Comparado con el camino más corto</h3><p class="ayuda">Calculando…</p>';
  try {
    if (!estado.comparaciones.has(clave)) estado.comparaciones.set(clave, caminoCorto(datos.desde, datos.hasta, estilo));
    const corto = await estado.comparaciones.get(clave);
    if (estado.opciones[estado.indice] !== o) return;
    if (!corto) {
      caja.hidden = true;
      return;
    }
    const frases = textoComparacion({ corto, ...datos, estilo });
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
  const nombre = o.destino ? `Paseo a ${nombreLugar(o.destino)}` : 'Paseo';
  const texto = crearGpx(o, { nombre, fecha });
  const archivo = new File([texto], nombreArchivo(fecha), { type: 'application/gpx+xml' });
  // En el celular se intenta abrir el menú de compartir para elegir OsmAnd u Organic Maps directamente.
  await compartirODescargar(archivo, nombre);
});

// ---------- Rutas favoritas ----------

function nombrePorDefecto(o) {
  const aj = almacen.ajustes();
  const minutos = Math.round(desdeMetros(o.metrosPie, 'minutos', aj) / 5) * 5;
  if (o.destino) return `${mayuscula(nombreLugar(o.destino))} (${minutos} min)`;
  const coords = o.partes[0].ruta.coords;
  const circular = distancia(coords[0], o.partes.at(-1).ruta.coords.at(-1)) < 80;
  return `${circular ? 'Vuelta' : 'Paseo'} de ${minutos} min (${ESTILO_NOMBRE[o.estilo] || 'Tranquilo'})`;
}

// Guarda la opción como favorita, con un nombre que elige Bastián. Devuelve el texto para mostrar.
function guardarFavorita(o) {
  if (o.favorita) return 'Esta ruta ya está en tus favoritas.';
  const receta = recetaDe(o);
  if (!receta) return 'Las rutas con Bike Itaú no se guardan como favoritas: dependen de las bicis de ese momento.';
  const nombre = prompt('Nombre de la ruta favorita', nombrePorDefecto(o));
  if (!nombre || !nombre.trim()) return '';
  const favorita = { id: `f${Date.now()}`, nombre: nombre.trim(), creada: new Date().toISOString(), metros: Math.round(o.metrosPie), receta };
  if (!almacen.agregarFavorita(favorita)) return 'No se pudo guardar: el navegador no tiene espacio.';
  o.favorita = favorita.id;
  return `Guardada en favoritas: aparece en la pantalla Hoy.`;
}

$('#guardar-favorita').addEventListener('click', () => {
  const texto = guardarFavorita(estado.opciones[estado.indice]);
  if (texto) mostrarEstado($('#estado-resultados'), texto);
  pintarBotonFavorita();
});

function pintarBotonFavorita() {
  const o = estado.opciones[estado.indice];
  $('#guardar-favorita').textContent = o?.favorita ? '★ Favorita' : '☆ Favorita';
}

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

$('#empezar').addEventListener('click', () => empezarPaseo(estado.opciones[estado.indice]));

// Empieza el seguimiento de una opción. En un paseo sorpresa (`opcion.misterio`) no se dibuja la ruta ni se dice el
// destino hasta llegar.
function empezarPaseo(opcion) {
  irA('seguimiento');
  document.body.classList.add('siguiendo');
  estado.seguirme = true;
  $('#centrar').textContent = 'Siguiéndote';
  $('#aviso-ruta').hidden = true;
  $('#faltan-principal').textContent = 'Buscando tu ubicación…';
  $('#faltan-detalle').textContent = '';
  $('#barra-progreso').style.width = '0';
  $('#proximo').hidden = true;
  $('#captura-aviso').hidden = true;
  estado.anunciadas = new Set();
  pintarBotonVoz();
  // Hablar dentro del toque en "Empezar" deja la voz habilitada en el celular para el resto del paseo.
  if (vozActiva()) voz.decir(opcion.misterio ? 'Comienza el paseo sorpresa. Te voy diciendo dónde doblar.' : 'Comienza el paseo');
  if (opcion.misterio) mapa.limpiarRuta();
  estado.opcionSeguida = opcion;
  estado.ultimoGuardado = Date.now();
  $('#ritmo').hidden = true;
  $('#metro-cercano').hidden = true;
  pintarAyudasRitmo();
  estado.metro = null;
  cargarMetro()
    .then((m) => {
      estado.metro = m;
    })
    .catch(() => {});
  // Lugares de la Santiagodex cerca de la ruta, para capturarlos al pasar (y avisar en voz alta).
  estado.capturasPaseo = [];
  estado.dexCercanos = [];
  const inicioRuta = opcion.partes[0].ruta.coords[0];
  cargarDex()
    .then((dexLista) => {
      const radio = Math.max(1500, opcion.metrosPie / 2 + 500);
      estado.dexCercanos = dexLista.filter((l) => distancia(l.punto, inicioRuta) < radio);
    })
    .catch(() => {});
  estado.seguimiento = new Seguimiento(opcion, {
    alActualizar: actualizarSeguimiento,
    alError: (mensaje) => {
      $('#aviso-ruta').textContent = mensaje;
      $('#aviso-ruta').hidden = false;
    },
  });
  estado.seguimiento.iniciar();
}

// Captura en vivo: al llegar a un lugar de la Santiagodex se guarda y se avisa. En un paseo sorpresa, llegar al
// destino lo revela.
function revisarCapturas(punto) {
  const o = estado.opcionSeguida;
  let revelado = null;
  if (o?.misterio && o.destino && distancia(punto, o.destino.punto) <= radioCaptura(o.destino) + 10) {
    revelarSorpresa(o);
    revelado = o.destino;
  }
  const cerca = estado.dexCercanos.filter((l) => distancia(punto, l.punto) <= radioCaptura(l));
  if (!cerca.length) return;
  const d = almacen.dex();
  const { nuevosCapturados } = anotarRecorrido(d, { capturados: cerca, vistos: [] });
  if (!nuevosCapturados.length) return;
  almacen.guardarDex(d);
  estado.capturasPaseo.push(...nuevosCapturados);
  const sorpresa = revelado && nuevosCapturados.find((l) => l.id === revelado.id);
  const l = sorpresa || nuevosCapturados[0];
  const aviso = $('#captura-aviso');
  aviso.textContent = sorpresa
    ? `🎉 El lugar sorpresa era ${l.nombre}: ¡capturado! (${numeroDex(l.numero)} de tu Santiagodex)`
    : `${ICONO_TIPO[l.tipo] || '⭐'} ¡Capturaste ${l.nombre}! (${numeroDex(l.numero)} de tu Santiagodex)`;
  aviso.hidden = false;
  if (vozActiva()) voz.decir(sorpresa ? 'Y queda capturado en tu Santiagodex.' : `Capturaste ${l.nombre} para tu Santiagodex.`, { interrumpir: false });
}

function revelarSorpresa(o) {
  o.misterio = false;
  o.revelado = true;
  const aviso = $('#captura-aviso');
  aviso.textContent = `🎉 El lugar sorpresa era: ${mayuscula(nombreLugar(o.destino))}`;
  aviso.hidden = false;
  if (vozActiva()) voz.decir(`Llegaste al lugar sorpresa: ${nombreLugar(o.destino)}.`);
  mapa.dibujarOpcion(o, margenesPanel());
}

// Lo mínimo para rearmar el paseo si el navegador se cierra sin "Terminar" (se guarda cada 20 segundos).
function datosEnCurso(seguimiento, opcion) {
  const r5 = (x) => Math.round(x * 1e5) / 1e5;
  return {
    inicio: seguimiento.inicio,
    titulo: tituloPaseo(opcion),
    estilo: opcion.estilo,
    metrosRuta: opcion.metrosPie,
    subidaRuta: subidaDe(opcion),
    rastro: seguimiento.rastro.map(({ p, t }) => [r5(p[0]), r5(p[1]), t]),
  };
}

const subidaDe = (o) => o.partes.filter((p) => p.modo === 'pie').reduce((s, p) => s + (p.ruta.subida || 0), 0);

function tituloPaseo(o) {
  if (o.tituloOriginal) return o.tituloOriginal;
  const favorita = o.favorita && almacen.favoritas().find((f) => f.id === o.favorita);
  if (favorita) return favorita.nombre;
  if (o.destino) return `A ${nombreLugar(o.destino)}`;
  if (o.estacionSalida) return 'Paseo con Bike Itaú';
  const coords = o.partes[0].ruta.coords;
  return distancia(coords[0], o.partes.at(-1).ruta.coords.at(-1)) < 80 ? 'Vuelta' : 'Paseo';
}

function actualizarSeguimiento(d) {
  const aj = almacen.ajustes();
  const f = d.faltante;
  if (Date.now() - estado.ultimoGuardado > 20000 && estado.seguimiento) {
    estado.ultimoGuardado = Date.now();
    almacen.guardarPaseoEnCurso(datosEnCurso(estado.seguimiento, estado.opcionSeguida));
  }
  mapa.mostrarYo(d.punto, d.precision);
  if (estado.seguirme) mapa.centrarEn(d.punto);
  revisarCapturas(d.punto);
  $('#modo-actual').textContent = estado.opcionSeguida?.misterio ? 'Paseo sorpresa 🎲' : f.modoActual === 'bici' ? 'Tramo en bici' : 'Tramo a pie';
  if (f.total < 25 && d.recorrido > 0) {
    $('#faltan-principal').textContent = '¡Llegaste!';
    $('#faltan-detalle').textContent = `Caminaste unos ${formatearPasos(Math.round(desdeMetros(estado.opcionSeguida.metrosPie, 'pasos', aj)))}.`;
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
  // En un paseo sorpresa, la llegada al destino no dice su nombre.
  const siguiente = estado.opcionSeguida?.misterio && d.siguiente?.tipo === 'destino' ? { ...d.siguiente, texto: 'Llegas al lugar sorpresa' } : d.siguiente;
  mostrarProximo(siguiente);
  mostrarRitmo(aj);
  mostrarMetroCercano(d.punto);
  $('#bolsillo-proximo').textContent = siguiente ? `${siguiente.distancia < 15 ? 'Ahora' : `En ${formatearDistancia(siguiente.distancia)}`}: ${siguiente.texto}` : '';
  $('#bolsillo-falta').textContent = $('#faltan-principal').textContent;
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

// ---------- Llévame al metro ----------

// Durante el paseo se muestra la estación de metro más cercana (en línea recta) como salida de emergencia: si te
// sientes incómodo, un toque te lleva hasta ella por calles con movimiento (estilo "Con vida").
function mostrarMetroCercano(punto) {
  const caja = $('#metro-cercano');
  if (!estado.metro) return;
  let cercana = null;
  for (const e of estado.metro.estaciones) {
    const d = distancia(punto, e.punto);
    if (!cercana || d < cercana.d) cercana = { e, d };
  }
  const yendo = estado.opcionSeguida?.destino?.tipo === 'estacion' && estado.opcionSeguida.destino.nombre === cercana?.e.nombre;
  caja.hidden = !cercana || cercana.d > 3000 || (yendo && estado.opcionSeguida.haciaMetro);
  if (caja.hidden) return;
  estado.metroCercano = { ...cercana, desde: punto };
  $('#metro-cercano-texto').textContent = `🚇 Metro más cercano: ${nombreEstacion(cercana.e)}, a ${formatearDistancia(cercana.d)}`;
}

$('#llevame-metro').addEventListener('click', async () => {
  const c = estado.metroCercano;
  if (!c || !estado.seguimiento) return;
  const boton = $('#llevame-metro');
  boton.disabled = true;
  boton.textContent = 'Buscando…';
  try {
    const nueva = await rutaHasta(c.desde, c.e.punto, c.e, 'vida');
    nueva.haciaMetro = true;
    nueva.tituloOriginal = tituloPaseo(estado.opcionSeguida);
    estado.opcionSeguida = nueva;
    estado.anunciadas = new Set();
    estado.seguimiento.cambiarRuta(nueva);
    mapa.dibujarOpcion(nueva, margenesPanel());
    if (vozActiva()) voz.decir(`Te llevo a la estación ${c.e.nombre}, a ${Math.round(nueva.metrosPie / 10) * 10} metros.`);
    $('#metro-cercano').hidden = true;
  } catch (err) {
    $('#aviso-ruta').textContent = mensajeDeError(err);
    $('#aviso-ruta').hidden = false;
  } finally {
    boton.disabled = false;
    boton.textContent = 'Llévame';
  }
});

// ---------- Ritmo, metrónomo, intervalos y modo bolsillo ----------

// Ritmo de los últimos ~45 segundos y minutos a paso enérgico en lo que va del paseo.
function mostrarRitmo(aj) {
  const seguimiento = estado.seguimiento;
  if (!seguimiento || seguimiento.rastro.length < 3) return;
  const kmh = ritmoReciente(seguimiento.rastro);
  const m = medirMovimiento(seguimiento.rastro, aj.energicoKmh);
  if (kmh === null && m.minutos < 1) return;
  const decimal = (x) => x.toLocaleString('es-CL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const ritmo = kmh === null ? '' : kmh === 0 ? 'Detenido · ' : `${decimal(kmh)} km/h${kmh >= aj.energicoKmh ? ' (enérgico)' : ''} · `;
  $('#ritmo').textContent = `${ritmo}${Math.round(m.minutos)} min caminando, ${Math.round(m.minutosEnergicos)} a paso enérgico`;
  $('#ritmo').classList.toggle('energico', kmh !== null && kmh >= aj.energicoKmh);
  $('#ritmo').hidden = false;
}

const metronomo = new Metronomo();

function pintarAyudasRitmo() {
  $('#boton-metronomo').hidden = !metronomo.disponible;
  $('#boton-metronomo').setAttribute('aria-pressed', String(metronomo.activo));
  $('#boton-metronomo').classList.toggle('activo', metronomo.activo);
  $('#boton-intervalos').setAttribute('aria-pressed', String(Boolean(estado.intervalos)));
  $('#boton-intervalos').classList.toggle('activo', Boolean(estado.intervalos));
  $('#intervalo').hidden = !estado.intervalos;
}

const faseActual = () => (estado.intervalos ? faseIntervalo((Date.now() - estado.intervalos.inicio) / 1000).fase : null);

$('#boton-metronomo').addEventListener('click', () => {
  if (metronomo.activo) metronomo.detener();
  else metronomo.iniciar(ppmDeFase(almacen.ajustes().ppm, faseActual()));
  pintarAyudasRitmo();
});

$('#boton-intervalos').addEventListener('click', () => {
  if (estado.intervalos) {
    detenerIntervalos();
  } else {
    estado.intervalos = { inicio: Date.now(), numero: -1, reloj: setInterval(actualizarIntervalo, 1000) };
    actualizarIntervalo();
  }
  pintarAyudasRitmo();
});

function actualizarIntervalo() {
  const f = faseIntervalo((Date.now() - estado.intervalos.inicio) / 1000);
  $('#intervalo-fase').textContent = f.fase === 'rapido' ? 'Paso rápido' : 'Paso suave';
  $('#intervalo').classList.toggle('rapido', f.fase === 'rapido');
  const s = Math.ceil(f.restante);
  $('#intervalo-tiempo').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (f.numero !== estado.intervalos.numero) {
    estado.intervalos.numero = f.numero;
    if (vozActiva()) voz.decir(FRASE_FASE[f.fase], { interrumpir: false });
    if (metronomo.activo) metronomo.cambiar(ppmDeFase(almacen.ajustes().ppm, f.fase));
  }
}

function detenerIntervalos() {
  if (!estado.intervalos) return;
  clearInterval(estado.intervalos.reloj);
  estado.intervalos = null;
  if (metronomo.activo) metronomo.cambiar(almacen.ajustes().ppm);
}

// Modo bolsillo: pantalla negra (gasta menos batería y no llama la atención) y la voz guía. Para salir hay que
// mantener apretado 1,5 segundos, así un roce en el bolsillo no lo cierra.
$('#boton-bolsillo').addEventListener('click', () => {
  if (voz.disponible && !vozActiva()) {
    almacen.guardarAjustes({ voz: true });
    pintarBotonVoz();
  }
  $('#bolsillo').hidden = false;
  if (vozActiva()) voz.decir('Modo bolsillo. Te aviso cada giro.');
});

function cerrarBolsillo() {
  $('#bolsillo').hidden = true;
  cancelarSalidaBolsillo();
}

function cancelarSalidaBolsillo() {
  clearTimeout(estado.salidaBolsillo);
  $('#bolsillo-carga').style.transition = 'none';
  $('#bolsillo-carga').style.width = '0';
}

const pantallaBolsillo = $('#bolsillo');
pantallaBolsillo.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const carga = $('#bolsillo-carga');
  carga.style.transition = 'width 1.5s linear';
  carga.style.width = '100%';
  estado.salidaBolsillo = setTimeout(cerrarBolsillo, 1500);
});
for (const evento of ['pointerup', 'pointercancel', 'pointerleave']) pantallaBolsillo.addEventListener(evento, cancelarSalidaBolsillo);
pantallaBolsillo.addEventListener('contextmenu', (e) => e.preventDefault());

// Termina el paseo, lo guarda en el historial y muestra el resumen. Con `volver = false` (al salir de la vista por
// otro camino) igual se guarda, para no perder lo caminado.
function terminarSeguimiento(volver = true) {
  voz.callar();
  metronomo.detener();
  detenerIntervalos();
  pintarAyudasRitmo();
  cerrarBolsillo();
  const seguimiento = estado.seguimiento;
  seguimiento?.detener();
  estado.seguimiento = null;
  mapa.ocultarYo();
  document.body.classList.remove('siguiendo');
  if (!seguimiento) return;
  const registro = guardarPaseo(datosEnCurso(seguimiento, estado.opcionSeguida));
  if (!volver) return;
  if (!registro) {
    irA('resultados');
    mostrarOpcion();
    mostrarEstado($('#estado-resultados'), 'No se guardó en el historial: el paseo fue muy corto (menos de 100 m o de 1 minuto).');
    return;
  }
  mostrarResumen(registro, seguimiento, estado.opcionSeguida);
}

// Convierte los datos de un paseo (en curso o que quedó pendiente) en un registro del historial y lo guarda.
// Devuelve el registro, o null si fue demasiado corto para contarlo.
function guardarPaseo(datos) {
  almacen.borrarPaseoEnCurso();
  const rastro = (datos.rastro || []).map(([lat, lon, t]) => ({ p: [lat, lon], t }));
  if (rastro.length < 2) return null;
  const aj = almacen.ajustes();
  const previo = crearRegistro({ rastro, inicio: datos.inicio, fin: rastro.at(-1).t, ajustes: aj, titulo: datos.titulo, estilo: datos.estilo });
  if (previo.metros < 100 || previo.minutos < 1) return null;
  // La subida se estima con la de la ruta, en proporción a lo caminado (la altura del GPS no es confiable).
  const subida = datos.subidaRuta ? datos.subidaRuta * Math.min(1, previo.metros / (datos.metrosRuta || previo.metros)) : 0;
  const registro = subida ? crearRegistro({ rastro, inicio: datos.inicio, fin: rastro.at(-1).t, ajustes: aj, titulo: datos.titulo, estilo: datos.estilo, subida }) : previo;
  if (!almacen.agregarAlHistorial(registro)) {
    alert('No se pudo guardar el paseo: el navegador no tiene espacio o bloquea el almacenamiento. Descarga un respaldo.');
  }
  return registro;
}

// ---------- Resumen al terminar ----------

function mostrarResumen(registro, seguimiento, opcion) {
  const aj = almacen.ajustes();
  const antes = estadoSemanas(almacen.historial().filter((r) => r.id !== registro.id), almacen.metas().lista);
  const ahora = estadoSemanas(almacen.historial(), almacen.metas().lista);
  irA('resumen');
  const completo = seguimiento.recorrido > 0 && seguimiento.linea.total - seguimiento.recorrido < 40;
  $('#resumen-titulo').textContent = completo ? '¡Llegaste! Buen paseo' : '¡Buen paseo!';
  $('#resumen-cifras').textContent = `${formatearDistancia(registro.metros)} · ${formatearMinutos(Math.round(registro.minutos))}`;
  $('#resumen-detalle').textContent = [
    `≈ ${formatearPasos(Math.round(desdeMetros(registro.metros, 'pasos', aj) / 100) * 100)}`,
    registro.kcal !== null && `≈ ${formatearKcal(registro.kcal)}`,
    registro.energicos >= 1 && `${Math.round(registro.energicos)} min a paso enérgico`,
  ]
    .filter(Boolean)
    .join(' · ');
  let semana;
  if (ahora.meta === null) semana = `Esta semana llevas ${Math.round(ahora.minutos)} min. Elige una meta semanal en la pantalla Hoy.`;
  else if (antes.minutos < antes.meta && ahora.minutos >= ahora.meta) semana = `🎉 ¡Cumpliste la meta de la semana! (${Math.round(ahora.minutos)} de ${ahora.meta} min)`;
  else if (ahora.minutos >= ahora.meta) semana = `Esta semana llevas ${Math.round(ahora.minutos)} min: ya pasaste tu meta de ${ahora.meta}.`;
  else semana = `Esta semana llevas ${Math.round(ahora.minutos)} de ${ahora.meta} min. Te faltan ${formatearMinutos(Math.ceil(ahora.meta - ahora.minutos))}.`;
  $('#resumen-semana').textContent = semana;
  mostrarEstado($('#estado-resumen'), '');
  $('#resumen-favorita').hidden = Boolean(opcion.favorita) || !recetaDe(opcion);
  $('#resumen-favorita').onclick = () => {
    const texto = guardarFavorita(opcion);
    if (texto) mostrarEstado($('#estado-resumen'), texto);
    $('#resumen-favorita').hidden = Boolean(opcion.favorita);
  };
  if (opcion.misterio) {
    opcion.misterio = false;
    mostrarEstado($('#estado-resumen'), `🎲 El lugar sorpresa era: ${mayuscula(nombreLugar(opcion.destino))}.`);
  }
  mapa.dibujarOpcion(opcion, margenesPanel());
  mapa.mostrarRecorridos([registro.rastro], margenesPanel(), { encuadrar: false });
  ofrecerMarcarCaminado(registro);
  const semanaCorta = `Esta semana: ${Math.round(ahora.minutos)}${ahora.meta ? ` de ${ahora.meta}` : ''} min caminando`;
  estado.ultimoResumen = { registro, capturas: [...estado.capturasPaseo], semana: semanaCorta };
  pintarDexResumen(registro);
}

// Lo nuevo de la Santiagodex en este paseo: lo capturado en vivo más lo que el recorrido completo deja visto o
// capturado (por si el GPS saltó justo al pasar).
async function pintarDexResumen(registro) {
  const caja = $('#resumen-dex');
  caja.hidden = true;
  try {
    const dexLista = await cargarDex();
    const d = almacen.dex();
    const { nuevosCapturados, nuevosVistos } = anotarRecorrido(d, revisarRecorrido(registro.rastro, dexLista));
    almacen.guardarDex(d);
    const capturas = [...estado.capturasPaseo, ...nuevosCapturados];
    estado.ultimoResumen.capturas = capturas;
    if (!capturas.length && !nuevosVistos.length) return;
    const total = dexLista.filter((l) => estadoDe(l, d) === 'capturado').length;
    caja.innerHTML =
      (capturas.length
        ? `<h3>¡Nuevo en tu Santiagodex!</h3><ul class="explicacion">${capturas
            .map((l) => `<li>${numeroDex(l.numero)} ${ICONO_TIPO[l.tipo] || ''} ${escapar(l.nombre)}</li>`)
            .join('')}</ul>`
        : '') +
      (nuevosVistos.length ? `<p>Pasaste cerca de ${nuevosVistos.length === 1 ? '1 lugar' : `${nuevosVistos.length} lugares`} sin llegar: quedan como vistos.</p>` : '') +
      `<p class="ayuda">Llevas ${total} de ${dexLista.length.toLocaleString('es-CL')} capturados.</p>`;
    caja.hidden = false;
  } catch (err) {
    console.error(err);
  }
}

$('#compartir-postal').addEventListener('click', async () => {
  const r = estado.ultimoResumen;
  if (!r) return;
  const blob = await dibujarPostal(r.registro, { capturas: r.capturas, semana: r.semana });
  const fecha = new Date(r.registro.inicio).toISOString().slice(0, 10);
  const resultado = await compartirODescargar(new File([blob], `paseo-${fecha}.png`, { type: 'image/png' }), 'Mi paseo');
  if (resultado === 'descargado') mostrarEstado($('#estado-resumen'), 'Postal descargada.');
});

// ---------- Explorar: lo que ya conoces (solo se marca a mano) ----------

function marcarConocidas(coords, mensaje, aviso = $('#estado-resultados')) {
  const nuevas = almacen.agregarConocidas(celdasDeRuta(coords));
  estado.ultimasMarcadas = nuevas;
  aviso.innerHTML = '';
  aviso.append(`${mensaje} (${nuevas.length} cuadras nuevas). `);
  if (nuevas.length) {
    const deshacer = document.createElement('button');
    deshacer.type = 'button';
    deshacer.className = 'boton-texto';
    deshacer.textContent = 'Deshacer';
    deshacer.addEventListener('click', () => {
      almacen.quitarConocidas(estado.ultimasMarcadas || []);
      estado.ultimasMarcadas = [];
      mostrarEstado(aviso, 'Listo, se deshizo.');
      actualizarAyudaExplorar();
    });
    aviso.append(deshacer);
  }
  actualizarAyudaExplorar();
}

$('#ya-conozco').addEventListener('click', () => {
  const o = estado.opciones[estado.indice];
  marcarConocidas(o.partes.flatMap((p) => p.ruta.coords), 'Marcada como conocida');
});

// Al terminar un paseo se pregunta si marcar lo caminado. Solo tu recorrido real (el del GPS), y solo si fue una
// parte real.
function ofrecerMarcarCaminado(registro) {
  const caja = $('#marcar-caminado');
  caja.hidden = true;
  if (!registro || registro.metros < 200 || registro.rastro.length < 2) return;
  const coords = registro.rastro;
  $('#marcar-caminado-texto').textContent =
    `Caminaste unos ${formatearDistancia(registro.metros)}. ¿Los marco como conocidos para el modo explorar?`;
  caja.hidden = false;
  $('#marcar-caminado-si').onclick = () => {
    caja.hidden = true;
    marcarConocidas(coords, 'Marcado lo que caminaste', $('#estado-resumen'));
  };
  $('#marcar-caminado-no').onclick = () => {
    caja.hidden = true;
  };
}

function dibujarConocidas() {
  mapa.mostrarConocidas([...almacen.conocidas()].map(limitesCelda));
}

function mostrarResumenConocidas() {
  const n = almacen.conocidas().size;
  // Cada cuadro mide ~50 × 50 m = 0,0025 km².
  $('#resumen-conocidas').textContent = n
    ? `Tienes marcadas ${n} cuadras como conocidas (unos ${(n * 0.0025).toLocaleString('es-CL', { maximumFractionDigits: 1 })} km²).`
    : 'Todavía no marcas nada como conocido.';
  actualizarAyudaExplorar();
}

$('#pintar-conocidas').addEventListener('click', () => {
  dibujarConocidas();
  esperarClic('conocidas', 'Toca para marcar zonas que conoces (toca de nuevo para quitar)', 'Listo');
});

$('#borrar-conocidas').addEventListener('click', () => {
  if (!confirm('¿Borrar todo lo que marcaste como conocido? No se puede deshacer (salvo con un respaldo).')) return;
  almacen.borrarConocidas();
  mostrarResumenConocidas();
});

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
  mostrarResumenConocidas();
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

function exportarRespaldo() {
  const texto = JSON.stringify(almacen.respaldo());
  descargar(new File([texto], `paseos-respaldo-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' }));
  almacen.guardarAjustes({ ultimoRespaldo: new Date().toISOString() });
}

$('#exportar').addEventListener('click', exportarRespaldo);

$('#importar').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  if (!archivo) return;
  const aviso = $('#estado-respaldo');
  try {
    const agregados = almacen.restaurar(JSON.parse(await archivo.text()));
    alCambiarLugares();
    mostrarEstado(
      aviso,
      `${agregados.lugares === 1 ? 'Se agregó 1 lugar' : `Se agregaron ${agregados.lugares} lugares`} y ` +
        `${agregados.paseos === 1 ? '1 paseo' : `${agregados.paseos} paseos`}. ` +
        `Tienes ${almacen.conocidas().size} cuadras marcadas como conocidas.`,
    );
  } catch (err) {
    mostrarEstado(aviso, err instanceof SyntaxError ? 'El archivo no es un respaldo válido.' : err.message, true);
  }
});

// ---------- Ajustes ----------

function cargarAjustes() {
  const aj = almacen.ajustes();
  $('#meta-minutos').value = estadoSemanas([], almacen.metas().lista).meta ?? '';
  $('#largo-paso').value = aj.largoPaso;
  $('#velocidad').value = aj.velocidadKmh;
  $('#energico').value = aj.energicoKmh;
  $('#ppm').value = aj.ppm;
  $('#ver-estaciones').checked = Boolean(aj.verEstaciones);
  $('#peso').value = aj.peso ?? '';
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
  const textoPeso = $('#peso').value.trim();
  const peso = textoPeso === '' ? null : Number(textoPeso);
  if (peso !== null && !(peso >= 30 && peso <= 250)) {
    mostrarEstado(aviso, 'El peso debe estar entre 30 y 250 kg, o quedar vacío.', true);
    return;
  }
  const textoMeta = $('#meta-minutos').value.trim();
  const meta = Number(textoMeta);
  if (textoMeta !== '' && !(meta >= 10 && meta <= 1000)) {
    mostrarEstado(aviso, 'La meta semanal debe estar entre 10 y 1.000 minutos.', true);
    return;
  }
  const energicoKmh = Number($('#energico').value);
  const ppm = Number($('#ppm').value);
  if (!(energicoKmh >= 3 && energicoKmh <= 8)) {
    mostrarEstado(aviso, 'El paso enérgico debe estar entre 3 y 8 km/h.', true);
    return;
  }
  if (!(ppm >= 80 && ppm <= 150)) {
    mostrarEstado(aviso, 'El metrónomo debe estar entre 80 y 150 pasos por minuto.', true);
    return;
  }
  const metaActual = estadoSemanas([], almacen.metas().lista).meta;
  if (textoMeta !== '' && meta !== metaActual) almacen.guardarMetas({ lista: conMeta(almacen.metas().lista, meta) });
  almacen.guardarAjustes({ largoPaso, velocidadKmh, peso, energicoKmh, ppm, verEstaciones: $('#ver-estaciones').checked });
  aplicarEstaciones();
  actualizarAyudaDuracion();
  mostrarEstado(aviso, 'Guardado.');
});

// Evento semanal en el calendario del celular. En el iPhone, Safari abre los .ics con el calendario si se navega a
// ellos; en el resto se descarga el archivo.
$('#crear-agenda').addEventListener('click', () => {
  const aviso = $('#estado-agenda');
  const dias = [...document.querySelectorAll('#dias-agenda input:checked')].map((c) => Number(c.value));
  const hora = $('#agenda-hora').value;
  const minutos = Number($('#agenda-minutos').value);
  if (!dias.length) return mostrarEstado(aviso, 'Elige al menos un día.', true);
  if (!/^\d{2}:\d{2}$/.test(hora)) return mostrarEstado(aviso, 'Elige una hora.', true);
  if (!(minutos >= 5 && minutos <= 240)) return mostrarEstado(aviso, 'Los minutos deben estar entre 5 y 240.', true);
  const texto = crearIcs({ dias, hora, minutos, meta: estadoSemanas([], almacen.metas().lista).meta });
  const archivo = new File([texto], 'salir-a-caminar.ics', { type: 'text/calendar' });
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(texto)}`;
  } else {
    descargar(archivo);
  }
  mostrarEstado(aviso, 'Listo. Revisa tu calendario: el evento se repite cada semana.');
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

// ---------- Clima y aire ----------

// Se consulta una vez al abrir la app (en tu ubicación si ya diste permiso, si no en el centro del mapa) y se
// muestra arriba del formulario. Si falla, la app sigue sin el dato.
async function mostrarClima(punto) {
  const caja = $('#clima');
  try {
    estado.clima = await consultarClima(punto);
    const { linea, avisos, nivel } = leerClima(estado.clima);
    if (!linea) return;
    const mejor = textoMejorHora(mejorHora(estado.clima));
    caja.className = `clima ${nivel}`;
    caja.innerHTML =
      `<p><strong>Ahora:</strong> ${escapar(linea)}</p>${avisos.map((a) => `<p>${escapar(a)}</p>`).join('')}` +
      (mejor ? `<p class="mejor-hora">🕖 ${escapar(mejor)}</p>` : '');
    caja.hidden = false;
  } catch (err) {
    console.error(err);
  }
}

// ---------- Inicio ----------

const hoy = iniciarHoy({
  salirAhora,
  abrirFavorita,
  exportarRespaldo,
  guardarPendiente: (datos) => {
    const registro = guardarPaseo(datos);
    mostrarEstado($('#estado-salir'), registro ? `Guardado en el historial: ${formatearMinutos(Math.round(registro.minutos))}.` : 'Era muy corto para guardarlo.');
  },
  siguiendo: () => Boolean(estado.seguimiento),
});
const historial = iniciarHistorial({ mapa, margenes: margenesPanel, verEnMapa, alCambiar: () => {} });
const dex = iniciarDex({ mapa, margenes: margenesPanel, verEnMapa, cerrarMapa: terminarEspera, irACapturar });

restaurarFormulario();
irA('hoy');
aplicarEstaciones();

// Si el permiso de ubicación ya estaba dado, centra el mapa en ti sin preguntar.
const centroInicial = () => {
  const c = mapa.mapa.getCenter();
  return [c.lat, c.lng];
};
(navigator.permissions?.query({ name: 'geolocation' }) ?? Promise.reject(new Error('sin permisos')))
  .then((p) => (p.state === 'granted' ? ubicacionActual() : Promise.reject(new Error('sin permiso'))))
  .then((punto) => {
    mapa.centrarEn(punto, 15);
    mostrarClima(punto);
  })
  .catch(() => mostrarClima(puntoConocido('partida') || centroInicial()));
