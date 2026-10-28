# Backlog — Paseos

## Pendiente acordado
**v1.1 (decidida 2026-10-27, tras probar la v1 en terreno).** Orden sugerido: 5 → 4 → 3 → 1 → 2.
1. **Guía giro a giro en la app:** durante el seguimiento, mostrar "En 80 m, dobla a la derecha" con las
   indicaciones de giro que entrega BRouter (`voicehints`), y voz opcional con la del navegador (gratis).
   Ojo: al recortar espolones y al unir tramos cambian los índices de la ruta; hay que reubicar las indicaciones.
2. **Descargar la ruta como GPX** (respaldo de lo anterior): un botón que baja el archivo para abrirlo en OsmAnd u
   Organic Maps (gratis, sin anuncios, código abierto), con instrucciones cortas en la app. Sin Google Maps.
3. **Explicar las rutas:**
   - Tocar un tramo del mapa y ver qué es ("Avenida principal, ruido alto") y por qué tiene ese color.
   - Un resumen en palabras por opción: plazas y parques por los que pasa, tipos de calle, y por qué hay tramos rojos.
   - Comparar con la ruta más corta: cuánto se desvía y qué evita.
   - Decir claro lo que la app no sabe: ambiente, belleza, comercio, gente, seguridad.
4. **Ir a una plaza y volver:** nueva opción de término. La app elige una plaza a la distancia justa para la duración
   pedida, vuelve por otras calles si se puede y permite pedir "otra plaza". Incluye plazas, plazoletas, parques y
   plazas de juegos.
5. **Lista de plazas y parques como archivo en el repo** (`datos/plazas.json`), generada desde OSM con un script y
   actualizada cada algunos meses. Sirve para el punto 4 y para nombrar lugares en el punto 3.
- Calibrar el largo del paso (Ajustes) y anotar aquí el valor real.

## Por verificar
- Tabla exacta de códigos de giro de BRouter. Probado el 2026-10-27: con `timode=2`, cada indicación viene como
  `[índice del punto, código, salida de rotonda, distancia a la siguiente, ángulo]`.
- Si OsmAnd guía con voz siguiendo un GPX importado, y si Organic Maps lo muestra. Según lo conocido, sí.
- Si BRouter entrega nombres de calles (para decir "evita Av. Irarrázaval" en vez de "evita una avenida").
- De dónde sacar las plazas para el script: Overpass (consultas a OSM) falló en 3 servidores el 2026-10-27
  (error 502 y sin respuesta). Reintentar otro día o usar un extracto de OSM descargado.
- Qué tan bien calza el largo de las rutas con la duración pedida en distintas zonas de Santiago.
  Probado en Providencia y Ñuñoa el 2026-10-27: circular 8.000–10.000 pasos, A→B 60–75 min y Bike Itaú 4.000–6.000.
- Si los puntos intermedios caen en zonas raras (cerros, autopistas) y dan rutas feas.
- Precisión del GPS del celular entre edificios: el aviso de "fuera de la ruta" salta a los 40 m.
- Si el servidor de BRouter borra los perfiles subidos: la app los vuelve a subir sola, falta verlo pasar.
- Reglas de uso del servidor público de BRouter (su README no las publica).
- Datos de delitos por calle o cuadra en Chile: ¿existen y son públicos? Lo que se conoce es por comuna.

## Ideas sin decidir
- **Que la app sepa lo "humano" de una calle** (pedido 2026-10-27, conversarlo en una sesión propia): ambiente,
  belleza, comercio, cuánta gente pasa y seguridad. Es lo que más le importa a Bastián, que no conoce Santiago.
  Pistas a investigar, ninguna verificada todavía:
  - Comercio, cafés y vida de barrio: los locales registrados en OSM (qué tan completos están en Santiago, por ver).
  - Belleza y patrimonio: árboles y edificios históricos en OSM; monumentos y zonas típicas del Consejo de
    Monumentos Nacionales (¿datos abiertos?); arbolado urbano municipal (¿datos abiertos?).
  - Gente: aproximarla por densidad de locales, paraderos y estaciones de metro. Los datos de "horas concurridas" de
    Google no son abiertos.
  - Seguridad: estadísticas del CEAD (por comuna; ¿hay por cuadrante?) e iluminación (`lit=yes` en OSM) para paseos
    de noche. Cuidado con estigmatizar barrios con datos gruesos.
  - Lo propio de Bastián: calificar tramos o zonas después de cada paseo para que la app aprenda su gusto (datos que
    no se regeneran: respaldo).
  - Resúmenes escritos por IA: costarían plata (API), choca con costo cero.
- Modo "segura", si aparecen datos confiables por calle.
- A la plaza a pie y vuelta en Bike Itaú (combinar los puntos 4 y el modo bici).
- Historial de paseos hechos (si se hace, pensar el respaldo).

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
