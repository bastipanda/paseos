// Fotos propias de la Santiagodex: se achican (~40 KB) y se guardan en IndexedDB, la base de datos del navegador,
// porque localStorage no aguanta archivos de ese tamaño. Igual que lo demás, viven solo en este celular: van en el
// respaldo como texto (data URL).

const BASE = 'paseos';
const ALMACEN = 'fotos';
const LADO_MAXIMO = 720;

let conexion = null;

function abrir() {
  if (!conexion) {
    conexion = new Promise((ok, mal) => {
      const pedido = indexedDB.open(BASE, 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
      pedido.onsuccess = () => ok(pedido.result);
      pedido.onerror = () => mal(pedido.error);
    });
  }
  return conexion;
}

// Hace una operación en el almacén de fotos y espera a que termine.
async function operar(modo, hacer) {
  const bd = await abrir();
  return new Promise((ok, mal) => {
    const tx = bd.transaction(ALMACEN, modo);
    const pedido = hacer(tx.objectStore(ALMACEN));
    tx.oncomplete = () => ok(pedido?.result);
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error || new Error('No se pudo guardar la foto.'));
  });
}

// Se guarda como bytes y tipo (y no como Blob) porque Safari tuvo problemas guardando Blobs en IndexedDB.
export async function guardarFoto(id, blob) {
  const datos = await blob.arrayBuffer();
  await operar('readwrite', (a) => a.put({ tipo: blob.type || 'image/jpeg', datos }, id));
}

export async function leerFoto(id) {
  const f = await operar('readonly', (a) => a.get(id));
  return f ? new Blob([f.datos], { type: f.tipo }) : null;
}

export const borrarFoto = (id) => operar('readwrite', (a) => a.delete(id));

export async function idsConFoto() {
  return new Set(await operar('readonly', (a) => a.getAllKeys()));
}

// Achica la foto de la cámara o la galería a lo más 720 px de lado, en JPEG. Si queda pesada, baja la calidad.
export async function achicarFoto(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo abrir la foto. Prueba con otra.'));
      i.src = url;
    });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
    let blob = null;
    for (const calidad of [0.72, 0.6, 0.48]) {
      blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad));
      if (blob && blob.size <= 60000) break;
    }
    if (!blob) throw new Error('No se pudo procesar la foto.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Para el respaldo: todas las fotos como { id: dataURL }.
export async function fotosParaRespaldo() {
  const ids = await idsConFoto();
  const fotos = {};
  for (const id of ids) {
    const blob = await leerFoto(id);
    if (blob) fotos[id] = await aDataUrl(blob);
  }
  return fotos;
}

// Restaura las fotos de un respaldo sin pisar las que ya están. Devuelve cuántas se agregaron.
export async function restaurarFotos(fotos) {
  if (!fotos || typeof fotos !== 'object') return 0;
  const existentes = await idsConFoto();
  let n = 0;
  for (const [id, url] of Object.entries(fotos)) {
    if (existentes.has(id) || typeof url !== 'string' || !url.startsWith('data:image/')) continue;
    await guardarFoto(id, await (await fetch(url)).blob());
    n++;
  }
  return n;
}

const aDataUrl = (blob) =>
  new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(lector.result);
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(blob);
  });
