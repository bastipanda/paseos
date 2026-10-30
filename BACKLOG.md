# Backlog — Paseos

## Pendiente acordado
- Probar en terreno la v1.1 y la v1.2: voz de la guía, ir a una plaza, GPX en OsmAnd, estilo Noche de verdad de
  noche, "Pasar por…", calorías, aviso de clima y marcar lo caminado en el modo explorar.
- Calibrar el largo del paso (Ajustes) y anotar aquí el valor real.
- Regenerar los datos cada algunos meses: `node scripts/plazas.mjs` y `node scripts/lugares.mjs`.
  Última vez: plazas 2026-10-27; lugares interesantes, comercio y servicios 2026-10-30.

## Por verificar
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
- Historial de paseos hechos con fecha (hoy solo se guardan las calles conocidas, sin fecha).
- Sombra para el verano: no hay datos de sombra confiables en OSM para Santiago (por verificar).

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
