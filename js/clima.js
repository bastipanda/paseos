// Clima y calidad del aire antes de salir, con Open-Meteo (gratis, sin clave, se puede consultar desde el navegador).
// Los umbrales de material particulado fino (MP2,5) siguen las categorías del Ministerio del Medio Ambiente de Chile,
// que se calculan con promedios de 24 horas; aquí se usa el valor del momento, así que es solo orientativo.

const URL_CLIMA = 'https://api.open-meteo.com/v1/forecast';
const URL_AIRE = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const CIELO = [
  [[0], 'despejado'],
  [[1, 2], 'algo nublado'],
  [[3], 'nublado'],
  [[45, 48], 'con niebla'],
  [[51, 53, 55, 56, 57], 'con llovizna'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'con lluvia'],
  [[71, 73, 75, 77, 85, 86], 'con nieve'],
  [[95, 96, 99], 'con tormenta'],
];

export function textoCielo(codigo) {
  return (CIELO.find(([codigos]) => codigos.includes(codigo)) || [null, ''])[1];
}

export function categoriaAire(pm25) {
  if (pm25 === null || pm25 === undefined) return null;
  if (pm25 <= 50) return { nivel: 'ok', texto: 'bueno' };
  if (pm25 <= 79) return { nivel: 'atencion', texto: 'regular' };
  if (pm25 <= 109) return { nivel: 'alerta', texto: 'nivel de alerta' };
  if (pm25 <= 169) return { nivel: 'alerta', texto: 'nivel de preemergencia' };
  return { nivel: 'alerta', texto: 'nivel de emergencia' };
}

export async function consultarClima([lat, lon]) {
  const comun = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&timezone=America%2FSantiago&forecast_days=2`;
  const [clima, aire] = await Promise.allSettled([
    fetch(
      `${URL_CLIMA}?${comun}&current=temperature_2m,apparent_temperature,weather_code` +
        '&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code&daily=sunrise,sunset',
    ).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))),
    fetch(`${URL_AIRE}?${comun}&current=pm2_5&hourly=pm2_5`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))),
  ]);
  if (clima.status !== 'fulfilled' && aire.status !== 'fulfilled') throw new Error('No se pudo consultar el clima.');
  return leerPronostico(clima.status === 'fulfilled' ? clima.value : null, aire.status === 'fulfilled' ? aire.value : null);
}

// Junta las respuestas de Open-Meteo. Las horas vienen en hora de Santiago sin zona ("2026-10-30T19:00"), y
// JavaScript las lee como hora local del celular, que es la misma.
export function leerPronostico(c, a, ahora = new Date()) {
  const pm25PorHora = new Map((a?.hourly?.time || []).map((t, i) => [t, a.hourly.pm2_5[i]]));
  const horas = (c?.hourly?.time || []).map((t, i) => ({
    t: new Date(t),
    temperatura: c.hourly.temperature_2m[i],
    sensacion: c.hourly.apparent_temperature[i],
    lluvia: c.hourly.precipitation_probability[i],
    codigo: c.hourly.weather_code[i],
    pm25: pm25PorHora.get(t) ?? null,
  }));
  // La hora en curso y las tres siguientes.
  const proximas = horas.filter((h) => h.t > ahora - 3600000 && h.t - ahora <= 3 * 3600000 && h.lluvia !== null);
  const dia = (c?.daily?.time || []).indexOf(claveHoy(ahora));
  return {
    temperatura: c?.current?.temperature_2m ?? null,
    sensacion: c?.current?.apparent_temperature ?? null,
    cielo: c ? textoCielo(c.current?.weather_code) : '',
    lluvia: proximas.length ? Math.max(...proximas.map((h) => h.lluvia)) : null,
    pm25: a?.current?.pm2_5 ?? null,
    horas,
    salida: dia >= 0 ? new Date(c.daily.sunrise[dia]) : null,
    puesta: dia >= 0 ? new Date(c.daily.sunset[dia]) : null,
  };
}

const claveHoy = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const LLUVIOSOS = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99, 71, 73, 75, 77, 85, 86]);

// Qué tan incómoda es una hora para caminar (0 = ideal). Pesa la sensación térmica (ideal entre 12 y 24 °C), la
// probabilidad de lluvia, el MP2,5 y si ya está oscuro.
export function incomodidad(h, { salida, puesta } = {}) {
  let p = 0;
  const s = h.sensacion ?? h.temperatura;
  if (s !== null && s !== undefined) p += Math.max(0, 12 - s) * 2 + Math.max(0, s - 24) * 3;
  if (h.lluvia) p += h.lluvia * 0.6;
  if (LLUVIOSOS.has(h.codigo)) p += 20;
  if (h.pm25 !== null && h.pm25 !== undefined) p += Math.max(0, h.pm25 - 25) * 0.5;
  if (puesta && salida && (h.t > new Date(puesta.getTime() + 30 * 60000) || h.t < salida)) p += 15;
  return p;
}

// La mejor hora para salir entre ahora y las 22:00 de hoy. Devuelve null si ya es tarde o no hay pronóstico.
export function mejorHora(pronostico, ahora = new Date()) {
  const fin = new Date(ahora);
  fin.setHours(22, 0, 0, 0);
  const desde = new Date(ahora);
  desde.setMinutes(0, 0, 0);
  const candidatas = pronostico.horas.filter((h) => h.t >= desde && h.t <= fin);
  if (!candidatas.length) return null;
  const notas = candidatas.map((h) => ({ h, p: incomodidad(h, pronostico) }));
  const mejor = notas.reduce((a, b) => (b.p < a.p ? b : a));
  const ahoraNota = notas[0];
  return { hora: mejor.h, ahora: ahoraNota.p <= mejor.p + 5, nota: mejor.p, dificil: mejor.p > 40 };
}

// Texto para la pantalla Hoy, por ejemplo: "Mejor hora hoy: 19:00 (21 °C, sin lluvia, aire bueno)".
export function textoMejorHora(m) {
  if (!m) return '';
  const h = m.hora;
  const partes = [`${Math.round(h.sensacion ?? h.temperatura)} °C`];
  partes.push(h.lluvia >= 30 ? `${h.lluvia} % de lluvia` : 'sin lluvia');
  const aire = categoriaAire(h.pm25);
  if (aire) partes.push(`aire ${aire.texto}`);
  const hora = `${String(h.t.getHours()).padStart(2, '0')}:00`;
  if (m.dificil) return `Hoy está difícil para caminar afuera. Lo mejor sería a las ${hora} (${partes.join(', ')}).`;
  if (m.ahora && m.nota <= 15) return `Ahora es buen momento para salir (${partes.join(', ')}).`;
  if (m.ahora) return `Lo que queda de hoy no mejora: si sales, mejor ahora (${partes.join(', ')}).`;
  return `Mejor hora hoy: ${hora} (${partes.join(', ')}).`;
}

// Resumen en una línea y avisos para antes de salir.
export function leerClima(c) {
  const partes = [];
  if (c.temperatura !== null) partes.push(`${Math.round(c.temperatura)} °C${c.cielo ? `, ${c.cielo}` : ''}`);
  const aire = categoriaAire(c.pm25);
  if (aire) partes.push(`aire ${aire.texto} (MP2,5: ${Math.round(c.pm25)} µg/m³)`);
  const avisos = [];
  const calor = Math.max(c.temperatura ?? -99, c.sensacion ?? -99);
  if (calor >= 30) avisos.push(`Hace calor (${Math.round(calor)} °C de sensación): lleva agua y prefiere rutas con verde.`);
  if (c.temperatura !== null && c.temperatura <= 5) avisos.push(`Hace frío (${Math.round(c.temperatura)} °C): abrígate.`);
  if (c.lluvia !== null && c.lluvia >= 50) avisos.push(`Puede llover en las próximas horas (${c.lluvia} % de probabilidad).`);
  if (aire && aire.nivel !== 'ok') {
    avisos.push(
      `El aire está ${aire.texto}. Si vas a caminar harto, considera un paseo más corto. ` +
        'Es una estimación del momento; los episodios oficiales los declara la autoridad.',
    );
  }
  return { linea: partes.join(' · '), avisos, nivel: aire?.nivel === 'alerta' ? 'alerta' : avisos.length ? 'atencion' : 'ok' };
}
