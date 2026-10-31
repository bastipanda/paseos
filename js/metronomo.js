// Ayudas para el ritmo durante el paseo:
// - Metrónomo: un "tic" suave a los pasos por minuto elegidos. Unos 100 pasos por minuto es, según varios estudios,
//   donde empieza la intensidad moderada; 110-120 es un paso enérgico.
// - Intervalos: 3 minutos suave y 3 minutos rápido, alternados (caminata por intervalos, un método japonés estudiado
//   en personas que caminan). Parte suave, como calentamiento.

export const INTERVALO_S = 180;

// En qué parte de los intervalos vas después de `segundos`: fase, segundos que le quedan y número de la fase.
export function faseIntervalo(segundos, duracion = INTERVALO_S) {
  const numero = Math.floor(segundos / duracion);
  return { fase: numero % 2 === 0 ? 'suave' : 'rapido', restante: duracion - (segundos % duracion), numero };
}

// Pasos por minuto del metrónomo según la fase: más rápido en la fase rápida, más lento en la suave.
export function ppmDeFase(ppm, fase) {
  if (fase === 'rapido') return ppm + 10;
  if (fase === 'suave') return Math.max(80, ppm - 15);
  return ppm;
}

// Usa Web Audio (sonido generado por el navegador, sin archivos). Programa cada tic un poco antes para que el
// ritmo sea parejo aunque el celular esté ocupado.
export class Metronomo {
  constructor() {
    this.ctx = null;
    this.ppm = 110;
    this.reloj = null;
    this.siguiente = 0;
  }

  get disponible() {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
  }

  get activo() {
    return this.reloj !== null;
  }

  // Debe llamarse dentro de un toque en la pantalla: los navegadores no dejan sonar audio sin uno.
  iniciar(ppm) {
    if (!this.ctx) {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Contexto();
    }
    // En el iPhone (Safari 17 o más nuevo), así el sonido no se corta con el interruptor de silencio.
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      // Si no se puede, el metrónomo igual suena con el celular sin silencio.
    }
    this.ctx.resume();
    this.ppm = ppm;
    this.siguiente = this.ctx.currentTime + 0.1;
    clearInterval(this.reloj);
    this.reloj = setInterval(() => this.programar(), 25);
  }

  cambiar(ppm) {
    this.ppm = ppm;
  }

  detener() {
    clearInterval(this.reloj);
    this.reloj = null;
  }

  programar() {
    while (this.siguiente < this.ctx.currentTime + 0.12) {
      this.tic(this.siguiente);
      this.siguiente += 60 / this.ppm;
    }
  }

  tic(cuando) {
    const oscilador = this.ctx.createOscillator();
    const volumen = this.ctx.createGain();
    oscilador.frequency.value = 880;
    volumen.gain.setValueAtTime(0.0001, cuando);
    volumen.gain.exponentialRampToValueAtTime(0.3, cuando + 0.005);
    volumen.gain.exponentialRampToValueAtTime(0.0001, cuando + 0.06);
    oscilador.connect(volumen).connect(this.ctx.destination);
    oscilador.start(cuando);
    oscilador.stop(cuando + 0.07);
  }
}
