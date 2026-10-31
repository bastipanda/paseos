// Capturar con foto (Santiagodex): abre la cámara o la galería, achica la foto, la guarda y deja el lugar como
// capturado. Se usa en la ficha de la Dex y en el aviso "Llegaste a…" del paseo.

import * as almacen from './almacen.js';
import { capturarConFoto } from './dex.js';
import { achicarFoto, guardarFoto } from './fotos.js';

let pendiente = null;

for (const id of ['foto-camara', 'foto-galeria']) {
  document.getElementById(id).addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    const p = pendiente;
    pendiente = null;
    if (!archivo || !p) return;
    try {
      await guardarFoto(p.lugar.id, await achicarFoto(archivo));
      const d = almacen.dex();
      capturarConFoto(d, p.lugar);
      almacen.guardarDex(d);
      p.alTerminar(null);
    } catch (err) {
      console.error(err);
      p.alTerminar(err);
    }
  });
}

// Hay que llamarla dentro del toque de un botón: el iPhone solo abre la cámara o la galería si viene de un toque.
// `alTerminar(error)` se llama cuando la foto quedó guardada (error null) o falló. Si se cancela, no se llama.
export function pedirFoto(lugar, camara, alTerminar) {
  pendiente = { lugar, alTerminar };
  document.getElementById(camara ? 'foto-camara' : 'foto-galeria').click();
}
