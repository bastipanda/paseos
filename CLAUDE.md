# Paseos

App personal para salir a caminar (o pedalear) más y mejor en Santiago: arma rutas a medida, guía en vivo y
registra el avance. Uso propio de Bastián por ahora, pensada como app real. Se usa en su **iPhone** mientras camina.
Meta de fondo (2026-10-30): caminar más para bajar de peso y dejar el sedentarismo.

## Estado
Publicadas: v1 y v1.1 el 2026-10-27; v1.2 y v1.3 el 2026-10-30; v1.4 y v1.5 el 2026-10-31; v1.6 el 2026-11-01.
v1.7 ("una razón para ir": la ficha en cuatro grupos con datos del entorno) construida el 2026-11-01.
v1.8 ("Pasaporte": rediseño completo de la interfaz, la Dex pasa a ser un pasaporte con timbres) publicada el
2026-11-01. Falta probar v1.1 a v1.8 en terreno.

## Qué hace
- **Estilo "Pasaporte" (v1.8):** papel y tinta, minimalista; la interfaz en blanco y negro y el color lo ponen tus
  fotos y tus timbres. Las explicaciones largas van plegadas donde estaban ("i"): nada del texto se perdió.
- **Barra de pestañas abajo:** Hoy, Armar, Pasaporte y Más (Historial, Lugares, Respaldo, Ajustes y créditos).
- **Hoy** (inicio): los minutos de la semana en grande con su barra, cada día caminado timbrado, semanas cumplidas,
  subir o bajar la meta 10 %, mejor hora para salir, **Salir ahora** (15-60 min, ida y vuelta), **Destino sellado**
  (antes "Sorpresa": un lugar sin timbrar, sin decir adónde; se abre al llegar), favoritas y respaldo.
- **Armar** (a medida): partida y término libres (GPS, lugar guardado, punto del mapa, dirección, estación de
  metro). Término también: circular, una plaza y volver, un trámite y volver (súper, farmacia, feria…) o "la
  estación de metro que calce". Duración en pasos, minutos, km o kcal. En "Más opciones" (plegado): estilo
  (Tranquilo, Con vida, Noche), subidas, "Pasar por…", Explorar, **Solo por mis barrios** y vuelta en Bike Itaú.
- **Mapa nunca tapado:** en Armar, Resultados y Resumen el panel se pliega a una franja (y se esconde la barra).
- **Resultados:** tarjeta con pasos, minutos, km, % tranquila y subida; avisos de luz y del metro a la vista; plegados
  el por qué, la calidad de las calles, la comparación con el camino más corto y los robos por comuna (CEAD).
  Favorita y GPX para OsmAnd u Organic Maps. En la última opción, **Más ›** busca otras con lo mismo pedido.
- **Seguimiento:** franja arriba con flecha y próxima indicación; abajo una barra delgada con lo que falta que abre
  un menú: ritmo, **Llévame al metro**, intervalos 3+3 (avisan con el color de la barra), metrónomo y voz (apagada
  por defecto). "Seguirme" aparece si mueves el mapa. Al llegar a un lugar, su timbre punteado espera tu foto.
  La pantalla no se apaga.
- **Aprender a ubicarme** (Ajustes, prendido): rosa de los vientos bajo el zoom (en el paseo, bajo la franja) con la
  cordillera al oriente, y el punto cardinal bajo cada giro ("Hacia el oriente (la cordillera al frente)").
- **Al terminar:** va solo al **historial** (gráfico de 8 semanas y paseos a mano); resumen, lo timbrado y postal
  (papel, tinta y la cordillera al pie).
- **Pasaporte (antes Santiagodex):** 3.236 lugares numerados desde Plaza Baquedano; cada comuna es una **página** con
  **visados** al 25, 50 y 100 %. "Visto" a <150 m; "falta tu foto" si llegas (≤40 m, o un tercio de un parque, máx.
  200 m); **timbrado solo con tu foto**: queda como **polaroid** (al pie, tu nota o la fecha) con el **timbre con la
  forma de su tipo** (plaza = árbol, cerro = montaña, juegos = volantín…) en la esquina; **conmemorativo** si está en
  un monumento o zona típica del CMN. Al pegar la foto, **"¡Timbrado!"** con lo que falta para el próximo visado. Lo
  que falta, silueta punteada con su número. Ficha: frase destacada (placa o Wikipedia), polaroid y espacio "TIMBRE",
  **campos rotulados** y cuatro grupos plegables (Su historia, Qué hay, Dónde estás, Tú y este lugar). **Tu mapa.**
- **Ajustes:** meta, paso, velocidad, peso, paso enérgico, metrónomo, ubicarme, mis barrios y evento semanal (.ics).

## Definiciones
- **"Tranquila" para Bastián:** sin miedo a que le roben; a veces eso es con gente e iluminado. Por eso hay tres
  **estilos** con su perfil: **Tranquilo** (`paseo-tranquilo.brf`, poco ruido y verde), **Con vida** (`paseo-vida.brf`,
  avenidas, paseos peatonales, comercio) y **Noche** (`paseo-noche.brf`, iluminado y transitado; evita callejones,
  senderos, parques oscuros y escaleras; solo ~30 % de las calles dice si tiene luz). Sin delitos por calle: no existen.
- **Bike-friendly:** ciclovías y calles de poco tráfico; evita avenidas sin ciclovía y peatonales (no es "menos giros").
- **Conversiones:** pasos = metros ÷ paso (0,75 m); minutos = metros ÷ velocidad (4,5 km/h); kcal = MET(velocidad) ×
  peso × horas (Compendio de Actividades Físicas) + subida × peso × 0,009 (ACSM). Estimación gruesa (±20-30 %).
- **Minutos de la meta:** minutos en movimiento del GPS (ventanas de 15 s a más de 1,8 km/h) más los agregados a
  mano. **Paso enérgico:** ≥ 5 km/h (ajustable). Semanas de lunes a domingo.

## Arquitectura
- **Web app estática** (HTML, CSS y JS sin compilación ni servidor). `js/app.js` conecta todo; las pantallas nuevas
  van en `js/pantalla-*.js` y reciben lo que necesitan al iniciarse (`iniciarHoy`, `iniciarHistorial`, `iniciarDex`).
- **Estilo:** `css/estilos.css` (variables, `--tipo` por tipo, modo oscuro); letras en `fuentes/` (OFL). Sin emojis:
  íconos en `js/iconos.js`, timbres SVG en `js/timbres.js` (filtro `#tinta` en `index.html`), momento del timbre en
  `js/timbrado.js`. En el código el Pasaporte sigue siendo "dex" (claves de `localStorage` y respaldo sin cambios).
- **Vistas:** todas viven en el `#panel` y se cambian con `irA()`. Las **páginas** (`PAGINAS`: Hoy, Dex, Más y lo
  que cuelga de ahí) ocupan toda la pantalla y tapan el mapa; Armar, Resultados, Paseo y Resumen son el mapa con el
  panel abajo. Resultados, Paseo y Resumen esconden la barra (`SIN_PESTANAS`). Desde una página, `verEnMapa(título)`
  deja el mapa entero con "Volver" arriba (el mapa siempre está cargado detrás: Leaflet falla si nace escondido).
- **Mapa:** Leaflet con teselas de OSM y la atribución visible. **Rutas:** servidor público de BRouter (`brouter.de`)
  con perfiles propios (`perfiles/*.brf`); la app agrega puntos intermedios para calzar la duración, evalúa y ordena.
  Giros con `timode=2`. `profile:evitar_subidas=1`. Cada ruta guarda con qué se pidió (`peticion`): las favoritas
  se piden otra vez con eso. Cada opción guarda su `destino` (plaza, trámite, Dex o estación) e `idaYVuelta`.
- **Datos (`datos/`), generados con scripts y guardados en el repo** (la app nunca consulta Overpass en vivo):
  `node scripts/plazas.mjs` (plazas), `node scripts/lugares.mjs [interes|comercio|servicios|tramites|metro]`,
  `node scripts/comunas.mjs` (contornos y cuadros de calles por comuna; varios minutos). Después, para la Dex:
  `contexto.mjs` (OSM, Wikidata, Wikipedia y Commons), `entorno.mjs` (OSM, altura de Open-Meteo, monumentos del CMN),
  `especies.mjs` (iNaturalist, ~1 hora) y `menciones.mjs` (ver Decisiones). Comparten `scripts/comun.mjs`; los largos
  guardan su avance en `scripts/.cache/` (no va al repo). Los textos de la ficha salen de `js/entorno.js`.
  `delitos.json` se copió a mano del CEAD (robos violentos 2025 por comuna). Lo grande se carga al usarse.
- **Clima:** Open-Meteo (pronóstico por hora, puesta de sol y MP2,5 con categorías del Ministerio del Medio Ambiente).
- **Otros servicios:** GBFS de Bike Itaú, Nominatim (una búsqueda por toque en "Buscar") y resumen de Wikipedia.
- **Datos del usuario** (`localStorage`, nunca al repo): lugares, ajustes, formulario, conocidas, historial, metas,
  favoritas, Dex con tus notas y paseo en curso (para no perderlo si se cierra el navegador). Las fotos de la Dex en
  IndexedDB (`js/fotos.js`, achicadas a ~40 KB). Respaldo JSON versión 4, con las fotos como texto.
- **Publicación:** GitHub Pages desde el repo público (el GPS exige HTTPS).

## Hechos verificados
- BRouter público: CORS abierto, perfiles propios por `POST /brouter/profile`. No publica reglas de uso: pedir poco.
- GBFS Bike Itaú: `https://santiago.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json` (y Open-Meteo): CORS abierto.
- 2026-10-30, desde OSM: 4.437 plazas, 1.479 lugares interesantes (101 cerros), 21.658 locales, 402 bebederos y
  baños, 4.022 trámites, 126 estaciones (líneas 1-6 y 4A). En Providencia-Ñuñoa solo el 31 % de calles dice su luz.
- CMN: capas públicas de contornos y de puntos (88 monumentos solo como punto); decretos escaneados, sin texto.
  iNaturalist: `preferred_place_id=7182` da nombres de Chile; una consulta por segundo. Open-Meteo cuenta cada punto
  de altura como una consulta (límite por hora). Commons: miniaturas solo en anchos fijos (330 sí, 320 no).
- CEAD 2025: 922,9 robos violentos por 100 mil hab. en la RM. Metro: 6:00-23:00 según prensa (sin fuente oficial).
  Si BRouter falla: OpenRouteService (pide clave) o GraphHopper (500 créditos al día).

## Secretos
No usa claves. Si algún día se agrega un servicio con clave, va en el navegador o en `.env`, nunca en el repo.

## Cómo probar y publicar
- **Pruebas:** `npm test` (Node, sin internet). **En el computador:** `python -m http.server 8765` y abrir
  `http://localhost:8765` (sin GPS: "Marcar en el mapa"; si un dato no se actualiza, recargar sin caché).
- **En el celular:** `https://bastipanda.github.io/paseos/` ("Agregar a la pantalla de inicio" para abrirla como app).
- **Publicar:** cada push a `main` lo publica GitHub Pages en uno o dos minutos (el celular guarda 10 min de caché).

## Convenciones
- Costo cero (avisar antes de algo que cobre). Textos, comentarios y commits en español; commits chicos con el porqué.
- Antes de cada push: resumen en simple y esperar el OK de Bastián.

## Decisiones tomadas
- **Uso propio por ahora, pensada como app real** (2026-11-01): se diseña como si Bastián fuera un usuario más de una
  app pública: propósito claro, objetivos y mecánicas evidentes, fácil sin explicación previa. Publicarla y postular a
  fondos queda para un futuro lejano (`BACKLOG.md`). **Repo público** (lo exige Pages): nada privado.
- **Celular mientras camina** → web app con GPS en vivo. **BRouter** en vez de OpenRouteService (sin cuenta ni clave).
- **Nada fijo:** partida, término, duración y modo se eligen en cada paseo; los lugares guardados son atajos.
- **La app explica, no solo puntúa**, sin inventar lo que los datos no dicen.
- **Navegación propia + GPX, sin Google Maps** (recalcula su propio camino; Bastián prefiere apps abiertas).
- **Estilos en vez de una sola "tranquila"**, y **explorar se marca a mano** (las búsquedas no cuentan).
- **v1.3 (2026-10-30):** la meta es semanal y en minutos (las rachas diarias se cortan y desaniman); Hoy es la
  pantalla de inicio para salir en un toque; el historial es un dato que no se regenera (va en el respaldo).
- **Seguridad con datos reales y sus límites:** CEAD por comuna solo como contexto, nunca para elegir rutas
  (comunas con gente de paso salen más altas por habitante). Por lo mismo, **"Mis barrios" en vez de "cuico"**:
  Bastián elige sus comunas, sin datos de ingreso que etiqueten barrios.
- **Coleccionar lugares en vez de puntos o niveles:** conocer Santiago motiva más. Desde la v1.4, **timbrar = tu
  foto**: la foto es parte de la experiencia; la app no revisa que sea del lugar (queda a conciencia de Bastián).
- **v1.8 (2026-11-01): Pasaporte en vez de Pokédex.** La estética Pokémon amarra a un estilo ajeno y es marca
  registrada (cerraría la puerta a mostrarla o postular a fondos). Inspiración: el Pasaporte Patrimonial del Servicio
  Nacional del Patrimonio Cultural (ideas, no su diseño ni su nombre). Minimalista pero gratificante: lo lúdico sale de
  la mecánica (llenar páginas, el "te faltan N", el momento del timbre), no de verse como videojuego. Premiar por
  caminar, nunca castigar por no caminar. Las decisiones visuales se toman con maquetas lado a lado.
- **Contexto verificable, no "historia para todos"** (v1.6): la mayoría de las plazas no tiene historia escrita;
  inventarla (o pedírsela a una IA) rompería "la app explica sin inventar". Tu nota llena lo que falta. En la v1.7
  la IA solo **subraya**: Claude Code elige entre frases de Wikipedia y `menciones.mjs --verificar` revisa que estén
  letra por letra (la app no usa IA).
- **Recordatorios con el calendario del celular** (.ics), no notificaciones propias (necesitarían un servidor).
- **v1.4 (2026-10-31): interfaz limpia.** Bastián se orienta mirando el mapa, no con la voz: voz apagada por defecto,
  sin modo bolsillo, el mapa nunca queda tapado sin forma de verlo entero y lo secundario va plegado.
