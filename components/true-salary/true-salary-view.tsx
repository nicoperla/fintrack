"use client";

import { useState } from "react";
import { BadgeEuro, CalendarRange, Calculator, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { AnimatedCurrency } from "@/components/dashboard/animated-currency";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { BigExpensesSection } from "@/components/true-salary/big-expenses";
import { TrueSalarySettings } from "@/components/true-salary/true-salary-settings";
import { setTrueSalaryActive } from "@/app/(dashboard)/stipendio-vero/actions";
import type { TrueSalaryData } from "@/lib/data/true-salary";
import {
  formatShortDay,
  onDate,
  toDate,
  untilPayday,
  type LastYearAmounts,
} from "@/components/true-salary/format";
import { cn } from "@/lib/utils";

const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" });
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function TrueSalaryView({
  data,
  lastYear,
}: {
  data: TrueSalaryData;
  lastYear: LastYearAmounts;
}) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Hero data={data} />
      <Breakdown data={data} />
      <YearCalendar data={data} />
      <BigExpensesSection data={data} lastYear={lastYear} />
      <TrueSalarySettings data={data} />
      <p className="text-muted-foreground text-xs">
        Stime calcolate sui tuoi movimenti e sulle cifre che scrivi tu. IMU e TARI dipendono dal
        Comune, il bollo dalla regione: controlla gli avvisi di pagamento. Per le tasse della
        partita IVA verifica con il commercialista. Non è consulenza finanziaria né fiscale.
      </p>
    </div>
  );
}

function Hero({ data }: { data: TrueSalaryData }) {
  const money = useMoney();
  const [pending, setPending] = useState(false);
  const negative = data.value < 0;

  async function toggle(on: boolean) {
    setPending(true);
    const res = await setTrueSalaryActive(on).catch(() => ({ ok: false }));
    setPending(false);
    if (!res.ok) toast.error("Non sono riuscito a salvare. Riprova.");
    else
      toast.success(on ? "Ora lo vedi in dashboard" : "In dashboard tornano i soldi disponibili");
  }

  return (
    <section
      aria-label="Lo stipendio vero"
      className="relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"
      style={{ background: "linear-gradient(135deg, #4338ca, #7c3aed 55%, #be185d)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #c4b5fd, transparent 70%)" }}
      />
      <p className="flex items-center gap-2 text-sm text-white/80">
        <BadgeEuro className="size-4" aria-hidden /> Puoi spendere senza pensieri
      </p>
      <AnimatedCurrency
        value={data.value}
        className="mt-1 block text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl"
      />
      <p className="mt-2 max-w-xl text-white/85">
        {negative
          ? `Le spese fisse e le stangate superano i soldi sui conti di tutti i giorni: per ora non c'è margine, ${untilPayday(data.payday)}.`
          : `Circa ${money(data.perDay)} al giorno ${untilPayday(data.payday)}.`}
      </p>
      <ul className="mt-5 flex flex-wrap gap-2 text-sm">
        <li className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">
          Conti di tutti i giorni {money(data.everyday.total)}
        </li>
        {data.fixed.total > 0 && (
          <li className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">
            Spese fisse {money(data.fixed.total)}
          </li>
        )}
        {data.reserve.held > 0 && (
          <li className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">
            Stangate da parte {money(data.reserve.held)}
          </li>
        )}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        {data.active ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-white/85">
              <LayoutDashboard className="size-4" aria-hidden /> Lo vedi in dashboard
            </span>
            <button
              type="button"
              onClick={() => toggle(false)}
              disabled={pending}
              className="text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              Togli
            </button>
          </>
        ) : (
          <Button
            type="button"
            onClick={() => toggle(true)}
            disabled={pending}
            className="bg-white text-indigo-800 hover:bg-white/90 hover:brightness-100"
          >
            <LayoutDashboard /> Mostralo in dashboard
          </Button>
        )}
      </div>
    </section>
  );
}

/** Every step of the number, one tap away, so nobody has to trust it blindly. */
function Breakdown({ data }: { data: TrueSalaryData }) {
  const money = useMoney();
  const { reserve } = data;
  return (
    <section
      id="calcolo"
      aria-labelledby="calcolo-title"
      className="bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5"
    >
      <div>
        <h2 id="calcolo-title" className="flex items-center gap-2 font-medium">
          <Calculator className="size-4" aria-hidden /> Come l&apos;ho calcolato
        </h2>
        <p className="text-muted-foreground text-sm">
          I soldi di oggi, meno quello che deve ancora uscire prima dello stipendio, meno la parte
          delle stangate che dovresti già avere da parte.
        </p>
      </div>

      <div className="divide-y text-sm">
        <Row
          label="Sui conti di tutti i giorni"
          detail={data.everyday.accounts.map((a) => a.name).join(", ")}
          value={money(data.everyday.total)}
        >
          <ul className="grid grid-cols-1 gap-1">
            {data.everyday.accounts.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex justify-between gap-3">
                <span>{a.name}</span>
                <span className="tabular-nums">{money(a.balance)}</span>
              </li>
            ))}
          </ul>
        </Row>

        <Row
          label={`Spese fisse ${data.payday.source === "month-end" ? "fino a fine mese" : `fino ${toDate(data.payday.date)}`}`}
          detail={
            data.fixed.items.length === 0
              ? "Nessun addebito ricorrente in arrivo"
              : `${data.fixed.items.length} ${data.fixed.items.length === 1 ? "addebito ricorrente" : "addebiti ricorrenti"} trovati nei tuoi movimenti`
          }
          value={`− ${money(data.fixed.total)}`}
        >
          {data.fixed.items.length > 0 && (
            <ul className="grid grid-cols-1 gap-1">
              {data.fixed.items.map((f, i) => (
                <li key={`${f.name}-${f.date}-${i}`} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {formatShortDay(f.date)} · {f.name}
                  </span>
                  <span className="tabular-nums">{money(f.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Row>

        <Row
          label="Da parte per le stangate"
          detail={
            reserve.items.length === 0
              ? "Nessuna stangata da preparare: aggiungile qui sotto"
              : `Oggi dovresti averne da parte ${money(reserve.reserved)}`
          }
          value={`− ${money(reserve.held)}`}
        >
          {reserve.items.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              <ul className="grid grid-cols-1 gap-1">
                {reserve.items.map((item) => (
                  <li key={item.key} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate">{item.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {money(item.nextAmount)} {onDate(item.nextDate)}
                        {item.beforePayday && " · prima dello stipendio, tutta"}
                      </span>
                    </span>
                    <span className="tabular-nums">{money(item.reserved)}</span>
                  </li>
                ))}
              </ul>
              {reserve.fromExtra > 0 && (
                <p className="text-muted-foreground">
                  La tredicesima maturata finora ne copre {money(reserve.fromExtra)}.
                </p>
              )}
              {reserve.account && reserve.covered > 0 && (
                <p className="text-muted-foreground">
                  Su «{reserve.account.name}» ne hai già {money(reserve.covered)}.
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                Per ogni stangata metto da parte un po&apos; ogni giorno, dal pagamento precedente
                alla scadenza; se scade prima dello stipendio la tengo tutta. Il giorno della
                scadenza quei soldi tornano liberi: è quando la paghi.
              </p>
            </div>
          )}
        </Row>

        <p className="flex items-baseline justify-between gap-3 pt-3">
          <span className="font-medium">Stipendio vero</span>
          <span
            className={cn(
              "text-base font-semibold tabular-nums",
              data.value < 0 && "text-(--delta-bad)",
            )}
          >
            {money(data.value)}
          </span>
        </p>
      </div>
      <p className="text-muted-foreground text-xs">
        Spesa, bar, benzina e le altre spese di tutti i giorni le paghi con lo stipendio vero:
        diviso per i {data.days} {data.days === 1 ? "giorno" : "giorni"} che mancano fa{" "}
        {money(data.perDay)} al giorno.
      </p>
    </section>
  );
}

function Row({
  label,
  detail,
  value,
  children,
}: {
  label: string;
  detail: string;
  value: string;
  children?: React.ReactNode;
}) {
  const summary = (
    <span className="flex items-baseline justify-between gap-3">
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="text-muted-foreground block truncate text-xs">{detail}</span>
      </span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </span>
  );
  if (!children) return <div className="py-3">{summary}</div>;
  return (
    <details className="group py-3">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div className="bg-muted/30 mt-3 rounded-xl p-3">{children}</div>
    </details>
  );
}

function YearCalendar({ data }: { data: TrueSalaryData }) {
  const money = useMoney();
  const { plan } = data;
  const busiest = Math.max(...plan.months.map((m) => m.total));
  const thisYear = data.today.slice(0, 4);
  return (
    <section
      aria-labelledby="anno-title"
      className="bg-card grid grid-cols-1 gap-4 rounded-2xl border p-5"
    >
      <div>
        <h2 id="anno-title" className="flex items-center gap-2 font-medium">
          <CalendarRange className="size-4" aria-hidden /> Le stangate dei prossimi 12 mesi
        </h2>
        <p className="text-muted-foreground text-sm">
          {plan.yearly > 0
            ? `In un anno fanno ${money(plan.yearly)}: ${money(plan.monthly)} al mese da mettere da parte.`
            : "Aggiungi le stangate che paghi e le vedrai qui, mese per mese."}
        </p>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {plan.months.map((m) => {
          const date = parse(`${m.key}-01`);
          const label = `${monthName.format(date)}${m.key.slice(0, 4) !== thisYear ? ` ${m.key.slice(0, 4)}` : ""}`;
          const heavy = m.total > 0 && m.total === busiest;
          return (
            <li
              key={m.key}
              className={cn(
                "grid grid-cols-1 content-start gap-1 rounded-xl border p-3 text-sm",
                m.total === 0 && "text-muted-foreground",
                heavy && "border-amber-500/50 bg-amber-500/5",
              )}
            >
              <p className="flex items-baseline justify-between gap-2">
                <span className="font-medium capitalize">{label}</span>
                <span className="tabular-nums">{m.total > 0 ? money(m.total) : "—"}</span>
              </p>
              {m.items.map((item, i) => (
                <p
                  key={`${item.name}-${item.date}-${i}`}
                  className={cn(
                    "text-muted-foreground flex justify-between gap-2 text-xs",
                    item.paid && "line-through opacity-70",
                  )}
                >
                  <span className="min-w-0 truncate">
                    {item.date.slice(8, 10).replace(/^0/, "")} · {item.name}
                  </span>
                  <span className="shrink-0 tabular-nums">{money(item.amount)}</span>
                </p>
              ))}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
