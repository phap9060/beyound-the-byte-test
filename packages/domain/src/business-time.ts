/**
 * Horário comercial do service desk: segunda a sexta, das 8h às 18h,
 * no horário de Brasília.
 *
 * Decisões e simplificações (registradas no README):
 * - Fuso fixo UTC−3. O Brasil não tem horário de verão desde 2019, então um
 *   offset fixo é exato e dispensa uma biblioteca de fusos.
 * - Feriados não são considerados.
 * - "1 dia útil" equivale a 10 horas úteis (um expediente completo). Assim,
 *   "3 dias úteis" a partir de segunda às 10h vence quinta às 10h.
 */

const OFFSET_MS = -3 * 60 * 60 * 1000; // UTC−3 (America/Sao_Paulo)
const MINUTE_MS = 60 * 1000;

export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 18;
export const BUSINESS_MINUTES_PER_DAY = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60;

/**
 * "Relógio local" representado como um Date deslocado: os métodos getUTC*
 * desse objeto devolvem a data/hora de Brasília. Fica só dentro deste módulo.
 */
function toLocal(date: Date): Date {
  return new Date(date.getTime() + OFFSET_MS);
}

function fromLocal(local: Date): Date {
  return new Date(local.getTime() - OFFSET_MS);
}

function isWeekend(local: Date): boolean {
  const day = local.getUTCDay(); // 0 = domingo, 6 = sábado
  return day === 0 || day === 6;
}

/** Mesmo dia local, numa hora cheia. */
function atLocalHour(local: Date, hour: number): Date {
  const d = new Date(local);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

/** Está dentro do expediente (8h ≤ hora < 18h, em dia útil)? */
export function isBusinessTime(date: Date): boolean {
  const local = toLocal(date);
  if (isWeekend(local)) return false;
  const hour = local.getUTCHours();
  return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR;
}

/**
 * Se `date` está no expediente, devolve ela mesma. Senão, devolve a próxima
 * abertura do service desk (8h do próximo dia útil).
 */
export function nextBusinessStart(date: Date): Date {
  let local = toLocal(date);

  if (!isWeekend(local)) {
    const hour = local.getUTCHours();
    if (hour < BUSINESS_START_HOUR) return fromLocal(atLocalHour(local, BUSINESS_START_HOUR));
    if (hour < BUSINESS_END_HOUR) return date;
  }

  // Depois das 18h ou fim de semana: avança dia a dia até um dia útil, às 8h.
  do {
    local = atLocalHour(local, BUSINESS_START_HOUR);
    local.setUTCDate(local.getUTCDate() + 1);
  } while (isWeekend(local));

  return fromLocal(local);
}

/** Soma minutos contando só o tempo dentro do expediente. */
export function addBusinessMinutes(start: Date, minutes: number): Date {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`minutes deve ser um número ≥ 0 (recebido: ${String(minutes)})`);
  }

  let cursor = nextBusinessStart(start);
  let remaining = minutes;

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

export function addBusinessDays(start: Date, days: number): Date {
  return addBusinessMinutes(start, days * BUSINESS_MINUTES_PER_DAY);
}
