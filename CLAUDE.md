# Paseos

App personal que arma rutas a medida para salir a caminar o pedalear en Santiago.
Uso propio de Bastián, no comercial. Se usa en el celular mientras camina.

## Estado
v1 publicada y probada en terreno el 2026-10-27. v1.1 construida el 2026-10-27 (plazas, explicaciones, guía giro a
giro y GPX); falta probarla en terreno.

## Qué hace
- **Partida y término libres:** cada uno puede ser la ubicación GPS, un lugar guardado o un punto del mapa.
  Si son el mismo punto, la ruta es circular.
- **Duración:** mínimo y/o máximo en pasos, minutos o kilómetros. Se puede dejar uno de los dos vacío.
- **Calles tranquilas a pie** siempre.
- **Vuelta en Bike Itaú (opcional, un interruptor):** se camina hasta una estación con bicis y se pedalea por calles
  bike-friendly hasta la estación con anclajes libres más cercana al término. De ahí se camina el último tramo.
  No hay "estación casa" fija: se elige según el término de cada paseo.
- **Ir a una plaza y volver:** el término puede ser "una plaza"; la app elige plazas, plazoletas, parques o plazas
  de juegos a la distancia justa y fuerza la vuelta por otras calles. No se combina con Bike Itaú (todavía).
- **Explica cada opción:** por qué lugares pasa, por qué tipo de calles, tramos ruidosos y su motivo, y cuánto se
  desvía respecto del camino más corto para evitar avenidas. Tocar un tramo del mapa dice qué es.
- **Lugares guardados (opcional):** nombre + punto, para usarlos como partida o término.
- **Seguimiento en vivo:** la ruta, tu posición, lo que falta y la próxima indicación ("En 40 m, dobla a la
  derecha"), con voz opcional del navegador. La pantalla no se apaga.
- **Abrir en otra app:** GPX para OsmAnd u Organic Maps (menú de compartir o descarga).

## Definiciones
- **Tranquila (a pie):** pasajes, calles residenciales, parques y senderos. Se evitan avenidas grandes.
  Se calcula con el tipo de calle que registra OpenStreetMap (OSM).
- **Bike-friendly (en bici):** prefiere ciclovías y calles de poco tráfico. Evita avenidas sin ciclovía y calles
  peatonales o con mucha gente. **No** se trata de reducir virajes. OSM no mide flujo de gente, así que se aproxima
  con el tipo de calle (por ejemplo, `highway=pedestrian` o una avenida sin ciclovía).
- **Segura (delincuencia):** fuera de la v1. No hay datos por calle verificados.
- **Conversiones:** pasos = metros ÷ largo del paso (0,75 m por defecto) y minutos = metros ÷ velocidad
  (4,5 km/h por defecto). Ambos valores se ajustan en la app.

## Arquitectura
- **Web app estática:** HTML, CSS y JavaScript sin compilación y sin servidor propio.
- **Mapa:** Leaflet con teselas de OSM, con la atribución "© OpenStreetMap" visible.
- **Rutas a pie y en bici:** el servidor público de BRouter (`brouter.de`), que no pide clave. La app sube dos
  perfiles propios (`perfiles/*.brf`): uno a pie que premia lo tranquilo y otro en bici que premia ciclovías.
- **Largo de la ruta:** BRouter no recibe un largo objetivo, así que la app agrega puntos intermedios para
  alargar el recorrido. Genera varias candidatas, descarta las que no cumplen la duración y ordena el resto por
  qué tan tranquilas son (con las etiquetas de calle que devuelve BRouter).
- **Giros:** BRouter los entrega con `timode=2` en la consulta. La app recalcula el ángulo con la geometría (por si
  se recortó un espolón) y arma el texto ella misma.
- **Comparación:** un tercer perfil, `paseo-corto.brf`, da el camino más corto con las mismas etiquetas de calle.
- **Plazas:** `datos/plazas.json`, generado desde OSM con `node scripts/plazas.mjs` (Overpass). Se regenera cada
  algunos meses; la app nunca consulta Overpass en vivo.
- **Estaciones Bike Itaú:** feed público GBFS, leído directo desde el navegador.
- **Búsqueda de direcciones:** Nominatim (OSM). Una búsqueda por cada vez que se aprieta "Buscar", nunca
  mientras se escribe, porque así lo piden sus reglas de uso.
- **Datos del usuario:** los lugares guardados y los ajustes quedan en el navegador (`localStorage`). Nunca van al
  repo. Como no se pueden regenerar, la app permite exportarlos e importarlos como archivo (respaldo).
- **Publicación:** GitHub Pages desde un repo público. El GPS del navegador exige HTTPS, y Pages lo da gratis.

## Hechos verificados (2026-10-27)
- BRouter público responde con `Access-Control-Allow-Origin: *` y acepta perfiles propios en `POST /brouter/profile`,
  que devuelve un `profileid` como `custom_123`. Su README no publica reglas de uso: hay que pedir poco y en orden.
- Feed GBFS de Bike Itaú Santiago: `https://santiago.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json`, también con
  `access-control-allow-origin: *`. Incluye `station_information` y `station_status`.
- Según prensa de junio 2026, Bike Itaú tiene 199 estaciones en Las Condes, Vitacura, Providencia,
  Independencia y Ñuñoa. Dejó Santiago Centro en 2025.
- GitHub Pages en cuenta gratis solo publica desde repos **públicos** (según docs de GitHub).
- Overpass (`overpass-api.de`) respondió el 2026-10-27 en la noche: 4.437 lugares, 1.930 con nombre, 200 KB.
  En la mañana había fallado en tres servidores; por eso el script prueba varios.
- Alternativas si BRouter falla: OpenRouteService (2.000 rutas al día gratis, pide clave; "green" y "quiet" eran solo
  para Alemania) o GraphHopper (500 créditos al día, no comercial).

## Secretos
La v1 no usa claves. Si algún día se agrega un servicio con clave, va en el navegador o en `.env`, nunca en el repo.

## Archivos
- `index.html`, `css/estilos.css`: la pantalla. `js/app.js` conecta todo.
- `js/generador.js`: arma y ordena las opciones. `js/brouter.js`: habla con BRouter.
- `js/tranquilidad.js`: clasifica calles. `js/geo.js`: cálculos de distancia. `js/duracion.js`: pasos/min/km.
- `js/bikeitau.js`: estaciones. `js/almacen.js`: lugares y ajustes en el navegador. `js/seguimiento.js`: GPS.
- `js/plazas.js`: lista de plazas. `js/explicar.js`: textos de "por qué". `js/guia.js`: giros y voz. `js/gpx.js`.
- `perfiles/*.brf`: qué calles prefiere BRouter. `datos/plazas.json` + `scripts/plazas.mjs`. `tests/`: pruebas.

## Cómo probar y publicar
- **Pruebas automáticas** (lógica, sin internet): `npm test`. Necesita Node.
- **En el computador:** en la carpeta del proyecto, `python -m http.server 8765` y abrir `http://localhost:8765`.
  El GPS funciona en `localhost`; si el navegador no lo da, usar "Marcar en el mapa".
- **En el celular:** `https://bastipanda.github.io/paseos/` (una vez publicado). Se puede "Agregar a la pantalla
  de inicio" para abrirla como app.
- **Publicar:** cada push a `main` lo publica GitHub Pages solo, en uno o dos minutos.

## Convenciones
- Costo cero. Avisar antes de cualquier cosa que pueda cobrar.
- Textos, comentarios y commits en español. Commits chicos que expliquen el porqué.
- Antes de cada push: resumen en simple y esperar el OK de Bastián.

## Decisiones tomadas
- **Uso propio, no comercial.** Lo propio de la app son los ajustes a medida, no la originalidad.
- **Celular mientras camina.** Por eso es web app con GPS en vivo.
- **"Tranquila" antes que "segura".** Lo tranquilo se calcula con datos abiertos. Lo seguro no tiene datos
  confiables por calle, y prometerlo sin datos sería engañoso.
- **v1 con ambos modos.** El modo bici es una opción más, no algo fijo.
- **BRouter en vez de OpenRouteService.** No pide cuenta ni clave, y su perfil propio decide qué calles prefiere,
  en vez de solo puntuar rutas después.
- **Nada fijo.** Partida, término, duración y Bike Itaú se eligen en cada paseo. Los lugares guardados son atajos.
- **Repo público `paseos`.** Lo exige GitHub Pages gratis. Nada privado va al repo.
- **La app explica, no solo puntúa.** Bastián no conoce Santiago: cada ruta debe decir por qué es tranquila y qué
  evita, sin inventar lo que los datos no dicen.
- **Navegación dentro de la app + GPX, sin Google Maps.** Google Maps recalcula su propio camino y se pierde la ruta
  tranquila; Bastián prefiere apps abiertas y sin anuncios.
- **Plazas desde un archivo guardado, no en vivo.** El servicio de consultas a OSM (Overpass) se cae seguido.
