// Tu ubicación en el mapa siempre que el mapa esté a la vista (fuera del paseo, que tiene su propio seguimiento).
// El GPS se usa solo mientras el mapa se ve, para no gastar batería; si no das permiso, no se vuelve a pedir hasta
// recargar la app. La última posición sirve también a Hoy ("un timbre nuevo cerca").

let mapa = null;
let vigilancia = null;
let ultima = null;
let negado = false;
const esperando = [];

export function iniciarUbicacion(m) {
  mapa = m;
}

export const ultimaUbicacion = () => ultima?.punto || null;

function recibir(pos) {
  ultima = { punto: [pos.coords.latitude, pos.coords.longitude], precision: pos.coords.accuracy, cuando: Date.now() };
  if (vigilancia !== null) mapa?.mostrarYo(ultima.punto, ultima.precision);
  while (esperando.length) esperando.shift()(ultima.punto);
}

export function prenderUbicacion() {
  if (vigilancia !== null || negado || !('geolocation' in navigator)) return;
  vigilancia = navigator.geolocation.watchPosition(recibir, (err) => {
    if (err.code === err.PERMISSION_DENIED) negado = true;
    apagarUbicacion();
  }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  if (ultima && Date.now() - ultima.cuando < 60000) mapa?.mostrarYo(ultima.punto, ultima.precision);
}

export function apagarUbicacion({ ocultar = true } = {}) {
  if (vigilancia !== null) navigator.geolocation.clearWatch(vigilancia);
  vigilancia = null;
  if (ocultar) mapa?.ocultarYo();
}

export const ubicacionPrendida = () => vigilancia !== null;

// La posición sin preguntar: solo si el permiso ya está dado (para no sorprender con la ventana del GPS al abrir Hoy).
export async function ubicacionSiHayPermiso() {
  if (ultima && Date.now() - ultima.cuando < 120000) return ultima.punto;
  try {
    const permiso = await navigator.permissions?.query({ name: 'geolocation' });
    if (permiso?.state !== 'granted') return null;
  } catch {
    return null;
  }
  return new Promise((resolver) => {
    navigator.geolocation.getCurrentPosition((pos) => {
      recibir(pos);
      resolver(ultima.punto);
    }, () => resolver(null), { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 });
  });
}

// Centra el mapa en ti: con la última posición si es reciente; si no, espera la primera que llegue.
export function centrarEnMi() {
  prenderUbicacion();
  if (ultima && Date.now() - ultima.cuando < 60000) mapa.centrarEn(ultima.punto, 16);
  else esperando.push((punto) => mapa.centrarEn(punto, 16));
}
