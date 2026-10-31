// Guía giro a giro: convierte los cruces de la ruta en indicaciones ("Dobla a la derecha") y las dice en voz alta
// con la voz del navegador, que es gratis y no necesita internet.

import { rumbo, ubicarEnLinea } from './geo.js';
import { nombreLugar } from './plazas.js';

export function textoGiro(angulo) {
  const a = Math.abs(angulo);
  const lado = angulo > 0 ? 'derecha' : 'izquierda';
  if (a < 25) return null;
  if (a < 60) return `Dobla levemente a la ${lado}`;
  if (a < 135) return `Dobla a la ${lado}`;
  if (a < 165) return `Dobla fuerte a la ${lado}`;
  return 'Da la vuelta';
}

// Ángulo del giro en el punto `i` (positivo = derecha). Mira unos metros antes y después para que una curva suave
// o un punto muy cercano no engañen.
export function anguloEn(coords, acc, i, tramo = 15) {
  let a = i - 1;
  while (a > 0 && acc[i] - acc[a] < tramo) a--;
  let b = i + 1;
  while (b < coords.length - 1 && acc[b] - acc[i] < tramo) b++;
  const entra = rumbo(coords[Math.max(0, a)], coords[i]);
  const sale = rumbo(coords[i], coords[Math.min(coords.length - 1, b)]);
  return ((sale - entra + 540) % 360) - 180;
}

// Lista ordenada de indicaciones a lo largo de la ruta. `linea` viene de unirPartes (seguimiento.js).
export function crearInstrucciones(opcion, linea) {
  const { coords, acc } = linea;
  const lista = [];
  for (const g of linea.giros) {
    const angulo = anguloEn(coords, acc, g.indice);
    const texto = textoGiro(angulo);
    // El ángulo sirve para dibujar la flecha de la franja del paseo.
    if (texto) lista.push({ recorrido: acc[g.indice], texto, tipo: 'giro', angulo });
  }
  for (const t of linea.tramos) {
    if (t.modo !== 'bici') continue;
    lista.push({ recorrido: t.desde, texto: `Toma una bici en ${opcion.estacionSalida?.nombre || 'la estación'}`, tipo: 'estacion' });
    lista.push({ recorrido: t.hasta, texto: `Deja la bici en ${opcion.estacionLlegada?.nombre || 'la estación'}`, tipo: 'estacion' });
  }
  const destino = opcion.destino;
  if (destino?.idaYVuelta) {
    const u = ubicarEnLinea(coords, acc, destino.punto, 0, coords.length);
    if (u && u.distancia < 150) lista.push({ recorrido: u.recorrido, texto: `Llegas a ${nombreLugar(destino)}`, tipo: 'destino' });
  }
  const final = destino && !destino.idaYVuelta ? `Llegas a ${nombreLugar(destino)}` : 'Llegas al final del paseo';
  lista.push({ recorrido: linea.total, texto: final, tipo: 'fin' });
  lista.sort((a, b) => a.recorrido - b.recorrido);
  // Dos giros casi en el mismo punto confunden: se deja solo el primero.
  return lista.filter((x, i) => i === 0 || x.tipo !== 'giro' || x.recorrido - lista[i - 1].recorrido > 8);
}

export function siguienteInstruccion(lista, recorrido) {
  return lista.find((x) => x.recorrido > recorrido + 3) || null;
}

// Frase para decir en voz alta según la distancia que falta.
export function fraseHablada(instruccion, distancia) {
  if (distancia < 15) return instruccion.texto;
  const metros = Math.round(distancia / 10) * 10;
  return `En ${metros} metros, ${instruccion.texto.charAt(0).toLowerCase()}${instruccion.texto.slice(1)}`;
}

export class Voz {
  constructor() {
    this.disponible = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.voz = null;
    if (this.disponible) {
      const elegir = () => {
        const voces = speechSynthesis.getVoices();
        this.voz = voces.find((v) => v.lang === 'es-CL') || voces.find((v) => v.lang?.startsWith('es')) || null;
      };
      elegir();
      speechSynthesis.addEventListener?.('voiceschanged', elegir);
    }
  }

  // `interrumpir` corta lo que se esté diciendo (para los giros); los avisos de intervalos esperan su turno.
  decir(texto, { interrumpir = true } = {}) {
    if (!this.disponible) return;
    const frase = new SpeechSynthesisUtterance(texto);
    frase.lang = this.voz?.lang || 'es-CL';
    if (this.voz) frase.voice = this.voz;
    if (interrumpir) speechSynthesis.cancel();
    speechSynthesis.speak(frase);
  }

  callar() {
    if (this.disponible) speechSynthesis.cancel();
  }
}
