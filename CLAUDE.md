# Paseos

App personal que arma rutas a medida para salir a caminar o pedalear en Santiago.
Uso propio de Bastián, no comercial. Se usa en el celular mientras camina.

## Estado
v1 publicada y probada en terreno el 2026-10-27. v1.1 (plazas, explicaciones, guía giro a giro, GPX) publicada el
2026-10-27. v1.2 construida el 2026-10-30 (estilos, "Pasar por…", calorías, clima, subidas, explorar, agua y baños);
falta probar ambas en terreno.

## Qué hace
- **Partida y término libres:** cada uno puede ser la ubicación GPS, un lugar guardado o un punto del mapa.
  Si son el mismo punto, la ruta es circular.
- **Duración:** mínimo y/o máximo en pasos, minutos, kilómetros o calorías (con el peso). Se puede dejar uno vacío.
- **Estilo:** Tranquilo, Con vida o Noche (ver "Definiciones"). Opción de evitar subidas.
- **Pasar por… (opcional):** lugares interesantes, cafés y tiendas, plazas. Los puntos intermedios se mueven a esos
  lugares reales y las opciones que pasan por más de ellos suben en el orden.
- **Explorar (opcional):** prefiere calles que Bastián no marcó como conocidas. Se marca a mano: al terminar un
  paseo (solo lo caminado), con "Ya conozco esta ruta" o tocando zonas en el mapa (Lugares).
- **Clima y aire** antes de salir (Open-Meteo), con avisos de calor, lluvia y MP2,5.
- **Bebederos y baños** cerca de la ruta, en el mapa y en la explicación.
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
- **Qué quiere decir Bastián con "tranquila":** caminar sin miedo a que le roben. Muchas veces eso significa calles
  con gente e iluminadas, no calles vacías. Por eso hay tres **estilos** (2026-10-30), cada uno con su perfil:
  - **Tranquilo** (`paseo-tranquilo.brf`): poco ruido y verde. Pasajes, calles residenciales, parques y senderos.
  - **Con vida** (`paseo-vida.brf`): calles con gente y comercio. Veredas de avenidas, paseos peatonales.
  - **Noche** (`paseo-noche.brf`): iluminado y transitado a cualquier hora. Evita callejones, pasajes de servicio,
    senderos, parques oscuros y escaleras. Solo ~30 % de las calles de OSM dice si está iluminada.
  Ninguno usa datos de delitos (no existen por calle): son aproximaciones con OSM y hay que decirlo.
- **Bike-friendly (en bici):** prefiere ciclovías y calles de poco tráfico. Evita avenidas sin ciclovía y calles
  peatonales o con mucha gente. **No** se trata de reducir virajes. OSM no mide flujo de gente, así que se aproxima
  con el tipo de calle (por ejemplo, `highway=pedestrian` o una avenida sin ciclovía).
- **Conversiones:** pasos = metros ÷ largo del paso (0,75 m por defecto), minutos = metros ÷ velocidad
  (4,5 km/h por defecto) y kcal = MET(velocidad) × peso × horas, con MET aproximados del Compendio de Actividades
  Físicas (3,0 a 4 km/h; 3,8 a 5 km/h). Estimación gruesa (±20-30 %), sin considerar subidas.

## Arquitectura
- **Web app estática:** HTML, CSS y JavaScript sin compilación y sin servidor propio.
- **Mapa:** Leaflet con teselas de OSM, con la atribución "© OpenStreetMap" visible.
- **Rutas a pie y en bici:** el servidor público de BRouter (`brouter.de`), que no pide clave. La app sube perfiles
  propios (`perfiles/*.brf`): uno por estilo a pie, uno en bici y uno "corto" para comparar. "Evitar subidas" se
  pide con `profile:evitar_subidas=1` en la consulta y además resta puntos por metro subido al ordenar.
- **Largo de la ruta:** BRouter no recibe un largo objetivo, así que la app agrega puntos intermedios para
  alargar el recorrido. Genera varias candidatas, descarta las que no cumplen la duración y ordena el resto por
  qué tan tranquilas son (con las etiquetas de calle que devuelve BRouter).
- **Giros:** BRouter los entrega con `timode=2` en la consulta. La app recalcula el ángulo con la geometría (por si
  se recortó un espolón) y arma el texto ella misma.
- **Comparación:** un tercer perfil, `paseo-corto.brf`, da el camino más corto con las mismas etiquetas de calle.
- **Datos de lugares (`datos/`):** generados desde OSM con `node scripts/plazas.mjs` (plazas) y
  `node scripts/lugares.mjs` (lugares interesantes, comercio por cuadro de ~100 m, bebederos y baños). Se regeneran
  cada algunos meses; la app nunca consulta Overpass en vivo. Los lugares con artículo en Wikipedia muestran su
  resumen al tocarlos (API pública de Wikipedia).
- **Clima y aire:** Open-Meteo (gratis, sin clave). MP2,5 con las categorías del Ministerio del Medio Ambiente
  (bueno ≤50, regular 51-79, alerta 80-109, preemergencia 110-169, emergencia ≥170), aunque esas usan promedio 24 h.
- **Explorar:** cuadros de ~50 m marcados como conocidos, guardados en el navegador e incluidos en el respaldo.
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
- 2026-10-30: 21.658 locales comerciales en Santiago (8.741 cuadros), 402 bebederos y baños. En Providencia-Ñuñoa
  solo el 31 % de las calles tiene etiqueta de iluminación. BRouter entiende `lit`, `footway=sidewalk` y
  `profile:evitar_subidas=1`. Open-Meteo responde con `access-control-allow-origin: *`.
- Alternativas si BRouter falla: OpenRouteService (2.000 rutas al día gratis, pide clave; "green" y "quiet" eran solo
  para Alemania) o GraphHopper (500 créditos al día, no comercial).

## Secretos
La v1 no usa claves. Si algún día se agrega un servicio con clave, va en el navegador o en `.env`, nunca en el repo.

## Archivos
- `index.html`, `css/estilos.css`: la pantalla. `js/app.js` conecta todo.
- `js/generador.js`: arma y ordena las opciones. `js/brouter.js`: habla con BRouter.
- `js/tranquilidad.js`: clasifica calles. `js/geo.js`: cálculos de distancia. `js/duracion.js`: pasos/min/km.
- `js/bikeitau.js`: estaciones. `js/almacen.js`: lugares y ajustes en el navegador. `js/seguimiento.js`: GPS.
- `js/plazas.js`: lugares con punto. `js/datos.js`: carga `datos/`. `js/comercio.js`. `js/explorar.js`.
- `js/explicar.js`: textos de "por qué". `js/guia.js`: giros y voz. `js/gpx.js`. `js/clima.js`.
- `perfiles/*.brf`: qué calles prefiere BRouter. `datos/*.json` + `scripts/*.mjs`. `tests/`: pruebas.

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
- **Estilos en vez de una sola "tranquila"** (2026-10-30). Ver "Definiciones".
- **Explorar se registra a mano.** Bastián revisa muchas opciones antes de elegir: solo cuenta como conocido lo que
  él marca (un paseo hecho, una ruta o una zona tocada en el mapa).
