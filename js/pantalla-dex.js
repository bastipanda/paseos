// Pantalla "Santiagodex": un álbum de cartas (un color por tipo), la ficha de cada lugar a pantalla completa, las
// regiones (comunas) con sus insignias y "Tu mapa de Santiago".
// Cartas: capturado = tu foto; falta la foto = la de Wikipedia mientras tanto (si el artículo tiene); visto = silueta
// con el nombre; por encontrar = silueta con "?" y sin nombre (salvo que lo pidas en Ajustes o lo busques).

import * as almacen from './almacen.js';
import { escapar } from './mapa.js';
import { $, mostrarEstado, formatearFecha } from './ui.js';
import { cargarDex, cargarComunas } from './datos.js';
import { TIPOS_DEX, numeroDex, estadoDe, avanceDex, insigniasDe, INSIGNIAS } from './dex.js';
import { avancePorComuna } from './territorio.js';
import { celdasDeRuta, limitesCelda } from './explorar.js';
import { ICONO_TIPO, tipoLugar } from './plazas.js';
import { distancia } from './geo.js';
import { formatearDistancia } from './duracion.js';
import { ubicacionActual } from './seguimiento.js';
import { leerFoto, borrarFoto } from './fotos.js';
import { resumenWikipedia, creditoFoto } from './wikipedia.js';
import { pedirFoto } from './captura.js';

const POR_PAGINA = 30;
const REGIONES_A_LA_VISTA = 8;
const MEDALLA = { 25: '🥉', 50: '🥈', 100: '🥇' };
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Para buscar sin importar tildes ni mayúsculas.
const normalizar = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function iniciarDex({ mapa, margenes, verEnMapa, cerrarMapa, irACapturar }) {
  let dex = [];
  let pagina = 1;
  let origen = null;
  let todasLasRegiones = false;
  let urls = [];
  let scrollAlbum = 0;
  let fichaActual = 0;
  const panel = $('#panel');

  // Al tocar un lugar en el mapa se vuelve a la página con su ficha abierta.
  const abrirDesdeMapa = (l) => {
    cerrarMapa();
    abrirFicha(l);
  };

  async function mostrar() {
    mapa.limpiarRuta();
    cerrarFicha(false);
    try {
      dex = await cargarDex();
    } catch (err) {
      mostrarEstado($('#dex-resumen'), 'No se pudo cargar la Santiagodex. Revisa la conexión.', true);
      return;
    }
    llenarFiltros();
    pagina = 1;
    pintar();
    pintarRegiones();
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

  const buscando = () => normalizar($('#dex-buscar').value);

  function filtrados() {
    const estado = almacen.dex();
    const filtro = document.querySelector('input[name="dex-filtro"]:checked').value;
    const tipo = $('#dex-tipo').value;
    const comuna = $('#dex-comuna').value;
    const texto = buscando();
    const numero = /^#?\d+$/.test(texto) ? Number(texto.replace('#', '')) : null;
    let lista = dex.filter((l) => {
      const e = estadoDe(l, estado);
      if (filtro === 'faltan' && (e === 'capturado' || e === 'falta')) return false;
      if (filtro === 'falta' && e !== 'falta') return false;
      if (filtro === 'capturados' && e !== 'capturado') return false;
      if (texto && !(numero !== null ? l.numero === numero : normalizar(l.nombre).includes(texto))) return false;
      return (!tipo || l.tipo === tipo) && (!comuna || l.comuna === comuna);
    });
    if ($('#dex-cerca').checked && origen) lista = lista.map((l) => ({ l, d: distancia(origen, l.punto) })).sort((a, b) => a.d - b.d).map((x) => x.l);
    return { lista, estado };
  }

  // Los nombres de lo que no has visto se esconden, salvo que lo pidas en Ajustes o estés buscando por nombre.
  const nombreVisible = (e) => e !== 'nuevo' || almacen.ajustes().verNombresDex || Boolean(buscando());

  function pintar() {
    const estado = almacen.dex();
    const avance = avanceDex(dex, estado);
    $('#dex-resumen').textContent =
      `Capturados: ${avance.capturados} de ${avance.total.toLocaleString('es-CL')}` +
      (avance.faltaFoto ? ` · sin foto: ${avance.faltaFoto}` : '') +
      ` · vistos: ${avance.vistos}.`;
    $('#dex-barra').style.width = `${avance.total ? Math.max(0.5, (avance.capturados / avance.total) * 100) : 0}%`;
    for (const u of urls) URL.revokeObjectURL(u);
    urls = [];
    const { lista } = filtrados();
    const caja = $('#dex-cartas');
    caja.innerHTML = '';
    for (const l of lista.slice(0, pagina * POR_PAGINA)) caja.append(carta(l, estadoDe(l, estado)));
    if (!lista.length) caja.innerHTML = '<p class="ayuda">No hay lugares con ese filtro.</p>';
    $('#dex-mas').hidden = lista.length <= pagina * POR_PAGINA;
  }

  function carta(l, e) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `carta ${e}`;
    b.dataset.tipo = l.tipo;
    const lejos = origen ? ` · ${formatearDistancia(distancia(origen, l.punto))}` : '';
    const marca = e === 'falta' ? '<span class="carta-marca">📷 sin foto</span>' : e === 'visto' ? '<span class="carta-marca">👁 visto</span>' : '';
    b.innerHTML = `<span class="carta-foto">${iconoDe(l, e)}${marca}</span>
      <span class="carta-num">${numeroDex(l.numero)}</span>
      <span class="carta-nombre">${nombreVisible(e) ? escapar(l.nombre) : '???'}</span>
      <span class="carta-pie">${escapar(mayuscula(tipoLugar(l)))}${lejos}</span>`;
    b.addEventListener('click', () => abrirFicha(l));
    ponerFoto(b.querySelector('.carta-foto'), l, e, 'miniatura');
    return b;
  }

  // Ícono del tipo: a color si ya llegaste; si no, silueta (y "?" si no lo has visto).
  const iconoDe = (l, e) =>
    `<span class="icono-tipo${e === 'nuevo' || e === 'visto' ? ' silueta' : ''}">${ICONO_TIPO[l.tipo] || '⭐'}</span>${e === 'nuevo' ? '<span class="carta-incognita">?</span>' : ''}`;

  // Pone tu foto (capturado) o la de Wikipedia (falta la foto) en `caja`. Devuelve qué foto quedó.
  async function ponerFoto(caja, l, e, tamano) {
    if (e === 'capturado') {
      const blob = await leerFoto(l.id).catch(() => null);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      caja.prepend(imagen(url));
      return { propia: true };
    }
    if (e === 'falta' && l.wikipedia) {
      const w = await resumenWikipedia(l.wikipedia);
      const src = tamano === 'miniatura' ? w?.miniatura : w?.foto;
      if (!src) return null;
      caja.prepend(imagen(src));
      return { wikipedia: src };
    }
    return null;
  }

  function imagen(src) {
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = src;
    img.onerror = () => img.remove();
    return img;
  }

  // ---------- Ficha a pantalla completa ----------

  function abrirFicha(l) {
    if ($('#dex-ficha').hidden) scrollAlbum = panel.scrollTop;
    $('#dex-album').hidden = true;
    $('#dex-ficha').hidden = false;
    pintarFicha(l);
    panel.scrollTop = 0;
  }

  function cerrarFicha(volverAlPunto = true) {
    $('#dex-ficha').hidden = true;
    $('#dex-album').hidden = false;
    if (volverAlPunto) panel.scrollTop = scrollAlbum;
  }

  function textoEstado(l, e, estado) {
    const c = estado.capturados[l.id];
    const fecha = (iso) => formatearFecha(new Date(iso));
    if (e === 'capturado') return `Capturado el ${fecha(c.foto)}${c.como === 'gps' ? ` (llegaste caminando el ${fecha(c.fecha)})` : ''}.`;
    if (e === 'falta') {
      return c.como === 'mano'
        ? `Lo marcaste como conocido el ${fecha(c.fecha)}. Falta tu foto para capturarlo.`
        : `Llegaste el ${fecha(c.fecha)}, pero falta tu foto para capturarlo.`;
    }
    if (e === 'visto') return `Lo viste el ${fecha(estado.vistos[l.id])}: pasaste cerca, pero no llegaste.`;
    return 'Por encontrar.';
  }

  function pintarFicha(l) {
    const estado = almacen.dex();
    const e = estadoDe(l, estado);
    const visible = nombreVisible(e);
    const caja = $('#dex-ficha');
    const botonesFoto = `<div class="fila">
        <button type="button" class="${e === 'falta' ? 'boton-principal' : 'boton-secundario'}" data-accion="camara">📷 ${e === 'capturado' ? 'Otra foto' : 'Sacar foto'}</button>
        <button type="button" class="boton-secundario" data-accion="galeria">🖼️ De la galería</button>
      </div>`;
    const ir = e !== 'capturado' ? `<button type="button" class="${e === 'falta' ? 'boton-secundario' : 'boton-principal'}" data-accion="ir">Ir a capturarlo</button>` : '';
    caja.innerHTML = `<button type="button" class="volver" data-accion="volver">‹ Dex</button>
      <div class="ficha-foto carta-foto" data-tipo="${escapar(l.tipo)}">${iconoDe(l, e)}</div>
      <p class="ficha-credito" hidden></p>
      <p class="ficha-num" data-tipo="${escapar(l.tipo)}">${numeroDex(l.numero)} <span class="chip-tipo">${ICONO_TIPO[l.tipo] || ''} ${escapar(mayuscula(tipoLugar(l)))}</span></p>
      <h1>${visible ? escapar(l.nombre) : '???'}</h1>
      <p class="secundario">${[l.comuna, origen && `a ${formatearDistancia(distancia(origen, l.punto))} de ti`].filter(Boolean).map(escapar).join(' · ')}</p>
      <p class="ficha-estado ${e}">${escapar(textoEstado(l, e, estado))}</p>
      <div class="acciones">
        ${e === 'falta' ? botonesFoto + ir : ir + botonesFoto}
        <button type="button" class="boton-secundario" data-accion="mapa">Ver en el mapa</button>
        <p class="estado" id="estado-ficha" role="status"></p>
        ${e === 'capturado' || e === 'falta' ? '<button type="button" class="boton-texto peligro" data-accion="quitar">Quitar la captura</button>' : ''}
      </div>
      <div class="ficha-historia" hidden><h2>Historia</h2><p></p></div>`;
    const aviso = caja.querySelector('#estado-ficha');
    caja.querySelector('[data-accion="volver"]').addEventListener('click', () => cerrarFicha());
    caja.querySelector('[data-accion="ir"]')?.addEventListener('click', () => irACapturar(l, aviso));
    caja.querySelector('[data-accion="mapa"]').addEventListener('click', () => {
      const nombre = visible ? l.nombre : `${numeroDex(l.numero)} ???`;
      verEnMapa(nombre);
      mapa.mostrarDex([{ lugar: l, estado: e, nombre }], abrirDesdeMapa);
      mapa.centrarEn(l.punto, 17);
    });
    for (const [accion, camara] of [['camara', true], ['galeria', false]]) {
      caja.querySelector(`[data-accion="${accion}"]`).addEventListener('click', () => {
        pedirFoto(l, camara, (err) => {
          if (err) return mostrarEstado(aviso, 'No se pudo guardar la foto. Prueba de nuevo o con otra foto.', true);
          pintar();
          pintarRegiones();
          pintarFicha(l);
          mostrarEstado($('#estado-ficha'), `📸 ¡${l.nombre} capturado!`);
        });
      });
    }
    caja.querySelector('[data-accion="quitar"]')?.addEventListener('click', async () => {
      if (!confirm(`¿Quitar la captura de ${l.nombre}? Se borra tu foto y vuelve a quedar por encontrar.`)) return;
      const d = almacen.dex();
      delete d.capturados[l.id];
      almacen.guardarDex(d);
      await borrarFoto(l.id).catch(() => {});
      pintar();
      pintarRegiones();
      pintarFicha(l);
    });
    pintarFotoYHistoria(caja, l, e, visible, ++fichaActual);
  }

  // Foto grande (la tuya, o la de Wikipedia con su crédito mientras falta la tuya) y el resumen del artículo.
  // `id` evita que una ficha anterior, que todavía estaba cargando, escriba en la que está abierta ahora.
  async function pintarFotoYHistoria(caja, l, e, visible, id) {
    // Sin el nombre a la vista no se muestra la de Wikipedia: delataría el lugar.
    const tipoFoto = e === 'capturado' ? 'capturado' : visible ? 'falta' : null;
    const credito = caja.querySelector('.ficha-credito');
    const foto = tipoFoto && (await ponerFoto(caja.querySelector('.ficha-foto'), l, tipoFoto, 'grande'));
    if (id !== fichaActual) return;
    if (foto?.propia) {
      credito.textContent = 'Tu foto.';
      credito.hidden = false;
    } else if (foto?.wikipedia) {
      credito.textContent = 'Foto de Wikipedia, mientras falta la tuya.';
      credito.hidden = false;
      const c = await creditoFoto(foto.wikipedia);
      if (c && id === fichaActual) {
        credito.innerHTML = `Foto de Wikipedia, mientras falta la tuya: ${escapar(c.autor)}${c.licencia ? `, ${escapar(c.licencia)}` : ''}. ` +
          `<a href="${escapar(c.enlace)}" target="_blank" rel="noopener">Ver la foto</a>`;
      }
    }
    if (!visible || !l.wikipedia) return;
    const w = await resumenWikipedia(l.wikipedia);
    if (!w?.texto || id !== fichaActual) return;
    const historia = caja.querySelector('.ficha-historia');
    historia.querySelector('p').textContent = w.texto;
    if (w.enlace) {
      const a = document.createElement('a');
      a.href = w.enlace;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Leer en Wikipedia';
      historia.append(a);
    }
    historia.hidden = false;
  }

  // ---------- Regiones (comunas) con insignias ----------

  // Primero las comunas donde ya capturaste, después donde llegaste sin foto; el resto, por nombre.
  function pintarRegiones() {
    const estado = almacen.dex();
    const { porComuna } = avanceDex(dex, estado);
    const sinFoto = {};
    for (const l of dex) if (l.comuna && estadoDe(l, estado) === 'falta') sinFoto[l.comuna] = (sinFoto[l.comuna] || 0) + 1;
    const regiones = Object.entries(porComuna)
      .map(([nombre, a]) => ({ nombre, ...a, sinFoto: sinFoto[nombre] || 0, fraccion: a.total ? a.capturados / a.total : 0 }))
      .sort((a, b) => b.capturados - a.capturados || b.sinFoto - a.sinFoto || a.nombre.localeCompare(b.nombre, 'es'));
    const ul = $('#dex-regiones');
    ul.innerHTML = '';
    for (const r of todasLasRegiones ? regiones : regiones.slice(0, REGIONES_A_LA_VISTA)) {
      const ganadas = insigniasDe(r.fraccion);
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="region">
          <span class="nombre">${escapar(r.nombre)}</span>
          <span class="secundario">${r.capturados} de ${r.total}${r.sinFoto ? ` · ${r.sinFoto} sin foto` : ''}</span>
          <span class="insignias">${INSIGNIAS.map((p) => `<span class="insignia${ganadas.includes(p) ? ' ganada' : ''}" title="${p} %">${MEDALLA[p]}</span>`).join('')}</span>
        </button>`;
      li.querySelector('button').addEventListener('click', () => {
        $('#dex-comuna').value = r.nombre;
        pagina = 1;
        pintar();
        $('#dex-buscar').scrollIntoView({ block: 'start' });
      });
      ul.append(li);
    }
    $('#dex-todas-regiones').hidden = todasLasRegiones || regiones.length <= REGIONES_A_LA_VISTA;
  }

  $('#dex-todas-regiones').addEventListener('click', () => {
    todasLasRegiones = true;
    pintarRegiones();
  });

  // ---------- Tu mapa: lo caminado con la app más lo marcado como conocido, y el avance de cada comuna ----------

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

  // En el mapa, los 400 primeros del filtro (más que eso se vuelve lento en el celular).
  $('#dex-ver-mapa').addEventListener('click', () => {
    const { lista, estado } = filtrados();
    if (!lista.length) return mostrarEstado($('#estado-dex'), 'No hay lugares con ese filtro.', true);
    const n = lista.length;
    verEnMapa(n > 400 ? `Los primeros 400 de ${n.toLocaleString('es-CL')} lugares` : `${n} ${n === 1 ? 'lugar' : 'lugares'}`);
    mapa.mostrarDex(
      lista.slice(0, 400).map((l) => {
        const e = estadoDe(l, estado);
        return { lugar: l, estado: e, nombre: nombreVisible(e) ? l.nombre : `${numeroDex(l.numero)} ???` };
      }),
      abrirDesdeMapa,
      margenes(),
    );
  });

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

  const repintar = () => {
    pagina = 1;
    pintar();
  };
  document.querySelectorAll('input[name="dex-filtro"]').forEach((r) => r.addEventListener('change', repintar));
  $('#dex-tipo').addEventListener('change', repintar);
  $('#dex-comuna').addEventListener('change', repintar);
  $('#dex-buscar').addEventListener('input', repintar);
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
    repintar();
  });

  return { mostrar };
}
