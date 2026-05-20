'use strict';

const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

function getArgentinaDateInfo() {
  const now = new Date();
  const readable = new Intl.DateTimeFormat('es-AR', {
    timeZone: AR_TIMEZONE,
    weekday:  'long',
    year:     'numeric',
    month:    'long',
    day:      'numeric',
  }).format(now);

  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TIMEZONE,
  }).format(now);

  return { readable, isoDate };
}

module.exports = { getArgentinaDateInfo };
