// Conversión entre pasos, minutos, kilómetros y calorías, y manejo del rango pedido (mínimo y/o máximo).

export const UNIDADES = {
  pasos: { nombre: 'pasos', corto: 'pasos' },
  minutos: { nombre: 'minutos', corto: 'min' },
  km: { nombre: 'kilómetros', corto: 'km' },
  kcal: { nombre: 'calorías', corto: 'kcal' },
};

export const AJUSTES_POR_DEFECTO = { largoPaso: 0.75, velocidadKmh: 4.5, peso: null };

const metrosPorMinuto = (ajustes) => (ajustes.velocidadKmh * 1000) / 60;

// Intensidad de caminar en terreno plano (MET) según la velocidad, aproximada con valores del Compendio de
// Actividades Físicas (ediciones 2011 y 2024). Entre los puntos se interpola.
const MET_POR_VELOCIDAD = [
  [3.2, 2.8],
  [4.0, 3.0],
  [5.0, 3.8],
  [6.0, 4.8],
  [6.4, 5.0],
];

export function met(velocidadKmh) {
  const tabla = MET_POR_VELOCIDAD;
  if (velocidadKmh <= tabla[0][0]) return tabla[0][1];
  for (let i = 1; i < tabla.length; i++) {
    const [v1, m1] = tabla[i - 1];
    const [v2, m2] = tabla[i];
    if (velocidadKmh <= v2) return m1 + ((m2 - m1) * (velocidadKmh - v1)) / (v2 - v1);
  }
  return tabla[tabla.length - 1][1];
}

export const tienePeso = (ajustes) => Number(ajustes.peso) > 0;

// kcal = MET × peso (kg) × horas. Con velocidad fija, las calorías son proporcionales a la distancia.
function kcalPorMetro(ajustes) {
  if (!tienePeso(ajustes)) throw new Error('Para usar calorías, anota tu peso en Ajustes.');
  return (met(ajustes.velocidadKmh) * Number(ajustes.peso)) / (ajustes.velocidadKmh * 1000);
}

export function aMetros(valor, unidad, ajustes) {
  if (unidad === 'pasos') return valor * ajustes.largoPaso;
  if (unidad === 'minutos') return valor * metrosPorMinuto(ajustes);
  if (unidad === 'km') return valor * 1000;
  if (unidad === 'kcal') return valor / kcalPorMetro(ajustes);
  throw new Error(`Unidad desconocida: ${unidad}`);
}

export function desdeMetros(metros, unidad, ajustes) {
  if (unidad === 'pasos') return metros / ajustes.largoPaso;
  if (unidad === 'minutos') return metros / metrosPorMinuto(ajustes);
  if (unidad === 'km') return metros / 1000;
  if (unidad === 'kcal') return metros * kcalPorMetro(ajustes);
  throw new Error(`Unidad desconocida: ${unidad}`);
}

// Convierte lo que escribió el usuario a metros. Un campo vacío queda como null.
export function rangoEnMetros({ min, max, unidad }, ajustes) {
  const convertir = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : aMetros(Number(v), unidad, ajustes));
  const rango = { min: convertir(min), max: convertir(max) };
  if (rango.min === null && rango.max === null) throw new Error('Indica un mínimo, un máximo o ambos.');
  if (rango.min !== null && rango.min <= 0) throw new Error('El mínimo tiene que ser mayor que cero.');
  if (rango.max !== null && rango.max <= 0) throw new Error('El máximo tiene que ser mayor que cero.');
  if (rango.min !== null && rango.max !== null && rango.min > rango.max) {
    throw new Error('El mínimo es mayor que el máximo.');
  }
  return rango;
}

// Largo al que se apunta al generar rutas: el centro del rango, o un poco más allá del límite que exista.
export function objetivo(rango) {
  if (rango.min !== null && rango.max !== null) return (rango.min + rango.max) / 2;
  if (rango.min !== null) return rango.min * 1.12;
  return rango.max * 0.85;
}

export function cumple(metros, rango) {
  if (rango.min !== null && metros < rango.min) return false;
  if (rango.max !== null && metros > rango.max) return false;
  return true;
}

// Cuánto se aleja un largo del rango (0 si está dentro).
export function desvio(metros, rango) {
  if (rango.min !== null && metros < rango.min) return rango.min - metros;
  if (rango.max !== null && metros > rango.max) return metros - rango.max;
  return 0;
}

// Resta un largo ya comprometido (por ejemplo, el último tramo a pie) a ambos límites del rango.
export function restar(rango, metros) {
  const r = {
    min: rango.min === null ? null : Math.max(0, rango.min - metros),
    max: rango.max === null ? null : rango.max - metros,
  };
  if (r.max !== null && r.max <= 0) return null;
  if (r.min === 0) r.min = null;
  if (r.min === null && r.max === null) return null;
  return r;
}

export function resumen(metros, ajustes) {
  return {
    metros,
    pasos: Math.round(desdeMetros(metros, 'pasos', ajustes)),
    minutos: Math.round(desdeMetros(metros, 'minutos', ajustes)),
    km: metros / 1000,
    kcal: tienePeso(ajustes) ? Math.round(desdeMetros(metros, 'kcal', ajustes)) : null,
  };
}

const numero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatearPasos(pasos) {
  return `${numero.format(pasos)} pasos`;
}

export function formatearDistancia(metros) {
  return metros < 1000 ? `${numero.format(Math.round(metros / 10) * 10)} m` : `${decimal.format(metros / 1000)} km`;
}

export function formatearKcal(kcal) {
  return `${numero.format(Math.round(kcal / 10) * 10)} kcal`;
}

export function formatearMinutos(minutos) {
  if (minutos < 60) return `${numero.format(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
