// Estaciones Bike Itaú desde el feed público GBFS (formato estándar de bicis compartidas).
// El feed permite que el navegador lo lea directo, sin servidor intermedio.

const BASE = 'https://santiago.publicbikesystem.net/customer/gbfs/v3.0';
const VIGENCIA_MS = 60 * 1000;

let cache = null;

function nombreDe(estacion) {
  const n = estacion.name;
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return (n.find((x) => x.language === 'es') || n[0] || {}).text || 'Estación';
  return 'Estación';
}

// Junta la información fija (dónde están) con el estado en vivo (bicis y anclajes libres).
export function unirEstaciones(info, estado) {
  const porId = new Map(estado.data.stations.map((s) => [s.station_id, s]));
  return info.data.stations
    .map((s) => {
      const st = porId.get(s.station_id) || {};
      const bicis = st.num_vehicles_available ?? st.num_bikes_available ?? 0;
      const instalada = st.is_installed !== false && st.is_installed !== 0;
      return {
        id: s.station_id,
        nombre: nombreDe(s),
        punto: [s.lat, s.lon],
        bicis,
        anclajes: st.num_docks_available ?? 0,
        operativa: instalada && st.is_renting !== false && st.is_renting !== 0,
        recibe: instalada && st.is_returning !== false && st.is_returning !== 0,
      };
    })
    .filter((e) => Number.isFinite(e.punto[0]) && Number.isFinite(e.punto[1]));
}

export async function cargarEstaciones({ forzar = false } = {}) {
  if (!forzar && cache && Date.now() - cache.hora < VIGENCIA_MS) return cache.estaciones;
  const [info, estado] = await Promise.all(
    ['station_information', 'station_status'].map(async (feed) => {
      const resp = await fetch(`${BASE}/${feed}`);
      if (!resp.ok) throw new Error(`No se pudo leer ${feed} de Bike Itaú (${resp.status}).`);
      return resp.json();
    }),
  );
  const estaciones = unirEstaciones(info, estado);
  cache = { hora: Date.now(), estaciones };
  return estaciones;
}
