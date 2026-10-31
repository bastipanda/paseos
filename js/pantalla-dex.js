// Pantalla "Santiagodex": la colección de lugares, la ficha de cada uno y "Tu mapa de Santiago".

import * as almacen from './almacen.js';
import { escapar, parrafoWikipedia } from './mapa.js';
import { $, mostrarEstado, formatearFecha } from './ui.js';
import { cargarDex, cargarComunas } from './datos.js';
import { TIPOS_DEX, numeroDex, estadoDe, avanceDex } from './dex.js';
import { avancePorComuna } from './territorio.js';
import { celdasDeRuta, limitesCelda } from './explorar.js';
import { ICONO_TIPO, tipoLugar } from './plazas.js';
import { distancia } from './geo.js';
import { formatearDistancia } from './duracion.js';
import { ubicacionActual } from './seguimiento.js';

const POR_PAGINA = 40;
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export function iniciarDex({ mapa, margenes, verEnMapa, cerrarMapa, irACapturar }) {
  let dex = [];
  let pagina = 1;
  let origen = null;

  // Al tocar un lugar en el mapa se vuelve a la página con su ficha abierta.
  const abrirDesdeMapa = (l) => {
    cerrarMapa();
    mostrarFicha(l);
  };

  async function mostrar() {
    mapa.limpiarRuta();
    $('#dex-ficha').hidden = true;
    try {
      dex = await cargarDex();
    } catch (err) {
      mostrarEstado($('#dex-resumen'), 'No se pudo cargar la Santiagodex. Revisa la conexión.', true);
      return;
    }
    llenarFiltros();
    pagina = 1;
    pintar();
    pintarAvanceComunas();
  }

  function llenarFiltros() {
    const tipo = $('#dex-tipo');
    if (!tipo.options.length) {
      tipo.innerHTML = '<option value="">Todos los tipos</option>' + TIPOS_DEX.map((t) => `<option value="${t}">${ICONO_TIPO[t]} ${mayuscula(tipoLugar({ tipo: t }))}</option>`).join('');
    }
    const comuna = $('#dex-comuna');
    if (!comuna.options.length) {
      const comunas = [...new Set(dex.map((l) => l.comuna).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
      comuna.innerHTML = '<option value="">Todas las comunas</option>' + comunas.map((c) => `<option>${escapar(c)}</option>`).join('');
      comuna.hidden = !comunas.length;
    }
  }

  function filtrados() {
    const estado = almacen.dex();
    const filtro = document.querySelector('input[name="dex-filtro"]:checked').value;
    const tipo = $('#dex-tipo').value;
    const comuna = $('#dex-comuna').value;
    let lista = dex.filter((l) => {
      const e = estadoDe(l, estado);
      if (filtro === 'faltan' && e === 'capturado') return false;
      if (filtro === 'capturados' && e !== 'capturado') return false;
      return (!tipo || l.tipo === tipo) && (!comuna || l.comuna === comuna);
    });
    if ($('#dex-cerca').checked && origen) lista = lista.map((l) => ({ l, d: distancia(origen, l.punto) })).sort((a, b) => a.d - b.d).map((x) => x.l);
    return { lista, estado };
  }

  function pintar() {
    const estado = almacen.dex();
    const avance = avanceDex(dex, estado);
    $('#dex-resumen').textContent = `Capturados: ${avance.capturados} de ${avance.total.toLocaleString('es-CL')} · vistos: ${avance.vistos}.`;
    $('#dex-barra').style.width = `${avance.total ? Math.max(0.5, (avance.capturados / avance.total) * 100) : 0}%`;
    const { lista } = filtrados();
    const ul = $('#dex-lista');
    ul.innerHTML = '';
    for (const l of lista.slice(0, pagina * POR_PAGINA)) {
      const e = estadoDe(l, estado);
      const li = document.createElement('li');
      li.className = `entrada ${e}`;
      const lejos = origen ? ` · ${formatearDistancia(distancia(origen, l.punto))}` : '';
      li.innerHTML = `<button type="button" class="paseo">
          <strong>${numeroDex(l.numero)} ${ICONO_TIPO[l.tipo] || ''} ${escapar(l.nombre)}</strong>
          <span class="secundario">${escapar(mayuscula(tipoLugar(l)))}${l.comuna ? ` · ${escapar(l.comuna)}` : ''}${lejos}</span>
        </button>
        <span class="marca" title="${e}">${e === 'capturado' ? '✓' : e === 'visto' ? '👁' : ''}</span>`;
      li.querySelector('button').addEventListener('click', () => mostrarFicha(l));
      ul.append(li);
    }
    if (!lista.length) ul.innerHTML = '<li class="vacia">No hay lugares con ese filtro.</li>';
    $('#dex-mas').hidden = lista.length <= pagina * POR_PAGINA;
  }

  // En el mapa, los 400 primeros del filtro (más que eso se vuelve lento en el celular).
  $('#dex-ver-mapa').addEventListener('click', () => {
    const { lista, estado } = filtrados();
    if (!lista.length) return mostrarEstado($('#estado-dex'), 'No hay lugares con ese filtro.', true);
    const n = lista.length;
    verEnMapa(n > 400 ? `Los primeros 400 de ${n.toLocaleString('es-CL')} lugares` : `${n} ${n === 1 ? 'lugar' : 'lugares'}`);
    mapa.mostrarDex(
      lista.slice(0, 400).map((l) => ({ lugar: l, estado: estadoDe(l, estado) })),
      abrirDesdeMapa,
      margenes(),
    );
  });

  function mostrarFicha(l) {
    const estado = almacen.dex();
    const e = estadoDe(l, estado);
    const caja = $('#dex-ficha');
    const captura = estado.capturados[l.id];
    const textoEstado =
      e === 'capturado'
        ? `Capturado el ${formatearFecha(new Date(captura.fecha))}${captura.como === 'mano' ? ' (marcado a mano)' : ' (caminando)'}.`
        : e === 'visto'
          ? `Visto el ${formatearFecha(new Date(estado.vistos[l.id]))}: pasaste cerca, pero no llegaste.`
          : 'Por capturar.';
    caja.innerHTML = `<h3>${numeroDex(l.numero)} ${ICONO_TIPO[l.tipo] || ''} ${escapar(l.nombre)}</h3>
      <p>${escapar(mayuscula(tipoLugar(l)))}${l.comuna ? ` · ${escapar(l.comuna)}` : ''}${origen ? ` · a ${formatearDistancia(distancia(origen, l.punto))}` : ''}</p>
      <p><strong>${escapar(textoEstado)}</strong></p>
      <div class="fila botones-fila">
        ${e !== 'capturado' ? '<button type="button" class="boton-principal" data-accion="ir">Ir a capturarlo</button>' : ''}
        <button type="button" class="boton-secundario" data-accion="mapa">Ver en el mapa</button>
        ${e !== 'capturado' ? '<button type="button" class="boton-secundario" data-accion="mano">Ya lo conocía</button>' : captura.como === 'mano' ? '<button type="button" class="boton-secundario" data-accion="quitar">Quitar la captura</button>' : ''}
      </div>`;
    if (l.wikipedia) caja.append(parrafoWikipedia(l.wikipedia));
    caja.hidden = false;
    caja.scrollIntoView({ block: 'nearest' });
    caja.querySelector('[data-accion="mapa"]').addEventListener('click', () => {
      verEnMapa(l.nombre);
      mapa.mostrarDex([{ lugar: l, estado: e }], abrirDesdeMapa);
      mapa.centrarEn(l.punto, 17);
    });
    caja.querySelector('[data-accion="ir"]')?.addEventListener('click', () => irACapturar(l));
    caja.querySelector('[data-accion="mano"]')?.addEventListener('click', () => {
      const d = almacen.dex();
      d.capturados[l.id] = { fecha: new Date().toISOString(), como: 'mano' };
      almacen.guardarDex(d);
      pintar();
      mostrarFicha(l);
    });
    caja.querySelector('[data-accion="quitar"]')?.addEventListener('click', () => {
      const d = almacen.dex();
      delete d.capturados[l.id];
      almacen.guardarDex(d);
      pintar();
      mostrarFicha(l);
    });
  }

  // Tu mapa: lo caminado con la app más lo marcado como conocido, y el avance de cada comuna.
  function celdasConocidas() {
    const celdas = new Set(almacen.conocidas());
    for (const r of almacen.historial()) if (r.rastro.length > 1) for (const c of celdasDeRuta(r.rastro)) celdas.add(c);
    return celdas;
  }

  async function pintarAvanceComunas() {
    const ul = $('#avance-comunas');
    ul.innerHTML = '';
    let comunas;
    try {
      comunas = await cargarComunas();
    } catch {
      ul.innerHTML = '<li class="vacia">Falta el archivo de comunas para calcular el avance.</li>';
      return;
    }
    const avance = avancePorComuna(celdasConocidas(), comunas).filter((c) => c.conocidas > 0);
    if (!avance.length) {
      ul.innerHTML = '<li class="vacia">Todavía no caminas con la app ni marcas zonas conocidas.</li>';
      return;
    }
    for (const c of avance.slice(0, 12)) {
      const li = document.createElement('li');
      const pct = c.fraccion * 100;
      li.innerHTML = `<span class="nombre">${escapar(c.nombre)}</span>
        <span class="barrita"><span style="width:${Math.max(2, pct).toFixed(1)}%"></span></span>
        <span class="pct">${pct < 1 ? pct.toLocaleString('es-CL', { maximumFractionDigits: 1 }) : Math.round(pct)} %</span>`;
      ul.append(li);
    }
  }

  $('#ver-mi-mapa').addEventListener('click', () => {
    const conocidas = [...almacen.conocidas()];
    const lineas = almacen.historial().map((r) => r.rastro);
    const hayPaseos = lineas.some((l) => l.length > 1);
    if (!hayPaseos && !conocidas.length) {
      return mostrarEstado($('#estado-dex'), 'Todavía no caminas con la app ni marcas zonas conocidas.');
    }
    verEnMapa('Tu mapa de Santiago');
    mapa.ocultarDex();
    mapa.mostrarConocidas(conocidas.map(limitesCelda));
    if (hayPaseos) mapa.mostrarRecorridos(lineas, margenes());
  });

  document.querySelectorAll('input[name="dex-filtro"]').forEach((r) => r.addEventListener('change', () => ((pagina = 1), pintar())));
  $('#dex-tipo').addEventListener('change', () => ((pagina = 1), pintar()));
  $('#dex-comuna').addEventListener('change', () => ((pagina = 1), pintar()));
  $('#dex-mas').addEventListener('click', () => {
    pagina++;
    pintar();
  });
  $('#dex-cerca').addEventListener('change', async () => {
    if ($('#dex-cerca').checked && !origen) {
      try {
        mostrarEstado($('#estado-dex'), 'Buscando tu ubicación…');
        origen = await ubicacionActual();
        mostrarEstado($('#estado-dex'), '');
      } catch (err) {
        const c = mapa.mapa.getCenter();
        origen = [c.lat, c.lng];
        mostrarEstado($('#estado-dex'), 'Sin GPS: se ordena según el centro del mapa.');
      }
    }
    pagina = 1;
    pintar();
  });

  return { mostrar };
}
