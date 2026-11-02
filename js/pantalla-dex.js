// Pantalla "Pasaporte" (antes Santiagodex): las páginas con tus timbres, la ficha de cada lugar a pantalla completa,
// los visados de cada comuna y "Tu mapa de Santiago".
// Cada lugar: timbrado = tu foto como polaroid con el timbre (la forma de su tipo) encima de la esquina; falta tu foto
// = la polaroid vacía y el timbre punteado esperando; visto y por encontrar = la silueta punteada del timbre con su
// número (lo no visto, sin nombre, salvo que lo pidas en Ajustes o lo busques). En el código sigue llamándose "dex":
// así no cambian los datos guardados ni el respaldo.

import * as almacen from './almacen.js';
import { escapar } from './mapa.js';
import { $, mostrarEstado, formatearFecha } from './ui.js';
import { cargarDex, cargarComunas, cargarContexto, cargarEntorno, cargarEspecies, cargarMenciones, cargarMetro } from './datos.js';
import {
  textoQueHay,
  textoArboles,
  textoEspecies,
  enlaceINaturalist,
  textoHorario,
  textoObra,
  textosMonumentos,
  textoPersona,
  textoCalles,
  textoAltura,
  textoReferencias,
  PLAZA_DE_ARMAS,
} from './entorno.js';
import { TIPOS_DEX, numeroDex, estadoDe, avanceDex, insigniasDe, INSIGNIAS, siguienteVisado, esConmemorativo } from './dex.js';
import { avancePorComuna } from './territorio.js';
import { celdasDeRuta, limitesCelda } from './explorar.js';
import { tipoLugar, nombreLugar } from './plazas.js';
import { distancia } from './geo.js';
import { formatearDistancia } from './duracion.js';
import { ubicacionActual } from './seguimiento.js';
import { leerFoto, borrarFoto } from './fotos.js';
import { resumenWikipedia, creditoFoto, enlaceWikipedia } from './wikipedia.js';
import { pedirFoto } from './captura.js';
import { timbreSVG, iconoTipo } from './timbres.js';
import { icono } from './iconos.js';
import { mostrarTimbrado } from './timbrado.js';

const POR_PAGINA = 30;
const REGIONES_A_LA_VISTA = 8;
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Para buscar sin importar tildes ni mayúsculas.
const normalizar = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const fechaPie = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
const fechaMini = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' });

// Patrimonio según las etiquetas de OSM (`heritage` y su operador). Se dice de dónde viene: el mapa puede estar
// desactualizado.
function textoPatrimonio([nivel, operador]) {
  if (nivel === '1') return 'Patrimonio de la Humanidad (según OpenStreetMap).';
  if (/cmn|monumentos/i.test(operador || '')) return 'Monumento Nacional, protegido por el Consejo de Monumentos Nacionales (según OpenStreetMap).';
  return 'Marcado como patrimonio protegido en OpenStreetMap.';
}

// Polaroid: con tu foto (se pone después), vacía esperando la foto ("falta tu foto") o punteada (todavía no llegas).
const polaroid = (pie) => `<span class="pol"><span class="pol-foto"></span><span class="pol-pie">${escapar(pie)}</span></span>`;
const polaroidVacia = (texto, pie, esperando = false) =>
  `<span class="pol vacia${esperando ? ' esperando' : ''}"><span class="pol-foto">${icono('camara')}${escapar(texto)}</span><span class="pol-pie">${escapar(pie)}</span></span>`;

// Al pie de la polaroid: tu nota (la primera línea) o la fecha de la foto.
function pieDe(l, estado) {
  const nota = (estado.notas[l.id] || '').split('\n')[0].trim();
  if (nota) return nota;
  const c = estado.capturados[l.id];
  return c?.foto ? fechaPie.format(new Date(c.foto)) : '';
}

export function iniciarDex({ mapa, margenes, verEnMapa, cerrarMapa, irACapturar }) {
  let dex = [];
  let entorno = null;
  let comunas = [];
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
      mostrarEstado($('#dex-resumen'), 'No se pudo cargar el Pasaporte. Revisa la conexión.', true);
      return;
    }
    // Para los timbres conmemorativos. Si tarda, las páginas se muestran igual y lo usan cuando llegue.
    if (!entorno) {
      entorno = await Promise.race([cargarEntorno().catch(() => null), new Promise((r) => setTimeout(() => r(null), 1500))]);
      if (!entorno) cargarEntorno().then((e) => (entorno = e)).catch(() => {});
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
      tipo.innerHTML = '<option value="">Todos los tipos</option>' + TIPOS_DEX.map((t) => `<option value="${t}">${mayuscula(tipoLugar({ tipo: t }))}</option>`).join('');
    }
    const comuna = $('#dex-comuna');
    if (!comuna.options.length) {
      comunas = [...new Set(dex.map((l) => l.comuna).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
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

  // La cabecera: el pasaporte entero o la página de una comuna, con sus visados y cuánto falta para el siguiente.
  function pintarCabecera(estado) {
    const comuna = $('#dex-comuna').value;
    const base = comuna ? dex.filter((l) => l.comuna === comuna) : dex;
    const a = avanceDex(base, estado);
    $('#dex-titulo').textContent = comuna || 'Santiago';
    $('#dex-rotulo').textContent = comuna ? `Pasaporte · pág. ${comunas.indexOf(comuna) + 1} de ${comunas.length}` : 'Pasaporte';
    $('#dex-marcapaginas').hidden = !comuna;
    $('#dex-resumen').textContent =
      `${a.capturados.toLocaleString('es-CL')} de ${a.total.toLocaleString('es-CL')} timbrados` +
      (a.faltaFoto ? ` · ${a.faltaFoto} sin foto` : '') +
      (a.vistos ? ` · ${a.vistos} vistos` : '');
    const fraccion = a.total ? a.capturados / a.total : 0;
    const barra = $('#dex-visados');
    barra.querySelectorAll('i').forEach((i) => i.remove());
    $('#dex-barra').style.width = `${a.capturados ? Math.max(0.6, fraccion * 100) : 0}%`;
    if (comuna) {
      const ganados = insigniasDe(fraccion);
      for (const p of INSIGNIAS.slice(0, -1)) barra.insertAdjacentHTML('beforeend', `<i class="${ganados.includes(p) ? 'ganado' : ''}" style="left:${p}%"></i>`);
      const s = siguienteVisado(a.capturados, a.total);
      const listos = ganados.length ? `Visado del ${ganados[ganados.length - 1]} % listo. ` : '';
      $('#dex-siguiente').textContent = s
        ? `${listos}Te ${s.faltan === 1 ? 'falta 1 timbre' : `faltan ${s.faltan} timbres`} para el del ${s.porcentaje} %.`
        : '¡Página completa: tienes los tres visados!';
    } else {
      $('#dex-siguiente').textContent = 'Elige una comuna para abrir su página y ver sus visados.';
    }
  }

  function pintar() {
    const estado = almacen.dex();
    pintarCabecera(estado);
    for (const u of urls) URL.revokeObjectURL(u);
    urls = [];
    const { lista } = filtrados();
    const caja = $('#dex-cartas');
    caja.innerHTML = '';
    for (const l of lista.slice(0, pagina * POR_PAGINA)) caja.append(carta(l, estadoDe(l, estado), estado));
    if (!lista.length) caja.innerHTML = '<p class="ayuda">No hay lugares con ese filtro.</p>';
    $('#dex-mas').hidden = lista.length <= pagina * POR_PAGINA;
  }

  // Una casilla de la página.
  function carta(l, e, estado) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `celda ${e}`;
    b.dataset.tipo = l.tipo;
    const visible = nombreVisible(e);
    const conmemorativo = visible && esConmemorativo(l, entorno);
    const c = estado.capturados[l.id];
    let marco;
    let estadoCorto;
    if (e === 'capturado') {
      marco = polaroid(pieDe(l, estado)) + timbreSVG(l.tipo, { numero: l.numero, conmemorativo, clase: 'esquina' });
      estadoCorto = fechaMini.format(new Date(c.foto)).replace('.', '');
    } else if (e === 'falta') {
      marco = polaroidVacia('Falta tu foto', c.como === 'mano' ? 'Ya lo conocías' : `Llegaste el ${fechaMini.format(new Date(c.fecha)).replace('.', '')}`) +
        timbreSVG(l.tipo, { modo: 'pendiente', clase: 'esquina' });
      estadoCorto = 'sin foto';
    } else {
      marco = timbreSVG(l.tipo, { numero: l.numero, modo: 'punteado', conmemorativo });
      estadoCorto = e === 'visto' ? 'visto' : tipoLugar(l);
    }
    const lejos = origen ? formatearDistancia(distancia(origen, l.punto)) : '';
    b.innerHTML = `<span class="celda-marco">${marco}</span>
      <span class="celda-nombre">${visible ? escapar(l.nombre) : '?'}</span>
      <span class="celda-pie">${[numeroDex(l.numero), estadoCorto, lejos].filter(Boolean).map(escapar).join(' · ')}</span>`;
    b.setAttribute('aria-label', `${numeroDex(l.numero)} ${visible ? l.nombre : 'por encontrar'}: ${e === 'capturado' ? 'timbrado' : estadoCorto}`);
    b.addEventListener('click', () => abrirFicha(l));
    if (e === 'capturado') ponerFotoPropia(b.querySelector('.pol-foto'), l);
    return b;
  }

  // Pone tu foto en `caja`. Devuelve si había foto.
  async function ponerFotoPropia(caja, l) {
    const blob = await leerFoto(l.id).catch(() => null);
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    caja.prepend(imagen(url, `Tu foto de ${l.nombre}`));
    return true;
  }

  // Mientras falta la tuya: la foto de Wikipedia o una de Commons que nombra el lugar (scripts/contexto.mjs).
  async function fotoDeReferencia(l) {
    if (l.wikipedia) {
      const w = await resumenWikipedia(l.wikipedia);
      if (w?.foto) return { src: w.foto, de: 'Wikipedia' };
    }
    const commons = (await cargarContexto().catch(() => ({})))[l.id]?.f;
    return commons ? { src: commons, de: 'Wikimedia Commons' } : null;
  }

  function imagen(src, alt = '') {
    const img = document.createElement('img');
    img.alt = alt;
    img.loading = 'lazy';
    img.src = src;
    img.onerror = () => img.remove();
    return img;
  }

  // ---------- Ficha a pantalla completa: una página del pasaporte ----------

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

  const ESTADO_NOMBRE = { capturado: 'Timbrado', falta: 'Falta tu foto', visto: 'Visto', nuevo: 'Por encontrar' };

  // La columna junto a la polaroid: estado, fecha y distancia.
  function ladoEstado(l, e, estado) {
    const c = estado.capturados[l.id];
    const fecha = (iso) => formatearFecha(new Date(iso));
    const campo = (rotulo, valor, clase = '') => `<span class="rotulo">${rotulo}</span><p class="valor ${clase}">${escapar(valor)}</p>`;
    const filas = [campo('Estado', ESTADO_NOMBRE[e], e)];
    if (e === 'capturado') filas.push(campo('Tu foto', fecha(c.foto)));
    else if (e === 'falta') filas.push(campo(c.como === 'mano' ? 'Conocido' : 'Llegaste', fecha(c.fecha)));
    else if (e === 'visto') filas.push(campo('Lo viste', fecha(estado.vistos[l.id])));
    if (origen) filas.push(campo('Distancia', formatearDistancia(distancia(origen, l.punto))));
    return filas.join('');
  }

  function pintarFicha(l) {
    const estado = almacen.dex();
    const e = estadoDe(l, estado);
    const visible = nombreVisible(e);
    const c = estado.capturados[l.id];
    const conmemorativo = visible && esConmemorativo(l, entorno);
    const caja = $('#dex-ficha');
    const nombreTimbre = visible ? l.nombre : '';
    let marco;
    if (e === 'capturado') {
      marco = polaroid(pieDe(l, estado)) + timbreSVG(l.tipo, { numero: l.numero, nombre: nombreTimbre, fecha: c.foto, tamano: 'grande', conmemorativo });
    } else if (e === 'falta') {
      marco = polaroidVacia('Tu foto va aquí', c.como === 'mano' ? 'Ya lo conocías' : `Llegaste el ${fechaMini.format(new Date(c.fecha)).replace('.', '')}`) +
        timbreSVG(l.tipo, { numero: l.numero, nombre: nombreTimbre, modo: 'pendiente', tamano: 'grande' });
    } else {
      marco = polaroidVacia('Tu foto', '', true) + '<span class="espacio-timbre">TIMBRE</span>';
    }
    const fotos = `<div class="fila">
        <button type="button" class="${e === 'falta' ? 'boton-principal' : 'boton-secundario'}" data-accion="camara">${icono('camara')} ${e === 'capturado' ? 'Otra foto' : 'Sacar foto'}</button>
        <button type="button" class="boton-secundario" data-accion="galeria">${icono('galeria')} Galería</button>
      </div>`;
    const ir = e !== 'capturado' ? `<button type="button" class="${e === 'falta' ? 'boton-secundario' : 'boton-principal'}" data-accion="ir">Ir a timbrarlo</button>` : '';
    caja.innerHTML = `<button type="button" class="volver" data-accion="volver">‹ ${escapar($('#dex-comuna').value || 'Pasaporte')}</button>
      <div class="ficha-tipo" data-tipo="${escapar(l.tipo)}">${iconoTipo(l.tipo)}<span class="rotulo">${escapar(tipoLugar(l))} · Nº ${String(l.numero).padStart(4, '0')}</span></div>
      <h1>${visible ? escapar(l.nombre) : '?'}</h1>
      <p class="ficha-lema" hidden></p>
      <div class="ficha-recuerdo" data-tipo="${escapar(l.tipo)}">
        <div class="ficha-marco">${marco}</div>
        <div class="ficha-estado-lado">${ladoEstado(l, e, estado)}</div>
      </div>
      <div class="campos">
        <div><span class="rotulo">Tipo</span><p class="valor">${escapar(mayuscula(tipoLugar(l)))}</p></div>
        ${l.comuna ? `<div><span class="rotulo">Comuna</span><p class="valor">${escapar(l.comuna)}</p></div>` : ''}
      </div>
      <div class="acciones">
        ${e === 'falta' ? fotos + ir : ir + fotos}
        <button type="button" class="boton-secundario" data-accion="mapa">Ver en el mapa</button>
        <p class="estado" id="estado-ficha" role="status"></p>
      </div>
      <div class="ficha-grupos">
        <details class="ficha-grupo" data-grupo="historia" hidden><summary>Su historia<span class="pista"></span></summary>
          <div class="ficha-foto-wiki" hidden></div><p class="ficha-credito" hidden></p>
          <div class="ficha-historia" hidden><p></p></div><ul></ul></details>
        <details class="ficha-grupo" data-grupo="hay" hidden><summary>Qué hay<span class="pista"></span></summary><ul></ul></details>
        <details class="ficha-grupo" data-grupo="donde" hidden><summary>Dónde estás<span class="pista"></span></summary><ul></ul></details>
        <details class="ficha-grupo ficha-nota" data-grupo="tu"${visible ? '' : ' hidden'}${estado.notas[l.id] ? ' open' : ''}>
          <summary>Tú y este lugar<span class="pista"></span></summary><ul></ul>
          <textarea rows="3" maxlength="2000" aria-label="Tu nota sobre este lugar"
            placeholder="Tu nota: lo que aprendiste o recuerdas de este lugar…">${escapar(estado.notas[l.id] || '')}</textarea>
          <p class="ayuda">La nota se guarda sola en este celular, va en el respaldo y su primera línea queda al pie de tu
            polaroid.</p>
        </details>
      </div>
      <details class="ayuda-plegable"><summary>¿Cómo se timbra?</summary>
        <p class="ayuda">Llegas al lugar y le sacas tu foto: sin foto no hay timbre. También puedes subirla desde la
          galería si ya lo conocías. La app no revisa que la foto sea del lugar.</p></details>
      ${e === 'capturado' || e === 'falta' ? '<div class="acciones"><button type="button" class="boton-texto peligro" data-accion="quitar">Quitar el timbre</button></div>' : ''}`;
    const aviso = caja.querySelector('#estado-ficha');
    caja.querySelector('[data-accion="volver"]').addEventListener('click', () => cerrarFicha());
    caja.querySelector('[data-accion="ir"]')?.addEventListener('click', () => irACapturar(l, aviso));
    caja.querySelector('[data-accion="mapa"]').addEventListener('click', () => {
      const nombre = visible ? l.nombre : `${numeroDex(l.numero)} ?`;
      verEnMapa(nombre);
      mapa.mostrarDex([{ lugar: l, estado: e, nombre }], abrirDesdeMapa);
      mapa.centrarEn(l.punto, 17);
    });
    for (const [accion, camara] of [['camara', true], ['galeria', false]]) {
      caja.querySelector(`[data-accion="${accion}"]`).addEventListener('click', () => {
        const eraNuevo = e !== 'capturado';
        pedirFoto(l, camara, (err) => {
          if (err) return mostrarEstado(aviso, 'No se pudo guardar la foto. Prueba de nuevo o con otra foto.', true);
          pintar();
          pintarRegiones();
          pintarFicha(l);
          mostrarTimbrado(l, {
            eraNuevo,
            alEscribirNota: () => {
              const grupo = $('#dex-ficha [data-grupo="tu"]');
              grupo.open = true;
              grupo.querySelector('textarea').focus();
            },
          });
        });
      });
    }
    caja.querySelector('[data-accion="quitar"]')?.addEventListener('click', async () => {
      if (!confirm(`¿Quitar el timbre de ${l.nombre}? Se borra tu foto y vuelve a quedar por encontrar.`)) return;
      const d = almacen.dex();
      delete d.capturados[l.id];
      almacen.guardarDex(d);
      await borrarFoto(l.id).catch(() => {});
      pintar();
      pintarRegiones();
      pintarFicha(l);
    });
    // La nota se guarda mientras escribes (medio segundo después de la última tecla) y su primera línea va al pie de
    // la polaroid.
    const nota = caja.querySelector('.ficha-nota textarea');
    let espera = null;
    nota.addEventListener('input', () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        const d = almacen.dex();
        if (nota.value.trim()) d.notas[l.id] = nota.value;
        else delete d.notas[l.id];
        almacen.guardarDex(d);
        const pie = caja.querySelector('.ficha-marco .pol:not(.vacia) .pol-pie');
        if (pie) pie.textContent = pieDe(l, d);
      }, 500);
    });
    const id = ++fichaActual;
    if (e === 'capturado') ponerFotoPropia(caja.querySelector('.ficha-marco .pol-foto'), l);
    pintarHistoriaWikipedia(caja, l, e, visible, id);
    pintarGrupos(caja, l, visible, id, estado);
  }

  const enlace = (url, texto) => (url ? ` <a href="${escapar(url)}" target="_blank" rel="noopener">${texto}</a>` : '');

  function llenarGrupo(caja, grupo, items, pista = '') {
    if (!items.length) return;
    const seccion = caja.querySelector(`[data-grupo="${grupo}"]`);
    seccion.querySelector('ul').innerHTML = items.map((t) => `<li>${t}</li>`).join('');
    if (pista) seccion.querySelector('.pista').textContent = pista;
    seccion.hidden = false;
  }

  // Un campo rotulado más (año, obra, altura, metro…), solo si el dato existe.
  function agregarCampo(caja, rotulo, valor) {
    if (!valor) return;
    caja.querySelector('.campos').insertAdjacentHTML('beforeend', `<div><span class="rotulo">${escapar(rotulo)}</span><p class="valor">${escapar(valor)}</p></div>`);
  }

  // Los grupos de la ficha ("Una razón para ir"): solo datos verificables (OpenStreetMap, Wikidata, Wikipedia,
  // iNaturalist, el Consejo de Monumentos, Open-Meteo y el mismo Pasaporte), nunca inventados; si un dato no está, la
  // línea no aparece. Sin el nombre a la vista no se muestran: delatarían el lugar. Los lugares cercanos se cuentan sin
  // nombrarlos, por lo mismo. Lo más importante también va arriba, en los campos rotulados y la frase destacada.
  async function pintarGrupos(caja, l, visible, id, estado) {
    if (!visible) return;
    const vacio = () => ({});
    const [contexto, entornoTodo, especies, menciones, metro] = await Promise.all([
      cargarContexto().catch(vacio),
      cargarEntorno().catch(vacio),
      cargarEspecies().catch(vacio),
      cargarMenciones().catch(vacio),
      cargarMetro().catch(() => null),
    ]);
    if (id !== fichaActual) return;
    if (!entorno && Object.keys(entornoTodo).length) entorno = entornoTodo;
    const c = contexto[l.id] || {};
    const en = entornoTodo[l.id] || {};

    // La frase destacada bajo el nombre: lo que dice su placa o la frase de Wikipedia que lo nombra, si son cortas.
    const lema = caja.querySelector('.ficha-lema');
    if (c.i && c.i.length <= 120) lema.innerHTML = `«${escapar(c.i)}» <span class="rotulo">placa</span>`;
    else if (menciones[l.id] && menciones[l.id][1].length <= 150) lema.innerHTML = `«${escapar(menciones[l.id][1])}» <span class="rotulo">Wikipedia</span>`;
    lema.hidden = !lema.innerHTML;

    // Qué hay: lo que se puede hacer o ver ahí.
    const hay = [textoQueHay(en.h), textoArboles(en.r)].filter(Boolean).map(escapar);
    const esp = textoEspecies(especies[l.id]);
    if (esp) {
      hay.push(
        escapar(esp.titulo) +
          esp.grupos.map((g) => `<span class="ficha-sub">${escapar(g)}.</span>`).join('') +
          enlace(enlaceINaturalist(l), esp.hayMas ? 'Ver todas en iNaturalist' : 'Ver en iNaturalist'),
      );
    }
    if (c.o) hay.push(escapar(textoHorario(c.o)));
    const totalEspecies = especies[l.id]?.[0];
    llenarGrupo(caja, 'hay', hay, totalEspecies ? `${totalEspecies} especies` : '');

    // Su historia: monumento, obra, placa, nombres y lo que dice Wikipedia (el resumen llega aparte).
    const monumentos = textosMonumentos(en.m, l.nombre);
    const historia = monumentos.map((m) => escapar(m.texto) + enlace(m.enlace, 'Ver el decreto'));
    if (c.h) historia.push(escapar(textoPatrimonio(c.h)));
    if (c.t && !['historia', 'arte'].includes(l.tipo)) historia.push(escapar(`${c.t}.`));
    const obra = textoObra(c);
    if (obra) historia.push(escapar(obra));
    if (c.q) historia.push(`Arquitectura de ${escapar(c.q)}.`);
    if (c.i) historia.push(`En su placa dice: «${escapar(c.i)}»`);
    if (c.d) historia.push(escapar(c.d));
    if (c.v) historia.push(`Antes se llamaba ${escapar(c.v)}.`);
    if (c.x) historia.push(`También se le conoce como ${escapar(c.x)}.`);
    for (const [nombre, descripcion, articulo] of c.e || []) {
      historia.push(`Lleva el nombre de <strong>${escapar(nombre)}</strong>${descripcion ? `: ${escapar(descripcion)}` : ''}.` + enlace(enlaceWikipedia(articulo), 'Leer en Wikipedia'));
    }
    if (!c.e && c.p) historia.push(escapar(textoPersona(c.p)) + enlace(enlaceWikipedia(`es:${c.p[0]}`), 'Leer en Wikipedia'));
    if (menciones[l.id]) {
      const [articulo, frase] = menciones[l.id];
      historia.push(
        `«${escapar(frase)}»<span class="ficha-sub">Lo nombra el artículo de Wikipedia «${escapar(articulo)}».` +
          `${enlace(enlaceWikipedia(`es:${articulo}`), 'Leer')}</span>`,
      );
    }
    const pistaHistoria = en.m?.length ? 'Monumento nacional' : c.y ? `Del año ${c.y}` : '';
    llenarGrupo(caja, 'historia', historia, pistaHistoria);

    // Dónde estás: para ubicarse (calles, barrio, altura, puntos de referencia) y lo que hay cerca.
    const donde = [textoCalles(en.c)].filter(Boolean).map(escapar);
    const [barrio, articuloBarrio] = en.b || [];
    if (barrio) {
      donde.push(
        `Barrio cercano: ${escapar(barrio)}.` +
          (articuloBarrio && articuloBarrio !== l.wikipedia
            ? `<details class="ficha-plegable" data-articulo="${escapar(articuloBarrio)}"><summary>Sobre ${escapar(barrio)}</summary><p class="ficha-sub">Cargando…</p></details>`
            : ''),
      );
    }
    const esCumbre = l.tipo === 'cerro' && Number.isFinite(c.z);
    const z = esCumbre ? c.z : en.z;
    const altura = textoAltura(z, entornoTodo[PLAZA_DE_ARMAS]?.z, esCumbre);
    if (altura && l.id !== PLAZA_DE_ARMAS) donde.push(escapar(altura));
    const referencias = textoReferencias(l.punto);
    if (referencias) donde.push(escapar(referencias));
    if (l.tamano >= 60) donde.push(`Mide unos ${formatearDistancia(Math.round(l.tamano / 10) * 10)} de punta a punta.`);
    const estacion = metro?.estaciones
      .map((m) => ({ m, d: distancia(m.punto, l.punto) }))
      .sort((a, b) => a.d - b.d)[0];
    const hayMetro = estacion && estacion.d <= 1500;
    if (hayMetro) {
      donde.push(`Metro más cercano: ${escapar(nombreLugar(estacion.m))} (línea ${escapar(estacion.m.lineas.join(' y '))}), a ${formatearDistancia(estacion.d)}.`);
    }
    const cerca = dex.filter((o) => o !== l && distancia(o.punto, l.punto) <= 300);
    if (cerca.length) {
      const faltan = cerca.filter((o) => estadoDe(o, estado) !== 'capturado').length;
      donde.push(`A menos de 300 m hay ${cerca.length === 1 ? 'otro lugar' : `${cerca.length} lugares más`} del Pasaporte` + (faltan ? ` (${faltan} sin timbrar).` : '.'));
    }
    llenarGrupo(caja, 'donde', donde, hayMetro ? `Metro a ${formatearDistancia(estacion.d)}` : '');
    // La historia del barrio se pide a Wikipedia solo si la abres (para no gastar datos).
    caja.querySelector('.ficha-plegable')?.addEventListener('toggle', async function cargarBarrio(ev) {
      const detalle = ev.currentTarget;
      if (!detalle.open) return;
      detalle.removeEventListener('toggle', cargarBarrio);
      const w = await resumenWikipedia(detalle.dataset.articulo);
      const p = detalle.querySelector('p');
      // El mapa a veces enlaza el barrio a un artículo con otro nombre (Barrio Plaza Italia → Plaza Baquedano).
      const otro = w?.titulo && normalizar(w.titulo).replace(/_/g, ' ') !== normalizar(barrio) ? `Del artículo de Wikipedia «${w.titulo.replace(/_/g, ' ')}»: ` : '';
      p.textContent = w?.texto ? otro + w.texto : 'No se pudo cargar el resumen. Revisa la conexión.';
      if (w?.enlace) p.insertAdjacentHTML('beforeend', enlace(w.enlace, 'Leer en Wikipedia'));
    });

    // Campos rotulados: lo importante de un vistazo (lo mismo está explicado en los grupos de abajo).
    agregarCampo(caja, 'Año', c.y);
    agregarCampo(caja, 'Obra de', c.a);
    if (en.m?.length) agregarCampo(caja, 'Protección', mayuscula(String(en.m[0][0] || 'Monumento nacional')));
    agregarCampo(caja, 'Altura', Number.isFinite(z) ? `${Math.round(z).toLocaleString('es-CL')} m` : '');
    if (hayMetro) agregarCampo(caja, 'Metro', `${nombreLugar(estacion.m).replace(/^Estación\s+/i, '')} · ${formatearDistancia(estacion.d)}`);
    agregarCampo(caja, 'Especies', totalEspecies ? String(totalEspecies) : '');

    // Tú y este lugar: lo que viviste ahí, con las fechas que guarda la app.
    llenarGrupo(caja, 'tu', lineasTuyas(l, estado).map(escapar));
  }

  function lineasTuyas(l, estado) {
    const fecha = (iso) => formatearFecha(new Date(iso));
    const c = estado.capturados[l.id];
    const lineas = [];
    if (estado.vistos[l.id]) lineas.push(`Lo viste por primera vez el ${fecha(estado.vistos[l.id])}.`);
    if (c?.como === 'gps') lineas.push(`Llegaste caminando el ${fecha(c.fecha)}.`);
    else if (c?.como === 'mano') lineas.push(`Lo marcaste como conocido el ${fecha(c.fecha)}.`);
    if (c?.foto) lineas.push(`Tu foto (y el timbre) es del ${fecha(c.foto)}.`);
    if (!lineas.length) lineas.push('Todavía no pasas por aquí.');
    return lineas;
  }

  // En "Su historia": el resumen de Wikipedia y, mientras falta la tuya, la foto de Wikipedia o Commons con su crédito
  // (tu foto es la protagonista arriba, en la polaroid). `id` evita que una ficha anterior, que todavía estaba
  // cargando, escriba en la que está abierta ahora. Sin el nombre a la vista no se muestra nada: delataría el lugar.
  async function pintarHistoriaWikipedia(caja, l, e, visible, id) {
    if (!visible) return;
    const grupo = caja.querySelector('[data-grupo="historia"]');
    if (e !== 'capturado') {
      const foto = await fotoDeReferencia(l);
      if (id !== fichaActual) return;
      if (foto) {
        const marco = grupo.querySelector('.ficha-foto-wiki');
        marco.append(imagen(foto.src, `Foto de ${l.nombre} (${foto.de})`));
        marco.hidden = false;
        const credito = grupo.querySelector('.ficha-credito');
        credito.textContent = `Foto de ${foto.de}, mientras falta la tuya.`;
        credito.hidden = false;
        grupo.hidden = false;
        const c = await creditoFoto(foto.src);
        if (c && id === fichaActual) {
          credito.innerHTML = `Foto de ${foto.de}, mientras falta la tuya: ${escapar(c.autor)}${c.licencia ? `, ${escapar(c.licencia)}` : ''}. ` +
            `<a href="${escapar(c.enlace)}" target="_blank" rel="noopener">Ver la foto</a>`;
        }
      }
    }
    if (!l.wikipedia) return;
    const w = await resumenWikipedia(l.wikipedia);
    if (!w?.texto || id !== fichaActual) return;
    const historia = grupo.querySelector('.ficha-historia');
    historia.querySelector('p').textContent = w.texto;
    // Si el artículo es de otra cosa (la persona de una estatua, la plaza donde está un monumento), se dice cuál es.
    if (normalizar(w.titulo).replace(/_/g, ' ') !== normalizar(l.nombre)) {
      const sobre = document.createElement('p');
      sobre.className = 'ayuda';
      sobre.textContent = `Del artículo de Wikipedia «${w.titulo.replace(/_/g, ' ')}».`;
      historia.prepend(sobre);
    }
    if (w.enlace) {
      const a = document.createElement('a');
      a.href = w.enlace;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'Leer en Wikipedia';
      historia.append(a);
    }
    historia.hidden = false;
    const pista = grupo.querySelector('.pista');
    if (!pista.textContent) pista.textContent = 'Wikipedia';
    grupo.hidden = false;
  }

  // ---------- Visados por comuna (antes "Regiones" con medallas) ----------

  // Primero las comunas donde ya timbraste, después donde llegaste sin foto; el resto, por nombre.
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
          <span class="secundario">${r.capturados}/${r.total}${r.sinFoto ? ` · ${r.sinFoto} sin foto` : ''}</span>
          <span class="insignias">${INSIGNIAS.map((p) => `<span class="insignia${ganadas.includes(p) ? ' ganada' : ''}" title="Visado del ${p} %">${p}%</span>`).join('')}</span>
        </button>`;
      li.querySelector('button').addEventListener('click', () => {
        $('#dex-comuna').value = r.nombre;
        pagina = 1;
        pintar();
        panel.scrollTop = 0;
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
    let contornos;
    try {
      contornos = await cargarComunas();
    } catch {
      ul.innerHTML = '<li class="vacia">Falta el archivo de comunas para calcular el avance.</li>';
      return;
    }
    const avance = avancePorComuna(celdasConocidas(), contornos).filter((c) => c.conocidas > 0);
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
        return { lugar: l, estado: e, nombre: nombreVisible(e) ? l.nombre : `${numeroDex(l.numero)} ?` };
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
