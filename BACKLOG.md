# Backlog — Paseos

## Pendiente acordado
- Probar la v1 en terreno con el celular: GPS, seguimiento, pantalla encendida y modo Bike Itaú.
- Calibrar el largo del paso (Ajustes) y anotar aquí el valor real.

## Por verificar
- Qué tan bien calza el largo de las rutas con la duración pedida en distintas zonas de Santiago.
  Probado en Providencia y Ñuñoa el 2026-10-27: circular 8.000–10.000 pasos, A→B 60–75 min y Bike Itaú 4.000–6.000.
- Si los puntos intermedios caen en zonas raras (cerros, autopistas) y dan rutas feas.
- Precisión del GPS del celular entre edificios: el aviso de "fuera de la ruta" salta a los 40 m.
- Si el servidor de BRouter borra los perfiles subidos: la app los vuelve a subir sola, falta verlo pasar.
- Reglas de uso del servidor público de BRouter (su README no las publica).
- Datos de delitos por calle o cuadra en Chile: ¿existen y son públicos? Lo que se conoce es por comuna.
- Largo real del paso de Bastián, para calibrar la conversión de pasos a metros.

## Ideas sin decidir
- Modo "segura", si aparecen datos confiables por calle.
- Exportar la ruta como GPX para abrirla en Organic Maps u otra app de navegación.
- Indicaciones por voz mientras se camina.
- Historial de paseos hechos (si se hace, pensar el respaldo).

## Descartadas
- **Minimizar virajes en bici:** no era la necesidad. Lo que importa es evitar calles sin ciclovía o con mucha
  gente (ver "Bike-friendly" en `CLAUDE.md`).
- **Hacerla pública o venderla:** es para uso propio. Lo que vale son los ajustes a medida.
- **Estación casa fija:** la estación de llegada se elige según el término de cada paseo.
- **OpenRouteService para la v1:** pide cuenta y clave; BRouter hace lo mismo sin ellas (queda como plan B).
