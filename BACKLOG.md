# Backlog — Paseos

## Pendiente acordado
- **v1.4 "Interfaz limpia"** (decidido 2026-10-31). Motivo: la app creció feature por feature, todo tiene el mismo
  peso visual y el panel tapa el mapa. Bastián **no usa la voz**: mira el mapa un segundo y se orienta. Tres
  sesiones, cada una probada y publicada antes de seguir:
  1. **Barra de pestañas abajo** (Hoy, Armar, Dex, Más; en "Más": Historial, Lugares, Ajustes) en vez de los
     botones flotantes. **Hoy y Dex como páginas propias, sin mapa detrás.**
  2. **Pantallas con mapa** (Armar, Resultados, Paseo). Regla de Bastián: el mapa nunca debe quedar tapado sin
     forma de verlo completo; el panel se pliega del todo (queda una franja delgada) y la barra se esconde.
     Armar: a la vista solo partida, término y duración; el resto en "Más opciones". Resultados: tarjeta con lo
     clave (pasos, minutos, % tranquila, subida); "por qué", comparación y seguridad plegados. Paseo: franja arriba
     con flecha y distancia, barra delgada abajo con lo que falta, lo demás en un menú. **Voz apagada por defecto**
     (queda como opción). **Se elimina el modo bolsillo.** Los intervalos avisan con color, no con voz.
  3. **Santiagodex como álbum:** cartas con un color por tipo; las capturadas con foto de Wikipedia (con el crédito
     de la foto); **siluetas con "?"** para lo no encontrado (tipo y distancia), con un interruptor en Ajustes para
     ver los nombres; comunas como "regiones" con insignias al 25, 50 y 100 %; ficha a pantalla completa con foto,
     historia e "Ir a capturarlo". **Foto propia opcional** al capturar (no es requisito para capturar): se guarda
     achicada (~40 KB) en el navegador (IndexedDB) y reemplaza la de Wikipedia en la carta; va en el respaldo.
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
- **Minimizar virajes en bici:** no era la necesidad. Lo que importa es evitar calles sin ciclovía o con mucha
  gente (ver "Bike-friendly" en `CLAUDE.md`).
- **Hacerla pública o venderla:** es para uso propio. Lo que vale son los ajustes a medida.
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
- **Foto propia obligatoria para capturar:** agregaría un paso cada vez; capturar sigue siendo automático y la foto
  es opcional (2026-10-31).
