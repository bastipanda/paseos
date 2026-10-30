# Backlog — Paseos

## Pendiente acordado
**v1.2 (decidida 2026-10-30), en este orden:**
1. Estilos de paseo: Tranquilo, Con vida y Noche (iluminado y transitado, sin callejones).
2. "Pasar por…": lugares interesantes, cafés y tiendas, plazas (puntos intermedios reales en vez de geométricos).
3. Calorías como cuarta unidad de duración (con el peso, solo en el celular).
4. Clima y calidad del aire antes de salir (Open-Meteo, gratis) y opción de evitar subidas.
5. Modo explorar con registro manual: marcar paseos hechos, rutas conocidas o zonas en el mapa.
6. Bebederos y baños cerca de la ruta.
- Probar la v1.1 en terreno: voz de la guía en el celular, ir a una plaza, explicaciones y abrir el GPX en OsmAnd.
- Calibrar el largo del paso (Ajustes) y anotar aquí el valor real.
- Regenerar `datos/plazas.json` cada algunos meses (`node scripts/plazas.mjs`). Última vez: 2026-10-27.

## Por verificar
- Si la voz del navegador suena bien en el celular de Bastián y sigue hablando con la pantalla encendida.
- Si OsmAnd guía con voz siguiendo el GPX, y si Organic Maps lo muestra. Según lo conocido, sí.
- Si el menú de compartir del celular acepta el archivo GPX o hay que usar la descarga.
- Si BRouter entrega nombres de calles (para decir "evita Av. Irarrázaval" en vez de "evita una avenida").
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
