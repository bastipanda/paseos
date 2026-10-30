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
  const comun = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`;
  const [clima, aire] = await Promise.allSettled([
    fetch(
      `${URL_CLIMA}?${comun}&current=temperature_2m,apparent_temperature,weather_code` +
        '&hourly=precipitation_probability&forecast_hours=3&timezone=America%2FSantiago',
    ).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))),
    fetch(`${URL_AIRE}?${comun}&current=pm2_5`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status)))),
  ]);
  if (clima.status !== 'fulfilled' && aire.status !== 'fulfilled') throw new Error('No se pudo consultar el clima.');
  const c = clima.status === 'fulfilled' ? clima.value : null;
  const a = aire.status === 'fulfilled' ? aire.value : null;
  return {
    temperatura: c?.current?.temperature_2m ?? null,
    sensacion: c?.current?.apparent_temperature ?? null,
    cielo: c ? textoCielo(c.current?.weather_code) : '',
    lluvia: c?.hourly?.precipitation_probability ? Math.max(...c.hourly.precipitation_probability.filter((x) => x !== null)) : null,
    pm25: a?.current?.pm2_5 ?? null,
  };
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
