// "¡Timbrado!": el momento de pegar tu foto. La polaroid se pega, el timbre cae sobre su esquina con un golpe (y un
// sonido seco) y se ve cuánto falta para el próximo visado de la comuna. Se usa al subir la foto desde la ficha y al
// sacarla en el paseo.

import * as almacen from './almacen.js';
import { escapar } from './mapa.js';
import { cargarDex, cargarEntorno } from './datos.js';
import { avanceDex, insigniasDe, siguienteVisado, esConmemorativo } from './dex.js';
import { leerFoto } from './fotos.js';
import { timbreSVG } from './timbres.js';

const fechaLarga = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
const hora = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

let audio = null;

// Un golpe de timbre: ruido muy corto y un tono grave que cae. Si el navegador no deja sonar (el iPhone en
// silencio, o sin un toque previo), no pasa nada.
function golpe() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    const largo = Math.floor(audio.sampleRate * 0.1);
    const buffer = audio.createBuffer(1, largo, audio.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < largo; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / largo) ** 4;
    const ruido = audio.createBufferSource();
    ruido.buffer = buffer;
    const filtro = audio.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 1400;
    const volumenRuido = audio.createGain();
    volumenRuido.gain.value = 0.5;
    ruido.connect(filtro).connect(volumenRuido).connect(audio.destination);
    const tono = audio.createOscillator();
    tono.frequency.setValueAtTime(150, t);
    tono.frequency.exponentialRampToValueAtTime(48, t + 0.15);
    const volumenTono = audio.createGain();
    volumenTono.gain.setValueAtTime(0.45, t);
    volumenTono.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    tono.connect(volumenTono).connect(audio.destination);
    ruido.start(t);
    tono.start(t);
    tono.stop(t + 0.2);
  } catch {
    // Sin sonido.
  }
}

// El entorno (para saber si el timbre es conmemorativo) solo si ya está cargado o llega rápido: el momento no espera.
const entornoRapido = () => Promise.race([cargarEntorno().catch(() => null), new Promise((r) => setTimeout(() => r(null), 300))]);

/**
 * Muestra el momento del timbre de `lugar` (ya con su foto guardada).
 * eraNuevo: el lugar no estaba timbrado antes (si era "otra foto", no se celebra un visado).
 * alEscribirNota: si viene, aparece "Escribir una nota" y se llama al cerrar con ese botón.
 */
export async function mostrarTimbrado(lugar, { eraNuevo = true, alEscribirNota = null } = {}) {
  const estado = almacen.dex();
  const c = estado.capturados[lugar.id] || {};
  const [blob, entorno] = await Promise.all([leerFoto(lugar.id).catch(() => null), entornoRapido()]);
  const url = blob ? URL.createObjectURL(blob) : null;
  const cuando = new Date(c.foto || Date.now());
  const nota = (estado.notas[lugar.id] || '').split('\n')[0].trim();
  const caja = document.createElement('div');
  caja.className = 'timbrado';
  caja.setAttribute('role', 'dialog');
  caja.setAttribute('aria-modal', 'true');
  caja.setAttribute('aria-label', `Timbrado: ${lugar.nombre}`);
  caja.innerHTML = `<span class="rotulo">¡Timbrado!</span>
    <h2>${escapar(lugar.nombre)}</h2>
    <p class="fecha-hora">${[lugar.comuna, fechaLarga.format(cuando), hora.format(cuando)].filter(Boolean).map(escapar).join(' · ').toLocaleUpperCase('es')}</p>
    <div class="timbrado-recuerdo" data-tipo="${escapar(lugar.tipo)}">
      <div class="pol"><div class="pol-foto">${url ? `<img src="${url}" alt="Tu foto de ${escapar(lugar.nombre)}">` : ''}</div>
        <div class="pol-pie">${escapar(nota || fechaLarga.format(cuando))}</div></div>
      ${timbreSVG(lugar.tipo, { numero: lugar.numero, nombre: lugar.nombre, fecha: cuando.toISOString(), tamano: 'grande', conmemorativo: esConmemorativo(lugar, entorno) })}
    </div>
    <div class="timbrado-avance" hidden></div>
    <div class="timbrado-botones">
      ${alEscribirNota ? '<button type="button" class="boton-secundario" data-accion="nota">Escribir nota</button>' : ''}
      <button type="button" class="boton-principal" data-accion="seguir">Seguir</button>
    </div>`;
  document.body.append(caja);
  const cerrar = () => {
    caja.remove();
    if (url) URL.revokeObjectURL(url);
  };
  caja.querySelector('[data-accion="seguir"]').addEventListener('click', cerrar);
  caja.querySelector('[data-accion="nota"]')?.addEventListener('click', () => {
    cerrar();
    alEscribirNota();
  });
  caja.querySelector('[data-accion="seguir"]').focus({ preventScroll: true });
  setTimeout(() => {
    golpe();
    // Vibra en Android (el iPhone no deja vibrar desde una web); solo si ya hubo un toque, o el navegador lo bloquea.
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(40);
  }, 560);

  // Cuánto va la comuna y si este timbre ganó un visado.
  if (!lugar.comuna) return;
  try {
    const dex = await cargarDex();
    const a = avanceDex(dex, almacen.dex()).porComuna[lugar.comuna];
    if (!a || !caja.isConnected) return;
    const ganados = insigniasDe(a.capturados / a.total);
    const antes = insigniasDe((a.capturados - (eraNuevo ? 1 : 0)) / a.total);
    const nuevo = ganados.find((p) => !antes.includes(p));
    const siguiente = siguienteVisado(a.capturados, a.total);
    const avance = caja.querySelector('.timbrado-avance');
    avance.classList.toggle('visado', Boolean(nuevo));
    avance.innerHTML = `<div class="fila-avance"><span>${escapar(lugar.comuna)}</span><span>${a.capturados} / ${a.total}</span></div>
      <div class="barra-visados">${'<span></span>'}${[25, 50].map((p) => `<i class="${ganados.includes(p) ? 'ganado' : ''}" style="left:${p}%"></i>`).join('')}</div>
      <p>${
        nuevo
          ? `¡Ganaste el visado del ${nuevo} % de ${escapar(lugar.comuna)}!`
          : siguiente
            ? `Te ${siguiente.faltan === 1 ? 'falta 1 timbre' : `faltan ${siguiente.faltan} timbres`} para el visado del ${siguiente.porcentaje} %.`
            : '¡Tienes la página completa!'
      }</p>`;
    avance.querySelector('.barra-visados > span').style.width = `${Math.max(1, (a.capturados / a.total) * 100).toFixed(1)}%`;
    avance.hidden = false;
  } catch (err) {
    console.error(err);
  }
}
