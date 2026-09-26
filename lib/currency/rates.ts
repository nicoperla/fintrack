import { prisma } from "@/lib/db/prisma";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";
import { convertAmount, CurrencyError, type RateTable } from "@/lib/currency/convert";

/*
 * ECB reference rates, published on working days around 16:00 CET, served by Frankfurter
 * (free, no key). Rates are cached in the exchange_rates table: the API is only called for
 * dates we don't have yet, and only when a currency other than the base one is involved.
 */

const API = "https://api.frankfurter.dev/v1";
const DAY_MS = 86_400_000;
/** A weekend plus a bank holiday: older than this, a stored rate is considered missing. */
const MAX_GAP_DAYS = 4;

const iso = (d: Date) => toDateInputValue(d);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

function todayUtc() {
  const t = todayInAppTimeZone();
  return utcDate(t.year, t.month, t.day);
}

type ApiSeries = { rates: Record<string, Record<string, number>> };
type ApiDay = { date: string; rates: Record<string, number> };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok)
    throw new CurrencyError(`Servizio dei tassi di cambio non disponibile (${res.status})`);
  return (await res.json()) as T;
}

async function store(days: Record<string, Record<string, number>>) {
  const data = Object.entries(days).flatMap(([date, rates]) =>
    Object.entries(rates).map(([currency, rate]) => ({
      date: new Date(`${date}T00:00:00Z`),
      currency,
      rate,
    })),
  );
  if (data.length) await prisma.exchangeRate.createMany({ data, skipDuplicates: true });
}

/** Downloads (and caches) the rates for [from, to]; a few days before `from` cover weekends. */
async function download(from: Date, to: Date) {
  const start = iso(addDays(from, -MAX_GAP_DAYS));
  const end = iso(to);
  if (start === end) {
    const day = await fetchJson<ApiDay>(`${API}/${end}?base=EUR`);
    await store({ [day.date]: day.rates });
  } else {
    const series = await fetchJson<ApiSeries>(`${API}/${start}..${end}?base=EUR`);
    await store(series.rates);
  }
}

type Row = { date: Date; currency: string; rate: unknown };

/** For every day in [from, to], the latest known rate on or before that day, per currency. */
function buildLookup(rows: Row[]) {
  const byCurrency = new Map<string, { date: string; rate: number }[]>();
  for (const r of rows) {
    const list = byCurrency.get(r.currency) ?? [];
    list.push({ date: iso(r.date), rate: Number(r.rate) });
    byCurrency.set(r.currency, list);
  }
  byCurrency.forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));

  return (currency: string, day: string) => {
    const list = byCurrency.get(currency);
    if (!list) return null;
    let found: { date: string; rate: number } | null = null;
    for (const entry of list) {
      if (entry.date > day) break;
      found = entry;
    }
    if (!found) return null;
    const gap = (Date.parse(day) - Date.parse(found.date)) / DAY_MS;
    return gap <= MAX_GAP_DAYS ? found.rate : null;
  };
}

async function loadRows(currencies: string[], from: Date, to: Date) {
  return prisma.exchangeRate.findMany({
    where: { currency: { in: currencies }, date: { gte: addDays(from, -MAX_GAP_DAYS), lte: to } },
  });
}

/**
 * Returns a converter for amounts dated within [from, to]. Future dates use today's rates.
 * Only foreign currencies (≠ EUR) hit the database, and the API only for missing days.
 */
export async function createConverter(currencies: string[], from: Date, to: Date) {
  const today = todayUtc();
  const end = to > today ? today : to;
  const start = from > end ? end : from;
  const foreign = Array.from(new Set(currencies.filter((c) => c !== "EUR")));

  let lookup = buildLookup(foreign.length ? await loadRows(foreign, start, end) : []);
  const missing = () => {
    for (const currency of foreign) {
      for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
        if (lookup(currency, iso(new Date(t))) === null) return true;
      }
    }
    return false;
  };

  if (foreign.length && missing()) {
    try {
      await download(start, end);
      lookup = buildLookup(await loadRows(foreign, start, end));
    } catch (error) {
      console.error("[fx] download fallito", error);
    }
    if (missing()) {
      // Long bank holidays, or the API is unreachable: use the latest rate we know, however old.
      const latest = await prisma.exchangeRate.findMany({
        where: { currency: { in: foreign }, date: { lte: end } },
        orderBy: { date: "desc" },
        distinct: ["currency"],
      });
      const fallback = new Map(latest.map((r) => [r.currency, Number(r.rate)]));
      const strict = lookup;
      lookup = (currency, day) => strict(currency, day) ?? fallback.get(currency) ?? null;
    }
  }

  const ratesOn = (day: string): RateTable => {
    const table: RateTable = {};
    for (const currency of foreign) {
      const rate = lookup(currency, day > iso(end) ? iso(end) : day);
      if (rate !== null) table[currency] = rate;
    }
    return table;
  };

  return {
    /** Converts `amount` from one currency to another at the rate of `date` (YYYY-MM-DD or Date). */
    convert(amount: number, fromCurrency: string, toCurrency: string, date: Date | string) {
      if (fromCurrency === toCurrency) return amount;
      return convertAmount(
        amount,
        fromCurrency,
        toCurrency,
        ratesOn(typeof date === "string" ? date : iso(date)),
      );
    },
  };
}

export type Converter = Awaited<ReturnType<typeof createConverter>>;

/** Converter at today's rates, for balances and net worth. */
export function latestConverter(currencies: string[]) {
  const today = todayUtc();
  return createConverter(currencies, today, today);
}
