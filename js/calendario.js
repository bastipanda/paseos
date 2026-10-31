// Crea un evento que se repite cada semana en el calendario del celular (archivo .ics, el formato estándar que
// entienden el calendario del iPhone, Google Calendar y Outlook). Así el celular te recuerda salir a caminar sin que
// la app necesite un servidor que mande notificaciones.

export const DIAS_ICS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const URL_APP = 'https://bastipanda.github.io/paseos/';

const dos = (n) => String(n).padStart(2, '0');
// Hora "flotante" (sin zona): el calendario la usa tal cual en la hora del celular.
const fechaLocal = (d) => `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}T${dos(d.getHours())}${dos(d.getMinutes())}00`;
const fechaUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Primer día desde `desde` (incluido, si todavía no pasa la hora) que cae en alguno de los `dias` (índices 0 = lunes).
export function primeraFecha(dias, hora, desde = new Date()) {
  const [hh, mm] = hora.split(':').map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(desde);
    d.setDate(desde.getDate() + i);
    d.setHours(hh, mm, 0, 0);
    if (dias.includes((d.getDay() + 6) % 7) && d > desde) return d;
  }
  return null;
}

// `dias`: índices de 0 (lunes) a 6 (domingo). `hora`: "19:30". `minutos`: duración del evento.
export function crearIcs({ dias, hora, minutos, meta = null, desde = new Date() }) {
  if (!dias.length) throw new Error('Elige al menos un día.');
  const inicio = primeraFecha(dias, hora, desde);
  const fin = new Date(inicio.getTime() + minutos * 60000);
  const descripcion = `Abre Paseos y toca "Salir ahora": ${URL_APP}${meta ? `\\nTu meta: ${meta} min a la semana.` : ''}`;
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//paseos//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:paseos-${desde.getTime()}@bastipanda.github.io`,
    `DTSTAMP:${fechaUtc(desde)}`,
    `DTSTART:${fechaLocal(inicio)}`,
    `DTEND:${fechaLocal(fin)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${[...dias].sort().map((i) => DIAS_ICS[i]).join(',')}`,
    'SUMMARY:Salir a caminar',
    `DESCRIPTION:${descripcion}`,
    `URL:${URL_APP}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Salir a caminar',
    'TRIGGER:-PT10M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // El formato pide terminar cada línea con CRLF.
  return `${lineas.join('\r\n')}\r\n`;
}
