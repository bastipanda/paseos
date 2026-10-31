# Paseos

App personal para salir a caminar (o pedalear) más y mejor en Santiago: arma rutas a medida, guía en vivo y
registra el avance. Uso propio de Bastián, no comercial. Se usa en su **iPhone** mientras camina.
Meta de fondo (2026-10-30): caminar más para bajar de peso y dejar el sedentarismo.

## Estado
v1 y v1.1 publicadas el 2026-10-27; v1.2 el 2026-10-30. v1.3 ("salir más y conocer Santiago") construida el
2026-10-30. Falta probar v1.1, v1.2 y v1.3 en terreno (ver `BACKLOG.md`).

## Qué hace
- **Hoy** (inicio): anillo con los minutos caminados de la semana y la meta semanal, semanas cumplidas, propuesta de
  subir la meta 10 % (o bajarla), mejor hora para salir hoy, **Salir ahora** (15/30/45/60 min, ida y vuelta desde
  el GPS), **Sorpresa** (paseo misterio a un lugar sin capturar), rutas favoritas y aviso mensual de respaldo.
- **Armar** (a medida): partida y término libres (GPS, lugar guardado, punto del mapa, dirección, estación de
  metro). Término también puede ser: circular, una plaza y volver, un trámite y volver (súper, farmacia, panadería,
  feria, cajero, ferretería) o "la estación de metro que calce". Duración en pasos, minutos, km o kcal. Estilo
  (Tranquilo, Con vida, Noche), subidas (Evitar, Da igual, Buscar), "Pasar por…", Explorar, vuelta en Bike Itaú.
- **Resultados:** por qué esta ruta, comparación con el camino más corto, **seguridad** (si terminarías de noche,
  cierre del metro y robos violentos de las comunas, del CEAD), favorita, GPX para OsmAnd u Organic Maps.
- **Seguimiento:** próxima indicación con voz, ritmo y minutos a paso enérgico, metrónomo, intervalos 3+3, modo
  bolsillo (pantalla negra, solo voz; se sale manteniendo apretado), **Llévame al metro** (estación más cercana y
  ruta por calles con vida) y capturas de la Santiagodex en vivo. La pantalla no se apaga.
- **Al terminar:** se guarda solo en el historial; resumen con la semana y lo capturado; postal para compartir.
- **Historial:** paseos con gráfico de 8 semanas; también paseos agregados a mano.
- **Dex (Santiagodex):** 3.236 lugares numerados desde Plaza Baquedano. "Visto" si pasas a <150 m, "capturado" si
  llegas (≤40 m, o un tercio del tamaño de un parque, máx. 200 m) o si lo marcas a mano. **Tu mapa:** lo caminado y
  lo conocido, con el % de calles caminables de cada comuna.
- **Ajustes:** meta semanal, paso, velocidad, peso, paso enérgico, metrónomo y evento semanal en el calendario (.ics).

## Definiciones
- **"Tranquila" para Bastián:** caminar sin miedo a que le roben; a veces eso es con gente e iluminado. Por eso hay
  tres **estilos**, cada uno con su perfil: **Tranquilo** (`paseo-tranquilo.brf`, poco ruido y verde), **Con vida**
  (`paseo-vida.brf`, veredas de avenidas, paseos peatonales, comercio) y **Noche** (`paseo-noche.brf`, iluminado y
  transitado; evita callejones, senderos, parques oscuros y escaleras; solo ~30 % de las calles de OSM dice si
  tiene luz). Ninguno usa datos de delitos por calle: no existen.
- **Bike-friendly:** ciclovías y calles de poco tráfico; evita avenidas sin ciclovía y calles peatonales. **No** es
  reducir virajes.
- **Conversiones:** pasos = metros ÷ largo del paso (0,75 m); minutos = metros ÷ velocidad (4,5 km/h);
  kcal = MET(velocidad) × peso × horas (Compendio de Actividades Físicas) + subida × peso × 0,009 (ecuación de
  caminata del ACSM). Estimación gruesa (±20-30 %).
- **Minutos de la meta:** minutos en movimiento del GPS (ventanas de 15 s a más de 1,8 km/h) más los agregados a
  mano. **Paso enérgico:** ≥ 5 km/h (ajustable). Semanas de lunes a domingo.

## Arquitectura
- **Web app estática** (HTML, CSS y JS sin compilación ni servidor). `js/app.js` conecta todo; las pantallas nuevas
  van en `js/pantalla-*.js` y reciben lo que necesitan al iniciarse (`iniciarHoy`, `iniciarHistorial`, `iniciarDex`).
- **Mapa:** Leaflet con teselas de OSM y la atribución visible.
- **Rutas:** servidor público de BRouter (`brouter.de`) con perfiles propios (`perfiles/*.brf`). La app agrega
  puntos intermedios para calzar la duración, evalúa y ordena. Giros con `timode=2`. `profile:evitar_subidas=1`.
  Cada ruta guarda con qué se pidió (`peticion`): las favoritas se piden otra vez con eso (no se guarda la ruta).
- **Destino de una opción:** `destino` = plaza, trámite, lugar de la Dex o estación; `idaYVuelta` si se vuelve.
- **Datos (`datos/`), generados con scripts y guardados en el repo** (la app nunca consulta Overpass en vivo):
  `node scripts/plazas.mjs` (plazas), `node scripts/lugares.mjs [interes|comercio|servicios|tramites|metro]`,
  `node scripts/comunas.mjs` (contornos y cuadros de calles por comuna; tarda varios minutos). `delitos.json` se
  copió a mano del portal del CEAD (robos violentos 2025 por comuna; no hay descarga abierta).
  Los archivos grandes se cargan solo cuando se usan (`js/datos.js`).
- **Clima:** Open-Meteo (pronóstico por hora, puesta de sol y MP2,5 con categorías del Ministerio del Medio Ambiente).
- **Otros servicios:** GBFS de Bike Itaú, Nominatim (una búsqueda por toque en "Buscar") y resumen de Wikipedia.
- **Datos del usuario** (`localStorage`, nunca al repo): lugares, ajustes, formulario, conocidas, historial, metas,
  favoritas, Dex y paseo en curso (para no perderlo si se cierra el navegador). Respaldo JSON versión 3.
- **Publicación:** GitHub Pages desde el repo público (el GPS exige HTTPS).

## Hechos verificados
- BRouter público: CORS abierto, perfiles propios por `POST /brouter/profile`. No publica reglas de uso: pedir poco.
- GBFS Bike Itaú: `https://santiago.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json` (CORS abierto).
- GitHub Pages gratis solo publica repos públicos. Open-Meteo responde con CORS abierto.
- 2026-10-30, desde OSM: 4.437 plazas, 1.479 lugares interesantes (101 cerros), 21.658 locales, 402 bebederos y
  baños, 4.022 trámites y 126 estaciones de metro en 7 líneas (1-6 y 4A; la 7 y las extensiones proyectadas se
  descartan). En Providencia-Ñuñoa solo el 31 % de las calles tiene dato de luz.
- CEAD 2025: robos violentos 922,9 por 100 mil habitantes en la Región Metropolitana.
- Horario del metro: la prensa dice 6:00-23:00 en días hábiles, pero no se encontró la fuente oficial.
- Alternativas si BRouter falla: OpenRouteService (pide clave) o GraphHopper (500 créditos al día).

## Secretos
No usa claves. Si algún día se agrega un servicio con clave, va en el navegador o en `.env`, nunca en el repo.

## Cómo probar y publicar
- **Pruebas automáticas** (sin internet): `npm test`. Necesita Node.
- **En el computador:** `python -m http.server 8765` en la carpeta y abrir `http://localhost:8765`. Sin GPS, usar
  "Marcar en el mapa".
- **En el celular:** `https://bastipanda.github.io/paseos/` ("Agregar a la pantalla de inicio" para abrirla como app).
- **Publicar:** cada push a `main` lo publica GitHub Pages en uno o dos minutos.

## Convenciones
- Costo cero. Avisar antes de cualquier cosa que pueda cobrar.
- Textos, comentarios y commits en español. Commits chicos que expliquen el porqué.
- Antes de cada push: resumen en simple y esperar el OK de Bastián.

## Decisiones tomadas
- **Uso propio, no comercial.** Lo propio son los ajustes a medida.
- **Celular mientras camina** → web app con GPS en vivo. **BRouter** en vez de OpenRouteService (sin cuenta ni clave).
- **Nada fijo:** partida, término, duración y modo se eligen en cada paseo; los lugares guardados son atajos.
- **Repo público** (lo exige Pages gratis). Nada privado va al repo.
- **La app explica, no solo puntúa**, sin inventar lo que los datos no dicen.
- **Navegación propia + GPX, sin Google Maps** (recalcula su propio camino; Bastián prefiere apps abiertas).
- **Datos guardados, no Overpass en vivo** (se cae seguido).
- **Estilos en vez de una sola "tranquila"**, y **explorar se marca a mano** (las búsquedas no cuentan).
- **v1.3 (2026-10-30):** la meta es semanal y en minutos (las rachas diarias se cortan y desaniman); Hoy es la
  pantalla de inicio para salir en un toque; el historial es un dato que no se regenera (va en el respaldo).
- **Seguridad con datos reales y sus límites:** CEAD por comuna solo como contexto, nunca para elegir rutas
  (comunas con gente de paso salen más altas por habitante).
- **Santiagodex en vez de puntos o niveles:** conocer Santiago motiva más. Captura caminando o a mano.
- **Recordatorios con el calendario del celular** (.ics), no notificaciones propias (necesitarían un servidor).
