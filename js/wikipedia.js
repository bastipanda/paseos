// Wikipedia para la Santiagodex: el resumen del artículo de un lugar (`ref` como "es:Cerro Santa Lucía"), su foto
// (que se usa mientras falta la tuya; no todos los artículos tienen) y el crédito de esa foto (autor y licencia).

const resumenes = new Map();

export function resumenWikipedia(ref) {
  const m = /^(\w{2,3}):(.+)$/.exec(ref || '');
  if (!m) return Promise.resolve(null);
  if (!resumenes.has(ref)) {
    const [, idioma, titulo] = m;
    const url = `https://${idioma}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo.replace(/ /g, '_'))}`;
    resumenes.set(
      ref,
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) =>
          j
            ? {
                texto: j.extract || '',
                enlace: j.content_urls?.mobile?.page || null,
                miniatura: j.thumbnail?.source || null,
                foto: j.originalimage?.source || j.thumbnail?.source || null,
              }
            : null,
        )
        .catch(() => null),
    );
  }
  return resumenes.get(ref);
}

// Autor y licencia de una foto de Wikimedia, desde los metadatos del archivo. Devuelve null si no se pudo saber.
export async function creditoFoto(urlFoto) {
  const m = /\/wikipedia\/(commons|[a-z]{2,3})\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/.exec(urlFoto || '');
  if (!m) return null;
  const [, sitio, archivo] = m;
  const host = sitio === 'commons' ? 'commons.wikimedia.org' : `${sitio}.wikipedia.org`;
  const titulo = `File:${decodeURIComponent(archivo)}`;
  const url = `https://${host}/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent(titulo)}`;
  try {
    const j = await (await fetch(url)).json();
    const meta = Object.values(j.query?.pages || {})[0]?.imageinfo?.[0]?.extmetadata || {};
    return {
      autor: textoPlano(meta.Artist?.value) || 'autor sin dato',
      licencia: textoPlano(meta.LicenseShortName?.value),
      enlace: `https://${host}/wiki/${encodeURIComponent(titulo.replace(/ /g, '_'))}`,
    };
  } catch {
    return null;
  }
}

// El autor viene como HTML (a veces con enlaces). DOMParser lo lee sin cargar imágenes ni ejecutar nada.
function textoPlano(html) {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent.trim().replace(/\s+/g, ' ').slice(0, 80);
}
