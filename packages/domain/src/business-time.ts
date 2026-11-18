// Offset fixo: o Brasil não tem horário de verão desde 2019. Feriados não são considerados.

const OFFSET_MS = -3 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 18;
export const BUSINESS_MINUTES_PER_DAY = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60;

// Date deslocado: os métodos getUTC* devolvem a data/hora de Brasília.
function toLocal(date: Date): Date {
  return new Date(date.getTime() + OFFSET_MS);
}

function fromLocal(local: Date): Date {
  return new Date(local.getTime() - OFFSET_MS);
}

function isWeekend(local: Date): boolean {
  const day = local.getUTCDay();
  return day === 0 || day === 6;
}

function atLocalHour(local: Date, hour: number): Date {
  const d = new Date(local);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

export function isBusinessTime(date: Date): boolean {
  const local = toLocal(date);
  if (isWeekend(local)) return false;
  const hour = local.getUTCHours();
  return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
}

export function nextBusinessStart(date: Date): Date {
  let local = toLocal(date);

  if (!isWeekend(local)) {
    const hour = local.getUTCHours();
    if (hour < BUSINESS_START_HOUR) return fromLocal(atLocalHour(local, BUSINESS_START_HOUR));
    if (hour < BUSINESS_END_HOUR) return date;
  }

  do {
    local = atLocalHour(local, BUSINESS_START_HOUR);
    local.setUTCDate(local.getUTCDate() + 1);
  } while (isWeekend(local));

  return fromLocal(local);
}

export function addBusinessMinutes(start: Date, minutes: number): Date {
  let cursor = nextBusinessStart(start);
  // NaN ou negativo viram 0: com NaN o laço abaixo nunca terminaria.
  let remaining = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;

  for (;;) {
    const endOfDay = fromLocal(atLocalHour(toLocal(cursor), BUSINESS_END_HOUR));
    const available = (endOfDay.getTime() - cursor.getTime()) / MINUTE_MS;

    if (remaining <= available) {
      return new Date(cursor.getTime() + remaining * MINUTE_MS);
    }

    remaining -= available;
    cursor = nextBusinessStart(endOfDay);
  }
}

// 1 dia útil = um expediente completo (10 h úteis).
export function addBusinessDays(start: Date, days: number): Date {
  return addBusinessMinutes(start, days * BUSINESS_MINUTES_PER_DAY);
}
