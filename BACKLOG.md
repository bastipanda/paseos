# Backlog — Paseos

## Pendiente acordado
- **Probar en terreno la v1.8 "Pasaporte"** (rediseño decidido con maquetas y construido el 2026-11-01; lo decidido
  está en `CLAUDE.md`). Probar: que todo se lea bien al sol y caminando (sobre todo la franja del paseo y los números
  en letra de máquina); Hoy con los días timbrados; "Destino sellado"; el Pasaporte por páginas de comuna con sus
  visados; sacar una foto en el paseo y desde la ficha y ver el momento "¡Timbrado!"; la ficha (campos, frase de la
  placa, grupos plegables); el modo oscuro si lo usas; la postal nueva; el ícono nuevo al agregarla a la pantalla de
  inicio (el iPhone puede guardar el ícono viejo: borrar el acceso y volver a agregarlo).
  - Del diseño quedó fuera, para después: "3 timbres nuevos a menos de 1 km" en Hoy (pide el GPS al abrir), una
    bienvenida de tres pantallas la primera vez (propósito, meta y permiso del GPS), timbres especiales o hitos (ojo
    con "Puntos, niveles y rankings" en Descartadas), el nombre definitivo (ni "Santiagodex" ni "Pasaporte
    Patrimonial", que es el del Estado) y trazar la cordillera con alturas reales en vez de a mano.
- **Probar en terreno la v1.7 "Una razón para ir"** (pedida y decidida el 2026-11-01, "sí a todo"; construida el
  mismo día): la ficha de la Dex en cuatro grupos (Qué hay, Su historia, Dónde estás, Tú y este lugar). Fichas con
  algo propio: de 570 a **2.705 de 3.236 (84 %)**; 531 quedan solo con lo general (altura, calles, referencias,
  metro), 386 de ellas con el nombre del barrio. Por fuente: especies de iNaturalist 2.048; barrio 2.264 (489 con
  artículo); OSM (placa, obra, horario 178, nombre antiguo 51…) 930; qué hay 833; monumento o zona típica del CMN 424
  (contornos y, si el monumento es solo un punto, a menos de 60 m); artículo de Wikipedia 413; foto de Commons 336
  (nombre del archivo con el nombre completo del lugar; sin letreros ni paraderos); "su nombre coincide con…" 315
  (persona chilena o con artículo en 15+ Wikipedias); árboles con especie 237; mención subrayada 218.
  - **IA que solo subraya:** `menciones.mjs` juntó 1.093 frases de 484 lugares; Claude Code eligió una en 218 (las
    demás eran de otro lugar con el mismo nombre o no decían nada del lugar) y `--verificar` confirmó las 218 letra
    por letra. Los decretos del CMN no se subrayaron: son escaneos sin texto.
- **Probar en terreno la v1.6 "Conocer y ubicarse"** (pedida, decidida y construida el 2026-11-01): la rosa y el
  punto cardinal al caminar, el Contexto y Tu nota en fichas de distintos tipos. Lo que dio la medición
  (`node scripts/contexto.mjs`): historia de Wikipedia de 264 a 413 lugares (77 por Wikidata, 35 por mismo nombre,
  37 por nombre parecido; 22 enlaces de Wikidata descartados por apuntar a personas); placa en 102, obra y año en
  202, descripción en 91; "Lleva el nombre de…" en solo 1 (OSM casi no lo anota) y patrimonio en 0 (la etiqueta no
  se usa acá). Todas las fichas visibles muestran metro cercano y lugares de la Dex a 300 m.
  - **Contexto para todos los lugares de la Dex.** Bastián quería historia para todos, pero solo 265 de 3.236
    (8 %) tienen artículo de Wikipedia y la mayoría son plazas de barrio sin historia escrita: prometerla para todos
    obligaría a inventar. En su lugar, una sección "Contexto" en capas, solo con datos verificables: (1) para todos,
    tipo, comuna, tamaño y qué hay cerca; si OSM lo trae, monumento nacional, placa, artista o año; (2) "Lleva el
    nombre de…" solo si OSM dice a quién homenajea (no adivinar: hay homónimos); (3) más artículos de Wikipedia
    buscados por ubicación y nombre con un script; (4) **Tu nota** propia en cada ficha (va en el respaldo).
    Primero se mide cuánto se gana con 2 y 3. Descartado: que Claude o una IA escriba las historias (inventaría en
    lugares poco conocidos; la IA en la app además cuesta).
  - **Aprender a ubicarse** (interruptor en Ajustes): rosa de los vientos chica en el mapa con "⛰ Cordillera" al
    oriente (la regla de Santiago: la cordillera siempre al oriente) y el punto cardinal bajo cada indicación del
    paseo ("hacia el oriente"). Descartado: girar el mapa con la brújula del celular (permiso especial en iPhone y
    cambia todo el mapa). Para después, si hace falta: "Sales hacia el norte…" en Resultados y la dirección de la
    Gran Torre o el San Cristóbal.
- **Probar en terreno la v1.5 "Más opciones y Mis barrios"** (pedida, decidida y construida el 2026-10-31).
  Bastián se queda corto de opciones y quiere pasear hacia los sectores donde se siente cómodo ("cuicos"), no hacia
  el otro lado. Probar: elegir comunas en Ajustes, "Solo por mis barrios" con Salir ahora y con una plaza, el % por
  tus barrios de la tarjeta y "Más ›" en la última opción.
  - **Buscar más:** en la última opción, la flecha › busca más con lo mismo que se pidió: direcciones giradas,
    lugares (plazas, trámites, estaciones) que no se mostraron y otras estaciones Bike Itaú. Se botan las parecidas
    a las ya vistas y lo nuevo se suma al final. Solo cuando se toca (BRouter es público: pedir poco). No aplica a
    Sorpresa ni a favoritas.
  - **Mis barrios** en vez de "cuico": Bastián marca en Ajustes las comunas donde le gusta caminar y activa "Solo
    por mis barrios" en Más opciones de Armar ("Salir ahora" usa lo último elegido). Los puntos intermedios y los
    destinos quedan siempre dentro; el camino entre ellos puede cruzar un poco y la tarjeta dice cuánto va por tus
    barrios. No se usa un dato de "barrio cuico": no hay uno confiable por calle, las comunas son mezcladas, y usar
    ingreso como señal de seguridad tiene el mismo problema que los delitos por comuna (ver Decisiones en `CLAUDE.md`).
    Si las comunas quedan gruesas, después se puede dibujar zonas propias en el mapa.
- **Probar en terreno la v1.4 "Interfaz limpia"** (decidida y publicada el 2026-10-31, en tres sesiones: barra de
  pestañas, pantallas con mapa y Santiagodex como álbum; lo decidido está en `CLAUDE.md`). Probar: pestañas y "Ver
  en el mapa", plegar el panel, la franja con flecha del paseo, intervalos por color, el aviso "Llegaste a X: sácale
  una foto", sacar y subir fotos (cámara y galería), "falta la foto", el álbum, la ficha y el respaldo con fotos.
  Detalles que se decidieron al construir la sesión 3 (2026-10-31), por si hay que cambiarlos:
  - **Buscador por nombre** en la Dex (también por número, "#344"): sin él no se encuentra el lugar de una foto
    sacada sin la app. Al buscar se ven los nombres aunque estén escondidos.
  - Las cartas **vistas muestran el nombre** (como en Pokémon: lo viste, pero no lo tienes); solo lo no visto es
    silueta con "?". En la ficha de algo no visto tampoco se muestra la foto de Wikipedia (delataría el lugar).
  - Las **insignias** de cada región cuentan los lugares capturados (con foto) de esa comuna, no las calles
    caminadas (eso sigue en "Tu mapa").
  - "Ya lo conocía" se reemplazó por subir una foto; "Quitar la captura" borra la foto y la llegada.
- **Probar en terreno la v1.3** (construida el 2026-10-30): Salir ahora, Sorpresa, meta y semanas, historial,
  resumen y postal, favoritas, trámites, metro y "Llévame al metro", metrónomo, intervalos, capturas de la
  Santiagodex y el evento del calendario.
- Actualizar `datos/delitos.json` cuando el CEAD publique el año 2026 completo (se copia a mano del portal).
- Regenerar `datos/metro.json` cuando abra la Línea 7 (`node scripts/lugares.mjs metro`).
- **v1.3 "Salir más y conocer Santiago"** (decidido 2026-10-30, construido el mismo día). Meta: que Bastián camine
  más y deje el sedentarismo. Bastián usa **iPhone** (la web no puede hacerlo vibrar).
  - **Hoy** (pantalla de inicio): "Salir ahora" de 15/30/45/60 min desde el GPS, meta semanal en **minutos** (la
    app la pregunta la primera vez; la OMS recomienda 150-300 min), semanas cumplidas en vez de racha diaria,
    proponer subir la meta 10 % al cumplir (o mantener), mejor hora para salir hoy, rutas favoritas y recordatorio
    de respaldo una vez al mes.
  - **Historial** automático de cada paseo con seguimiento (fecha, minutos en movimiento, km, kcal, recorrido
    simplificado) y paseos agregados a mano. Es un dato que no se regenera: va en el respaldo.
  - **Resumen al terminar** y **postal** para compartir (imagen con el recorrido, sin mapa de fondo).
  - **Agendar en el calendario:** archivo `.ics` con repetición semanal (días y hora a elección).
  - **En el paseo:** modo bolsillo (pantalla negra, solo voz, se sale manteniendo apretado), ritmo en km/h y
    minutos a paso enérgico (≥ 5 km/h), metrónomo de pasos por minuto e intervalos 3 min rápido / 3 min suave.
  - **Trámites:** ir al súper, farmacia, panadería, feria, cajero o ferretería que calce con la duración y volver.
  - **Metro:** estaciones como partida o término, término "la estación que calce", **Llévame al metro** (estación
    más cercana y ruta hasta ella durante el paseo), **aviso de luz del día** (puesta de sol y cierre del metro,
    ~23:00 según prensa, por confirmar en metro.cl) y **delitos por comuna** del CEAD, solo informativo y con sus
    límites explicados (comuna completa, población flotante).
  - **Subidas:** Evitar / Da igual / Buscar. Las calorías suman la subida (ecuación de caminata del ACSM).
  - **Santiagodex:** lugares interesantes, plazas con nombre, parques y cerros con número y tipo. "Visto" si pasas
    cerca; "capturado" si llegas (≤ ~40 m o dentro del lugar) en un paseo con seguimiento, o si lo marcas a mano
    porque ya lo conocías. Avance por tipo y por comuna, **Tu mapa** (% caminado por comuna) y **Sorpréndeme**
    (paseo misterio hacia algo que no tienes; el destino se revela al llegar).
- Probar en terreno la v1.1 y la v1.2: voz de la guía, ir a una plaza, GPX en OsmAnd, estilo Noche de verdad de
  noche, "Pasar por…", calorías, aviso de clima y marcar lo caminado en el modo explorar.
- Calibrar el largo del paso (Ajustes) y anotar aquí el valor real.
- Regenerar los datos cada algunos meses: `node scripts/plazas.mjs`, `node scripts/lugares.mjs` y
  `node scripts/comunas.mjs`. Última vez: plazas, lugares, trámites y metro el 2026-10-30; comunas el 2026-10-31
  (43 comunas, ~230 mil cuadros con calles; Overpass falló en varios pedazos y el script reintentó solo).

## Por verificar
- **v1.8:** si el golpe del timbre suena en el iPhone (Safari puede no dejar sonar sin un toque previo, y con el
  interruptor de silencio no suena); si las letras propias cargan bien con 4G (≈110 KB, una sola vez); si la textura
  de tinta de los timbres (filtro SVG) pone lenta la página con muchas casillas; si los timbres chicos de la esquina
  se distinguen o conviene agrandarlos; si el mapa desteñido se lee bien al sol; si "Destino sellado" se entiende sin
  explicación.
- **v1.7:** si la ficha con cuatro grupos se lee bien en el iPhone o es muy larga (¿plegar Dónde estás?); cuánto
  tarda en abrir la primera ficha con 4G (baja ~900 KB de datos sin comprimir: entorno, especies, contexto,
  menciones; GitHub Pages los comprime); si las menciones elegidas se sienten útiles o algunas son solo ubicación;
  si "su nombre coincide con…" acierta (puede haber homónimos chilenos); si las fotos de Commons son del lugar; si
  "Junto a" y los lados de las calles calzan con lo que se ve al llegar.
- **v1.6:** si "Hacia el oriente (la cordillera al frente)" se lee de un vistazo al caminar o conviene más corto; si la
  rosa estorba en la esquina del mapa; si las historias por "nombre parecido" calzan (la ficha dice de qué artículo
  vienen); si vale la pena completar a mano en OSM a quién homenajean las plazas (name:etymology:wikidata).
- **v1.5:** si "Más ›" entrega opciones que se sienten distintas (y no la misma vuelta movida unas cuadras); si con
  "Solo por mis barrios" quedan suficientes opciones al partir cerca del borde de una comuna; si las comunas son un
  límite útil o hace falta dibujar zonas propias en el mapa.
- **En el iPhone (v1.4, sesión 3):** si "Sacar foto" abre la cámara directo y "De la galería" la fototeca (en Safari y
  en la app de la pantalla de inicio); si al volver de la cámara el paseo sigue registrando el GPS; si las fotos
  quedan derechas (no giradas); si el respaldo con fotos se descarga bien; y si Safari borra las fotos (IndexedDB)
  cuando la app no se abre en varios días (Apple lo hace con las páginas web, no con las de la pantalla de inicio).
- **Caché al publicar:** GitHub Pages deja que el celular guarde cada archivo 10 minutos. Si justo después de
  publicar la app queda a medio actualizar (por ejemplo, las pestañas no responden), esperar 10 minutos y volver a
  abrirla. Si pasa seguido, se puede agregar un número de versión a los archivos.
- **En el iPhone (v1.4, sesión 2):** si la flecha de la franja se entiende de un vistazo al caminar, si el naranjo
  de los intervalos se nota al sol y si cuesta abrir el menú del paseo con una mano.
- **En el iPhone (v1.4, sesión 1):** que la barra de pestañas no choque con la rayita de abajo (en Safari y en la app
  de la pantalla de inicio), que "Ver en el mapa" y "Volver" respondan bien al dedo y que tocar un punto de la Dex en
  el mapa abra su ficha (los puntos son chicos).
- **En el iPhone (v1.3):** si el evento `.ics` abre el calendario con "Añadir todo" (en Safari y en la app de la
  pantalla de inicio); si el metrónomo suena con el interruptor de silencio activado; si la pantalla se mantiene
  encendida en la app de la pantalla de inicio; si la postal se comparte por WhatsApp; si el iPhone deja sacar la
  foto propia de la Santiagodex desde la web (cámara con `<input type="file" capture>`).
- Si el radio de captura de la Santiagodex funciona en la práctica (40 m; parques grandes hasta 200 m del centro).
- Si los minutos en movimiento del GPS se parecen a los de la pulsera (semáforos y esperas no cuentan).
- Qué tan bien calza el % por comuna de "Tu mapa" (cuadros de 50 m con calles caminables de OSM).
- Si la voz del navegador suena bien en el celular de Bastián y sigue hablando con la pantalla encendida.
- Si OsmAnd guía con voz siguiendo el GPX, y si Organic Maps lo muestra. Según lo conocido, sí.
- Si el menú de compartir del celular acepta el archivo GPX o hay que usar la descarga.
- Si el estilo Noche de verdad lleva por calles iluminadas y con gente: solo ~30 % de las calles tiene el dato de
  luz en OSM, el resto se estima por tipo de calle.
- Qué tan completos están los locales comerciales y los lugares interesantes de OSM en otras comunas.
- Si las calorías se parecen a las de un reloj o app de salud (la fórmula es una estimación gruesa).
- Si BRouter entrega nombres de calles (para decir "evita Av. Irarrázaval" en vez de "evita una avenida").
- Qué tan bien calza el largo de las rutas con la duración pedida en distintas zonas de Santiago.
  Probado en Providencia y Ñuñoa: circular 6.000–10.000 pasos, A→B 60–75 min, Bike Itaú 4.000–6.000, plaza.
- Si los puntos intermedios caen en zonas raras (cerros, autopistas) y dan rutas feas.
- Precisión del GPS del celular entre edificios: el aviso de "fuera de la ruta" salta a los 40 m.
- Si el servidor de BRouter borra los perfiles subidos: la app los vuelve a subir sola, falta verlo pasar.
- Reglas de uso del servidor público de BRouter (su README no las publica).
- Datos de delitos por calle o cuadra en Chile: ¿existen y son públicos? Lo que se conoce es por comuna.
  2026-10-30: el portal del CEAD (cead.minsegpublica.gob.cl) muestra casos por comuna en un formulario de consulta,
  sin descarga abierta documentada (CSV o Excel). Carabineros publica datos semanales en stop.carabineros.cl.

## Ideas sin decidir
- **Hacerla pública y postular a fondos** (futuro lejano; Bastián cambió de opinión el 2026-11-01). También algo
  social: amigos, ver sus estadísticas y timbres, ranking, concursos. Se nombraron el Fondart y el Fondo del Patrimonio
  Cultural, sin verificar si financian apps ni sus requisitos. Mientras tanto, no cerrar la puerta: nada de marcas
  ajenas y revisar las licencias de los datos (parte de iNaturalist es no comercial). Ojo: lo social necesita servidor
  y cuentas (choca con costo cero y sin claves), y un ranking de minutos puede desanimar a quien parte sedentario;
  preferir lo cooperativo. Reemplaza la descartada "Hacerla pública o venderla".
- **Después de la v1.7** (surgidas al construirla, 2026-11-01): "Pasar por… máquinas de ejercicio" en Armar (833
  lugares ya saben qué hay); cuándo florece cada árbol (jacarandá, ciruelo…) desde una fuente botánica verificable;
  marcar como "rincón" las 531 fichas sin nada propio (como los Pokémon comunes) en vez de sacarlas de la Dex.
- **Que la app sepa lo "humano" de una calle** (pedido 2026-10-27). Hecho en parte en la v1.2: estilos Con vida y
  Noche, comercio y lugares interesantes. Falta:
  - Belleza y patrimonio: monumentos y zonas típicas del Consejo de Monumentos Nacionales (¿datos abiertos?),
    arbolado urbano municipal (¿datos abiertos?), más lugares desde los artículos de Wikipedia con coordenadas.
  - Gente: sumar paraderos y estaciones de metro a la densidad de comercio.
  - Seguridad: estadísticas del CEAD (por comuna; ¿hay por cuadrante?). Cuidado con estigmatizar barrios.
  - Lo propio de Bastián: calificar tramos o zonas después de cada paseo para que la app aprenda su gusto (datos que
    no se regeneran: respaldo).
  - Resúmenes escritos por IA: costarían plata (API), choca con costo cero.
- A la plaza a pie y vuelta en Bike Itaú (combinar "Ir a una plaza" con el modo bici).
- Sombra para el verano: no hay datos de sombra confiables en OSM para Santiago (por verificar).
- **Pulsera Xiaomi Smart Band (vía la app Salud del iPhone)** — para después de probar la v1.3. Una web no puede
  leer Salud, pero un Atajo del iPhone sí, y puede abrir la app con los números. Serviría para calibrar el largo
  del paso (pasos de la pulsera ÷ distancia del GPS), medir la intensidad con el pulso y mostrar los pasos del día.
  Falta verificar qué datos escribe Mi Fitness en Salud y armar el Atajo a mano (no se puede probar desde el PC).

## Descartadas
- **Fuentes revisadas para la v1.7 que no sirven (2026-11-01):** catálogos municipales con la historia de cada plaza
  (no se encontró ninguno), Archivo Visual de Santiago (sin API ni ubicación), catastro del SII con el año de
  construcción (va por rol, sin coordenadas), Mapillary (pide cuenta y clave), Wikidata por cercanía (solo 30 fichas
  pobres calzan) y una capa abierta del crecimiento de Santiago por década (no se encontró).
- **Minimizar virajes en bici:** no era la necesidad. Lo que importa es evitar calles sin ciclovía o con mucha
  gente (ver "Bike-friendly" en `CLAUDE.md`).
- **Estación casa fija:** la estación de llegada se elige según el término de cada paseo.
- **OpenRouteService para la v1:** pide cuenta y clave; BRouter hace lo mismo sin ellas (queda como plan B).
- **Exportar a Google Maps:** en el celular solo acepta 3 puntos intermedios y entre ellos calcula su propio camino,
  así que se pierde la ruta tranquila. Además Bastián prefiere apps abiertas y sin anuncios.
- **Moovit:** es para transporte público; hasta donde se sabe no abre rutas propias.
- **Consultar plazas en vivo con Overpass:** se cae seguido; mejor un archivo guardado en el repo.
- **"Tranquila" = solo calles vacías:** para Bastián tranquilo es sin miedo a robos; a veces eso es con gente.
- **Contar como explorado lo que se busca:** Bastián revisa muchas opciones antes de elegir; solo cuenta lo marcado.
- **Contar pasos todo el día y registrar el peso en la app:** Bastián ya lo hace en otras apps, y una web no puede
  leer el podómetro ni funcionar cerrada.
- **Puntos, niveles y rankings:** la novedad se pasa rápido; conocer Santiago (Santiagodex) motiva más.
- **"Avisar a alguien" por WhatsApp:** Bastián no lo eligió entre las medidas de seguridad (2026-10-30).
- **Modo bolsillo y guía por voz como forma principal:** Bastián no usa la voz; mira el mapa un momento y se orienta
  (2026-10-31). La voz queda como opción apagada; el modo bolsillo se elimina en la v1.4.