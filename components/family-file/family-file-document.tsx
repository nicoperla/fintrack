import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/format";
import type { FamilyFileContent } from "@/lib/family-file";

/*
 * The family file as its reader sees it: on the shared page and as the owner's preview. No
 * hooks, so it renders on the server for someone without an account.
 */

const longDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const day = (iso: string) => longDate.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
const percent = (n: number) => `${n.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%`;

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-2">
      <div>
        <h3 className="font-medium">{title}</h3>
        {note && <p className="text-muted-foreground text-xs">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ main, sub, value }: { main: ReactNode; sub?: ReactNode; value?: ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block">{main}</span>
        {sub && <span className="text-muted-foreground block text-xs">{sub}</span>}
      </span>
      {value !== undefined && value !== null && (
        <span className="shrink-0 tabular-nums">{value}</span>
      )}
    </li>
  );
}

export function FamilyFileDocument({ content }: { content: FamilyFileContent }) {
  const money = (n: number | null, currency = content.currency) =>
    n === null ? null : formatCurrency(n, currency);
  const empty =
    content.accounts.length +
      content.investments.length +
      content.debts.length +
      content.recurring.length +
      content.notes.length ===
    0;

  return (
    <article className="grid grid-cols-1 gap-6 text-sm">
      <header>
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Il fascicolo di famiglia
        </p>
        <h2 className="text-xl font-semibold tracking-tight">{content.spaceName}</h2>
        <p className="text-muted-foreground">
          Aggiornato al {day(content.generatedOn)}
          {content.people.length > 0 && ` · ${content.people.join(", ")}`}
          {!content.showAmounts && " · senza importi"}
        </p>
      </header>

      {empty && <p className="text-muted-foreground">Il fascicolo è ancora vuoto.</p>}

      {content.accounts.length > 0 && (
        <Block title="I conti" note="Dove sono i soldi di tutti i giorni e i risparmi.">
          <ul className="divide-y">
            {content.accounts.map((a, i) => (
              <Row
                key={`${a.name}-${i}`}
                main={a.name}
                sub={[
                  // "Contanti" called "Contanti": no need to say it twice.
                  a.kind.toLowerCase() !== a.name.toLowerCase() ? a.kind : null,
                  a.currency !== content.currency ? a.currency : null,
                  a.archived ? "non più usato" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                value={money(a.balance, a.currency)}
              />
            ))}
          </ul>
        </Block>
      )}

      {content.investments.length > 0 && (
        <Block
          title="Gli investimenti"
          note="Fondi, ETF, previdenza: chi li gestisce sa come chiuderli o trasferirli."
        >
          <ul className="divide-y">
            {content.investments.map((inv, i) => (
              <Row
                key={`${inv.name}-${i}`}
                main={inv.name}
                sub={
                  inv.valuedAt
                    ? `Valore aggiornato al ${day(inv.valuedAt)}`
                    : "Valore non ancora inserito"
                }
                value={money(inv.value, inv.currency)}
              />
            ))}
          </ul>
        </Block>
      )}

      {content.debts.length > 0 && (
        <Block title="I debiti" note="Prestiti e mutui ancora aperti, con il loro tasso.">
          <ul className="divide-y">
            {content.debts.map((d, i) => (
              <Row
                key={`${d.name}-${i}`}
                main={d.name}
                sub={[
                  `Tasso ${percent(d.interestRate)}`,
                  d.minimumPayment !== null ? `rata ${money(d.minimumPayment)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                value={money(d.balance)}
              />
            ))}
          </ul>
        </Block>
      )}

      {content.recurring.length > 0 && (
        <Block
          title="Addebiti che continuano ad arrivare"
          note="Abbonamenti, bollette, rate: da disdire o da intestare a qualcun altro."
        >
          <ul className="divide-y">
            {content.recurring.map((r, i) => (
              <Row key={`${r.name}-${i}`} main={r.name} sub={r.frequency} value={money(r.amount)} />
            ))}
          </ul>
        </Block>
      )}

      {content.notes.map((n) => (
        <Block key={n.title} title={n.title}>
          <p className="bg-muted/40 rounded-xl p-3 whitespace-pre-wrap">{n.text}</p>
        </Block>
      ))}

      <p className="text-muted-foreground border-t pt-4 text-xs">
        Non è un testamento e non contiene password: è una mappa, per sapere dove cercare e chi
        chiamare. Preparato con FinTrack.
      </p>
    </article>
  );
}
