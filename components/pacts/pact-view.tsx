"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Copy,
  Crown,
  Download,
  Gavel,
  Link2,
  PiggyBank,
  Plus,
  Share2,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { PactForm } from "@/components/pacts/pact-form";
import { renderPactCard } from "@/components/pacts/share-card";
import { onDate, toDate } from "@/components/true-salary/format";
import {
  deletePact,
  newRefereeLink,
  payFine,
  revokeRefereeLink,
} from "@/app/(dashboard)/patto/actions";
import { CATEGORY_ICONS, type CategoryIconName } from "@/lib/category-style";
import { MAX_ACTIVE_PACTS } from "@/lib/finance/pacts";
import { ilPct } from "@/lib/finance/insights";
import type { PactItem, PactsPage } from "@/lib/data/pacts";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const failed = (): ActionResult & { link?: string } => ({
  ok: false,
  error: "Operazione non riuscita. Riprova.",
});
const monthName = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" });
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** "a novembre", "ad agosto", or "fino al 31 ottobre" for a pact started mid-month. */
export function periodText(from: string, to: string) {
  const month = monthName.format(parse(to));
  return from.endsWith("-01") ? `${/^a/.test(month) ? "ad" : "a"} ${month}` : `fino ${toDate(to)}`;
}

function Glyph({ icon, className }: { icon: string | null; className?: string }) {
  const Icon: LucideIcon = (icon && CATEGORY_ICONS[icon as CategoryIconName]) || Crown;
  return <Icon className={className} aria-hidden />;
}

function LinkDialog({
  link,
  referee,
  onClose,
}: {
  link: string | null;
  referee: string | null;
  onClose: () => void;
}) {
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const text = "Ho fatto un patto con me stesso e tu fai da arbitro: qui vedi come va.";
  return (
    <Dialog open={link !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Il link per {referee ?? "l'arbitro"}</DialogTitle>
          <DialogDescription>
            Mandaglielo come vuoi. Lo vedi solo adesso: se lo perdi, ne crei uno nuovo e questo
            smette di funzionare.
          </DialogDescription>
        </DialogHeader>
        <Input
          readOnly
          value={link ?? ""}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Link per l'arbitro"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() =>
              navigator.clipboard
                .writeText(link ?? "")
                .then(() => toast.success("Link copiato"))
                .catch(() => toast.error("Non riesco a copiarlo: selezionalo e copialo a mano"))
            }
          >
            <Copy /> Copia
          </Button>
          {canShare && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigator.share({ title: "Il mio patto", text, url: link ?? "" }).catch(() => {})
              }
            >
              <Share2 /> Condividi
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PactView({ data }: { data: PactsPage }) {
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<{ url: string; referee: string | null } | null>(null);
  const running = data.pacts.filter((p) => p.to >= data.today);
  const done = data.pacts.filter((p) => p.to < data.today);
  const full = data.activeMine >= MAX_ACTIVE_PACTS;

  return (
    <div className="grid grid-cols-1 gap-8">
      <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-labelledby="pact-how">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="pact-how" className="flex items-center gap-2 font-medium">
              <Gavel className="size-4" aria-hidden /> Scommetti contro te stesso
            </h2>
            <p className="text-muted-foreground text-sm">
              I budget saltano perché sforarli non costa niente. Un patto sì.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setCreating(true)}
            disabled={full || data.categories.length === 0}
          >
            <Plus /> Nuovo patto
          </Button>
        </div>
        <ol className="grid gap-2 text-sm sm:grid-cols-3">
          {[
            ["Un limite", "Su una categoria, fino a fine mese: «al massimo 150 € in ristoranti»."],
            [
              "Una posta",
              "Un amico che fa da arbitro, una promessa, una multa nel tuo salvadanaio.",
            ],
            ["Il verdetto", "A fine mese controllo io i movimenti. Niente da segnare a mano."],
          ].map(([title, text], i) => (
            <li key={title} className="bg-muted/40 flex gap-3 rounded-xl p-3">
              <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {i + 1}
              </span>
              <span>
                <span className="font-medium">{title}.</span>{" "}
                <span className="text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        {full && (
          <p className="text-muted-foreground text-sm">
            Hai già {MAX_ACTIVE_PACTS} patti in corso: il prossimo quando ne finisce uno.
          </p>
        )}
        {data.record.total > 0 && (
          <p className="text-sm">
            Finora hai rispettato{" "}
            <strong>
              {data.record.kept} {data.record.kept === 1 ? "patto" : "patti"} su {data.record.total}
            </strong>
            .
          </p>
        )}
      </section>

      {running.length > 0 && (
        <section aria-labelledby="pacts-running" className="grid gap-4">
          <h2 id="pacts-running" className="text-lg font-semibold">
            In corso
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {running.map((p) => (
              <PactCard
                key={p.id}
                pact={p}
                today={data.today}
                onLink={(url) => setLink({ url, referee: p.referee?.name ?? null })}
              />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section aria-labelledby="pacts-done" className="grid gap-4">
          <h2 id="pacts-done" className="text-lg font-semibold">
            Finiti
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {done.map((p) => (
              <PactCard
                key={p.id}
                pact={p}
                today={data.today}
                onLink={(url) => setLink({ url, referee: p.referee?.name ?? null })}
              />
            ))}
          </div>
        </section>
      )}

      {data.pacts.length === 0 && (
        <p className="bg-card/50 text-muted-foreground rounded-2xl border border-dashed p-5 text-sm">
          Ancora nessun patto. Parti dalla categoria che ti scappa di mano più spesso: in{" "}
          <Link href="/budgets" className="underline underline-offset-2">
            Budget
          </Link>{" "}
          vedi quale.
        </p>
      )}

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          La posta è solo sociale: FinTrack non muove soldi, non incassa multe e non li manda a
          nessuno. Il controllo usa i movimenti che registri: il patto è con te stesso.
        </span>
      </p>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          {creating && (
            <PactForm
              data={data}
              onDone={(url) => {
                setCreating(false);
                if (url) setLink({ url, referee: null });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <LinkDialog
        link={link?.url ?? null}
        referee={link?.referee ?? null}
        onClose={() => setLink(null)}
      />
    </div>
  );
}

const STATE_STYLE = {
  upcoming: "border-border",
  active: "border-border",
  won: "border-emerald-500/40 bg-emerald-500/5",
  lost: "border-red-500/40 bg-red-500/5",
} as const;

function PactCard({
  pact: p,
  today,
  onLink,
}: {
  pact: PactItem;
  today: string;
  onLink: (url: string) => void;
}) {
  const money = useMoney();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [sharing, setSharing] = useState(false);
  const s = p.status;
  const ended = p.to < today;
  const risky = s.state === "active" && s.projected !== null && s.projected > p.limit;

  const run = (action: () => Promise<ActionResult & { link?: string }>, success: string) =>
    start(async () => {
      const res = await action().catch(failed);
      if (!res.ok) toast.error(res.error ?? "Operazione non riuscita. Riprova.");
      else if (res.link) onLink(res.link);
      else toast.success(success);
    });

  async function share() {
    setSharing(true);
    try {
      const blob = await renderPactCard({
        won: s.state === "won",
        category: p.category.name,
        month: monthName.format(parse(p.to)),
        used: s.used,
      });
      const file = new File([blob], "fintrack-patto.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Il mio patto su FinTrack" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") console.error(error);
    } finally {
      setSharing(false);
    }
  }

  let line: string;
  if (s.state === "upcoming") line = `Parte ${onDate(p.from)}.`;
  else if (s.state === "lost")
    line = `Limite superato di ${money(s.over)}: patto perso${ended ? "" : ", anche se il mese non è finito"}.`;
  else if (s.state === "won")
    line = `Patto rispettato: hai usato ${ilPct(s.used * 100)} del limite.`;
  else
    line = `Hai speso ${money(p.spent)}, ${pct(s.used)} del limite. ${
      s.daysLeft === 1 ? "Oggi è l'ultimo giorno." : `Mancano ${s.daysLeft} giorni.`
    }`;

  return (
    <article
      className={cn(
        "bg-card grid content-start gap-4 rounded-2xl border p-5",
        STATE_STYLE[s.state],
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: p.category.color ?? "var(--viz-other)" }}
        >
          <Glyph icon={p.category.icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">
            Al massimo {money(p.limit)} in «{p.category.name}»
          </h3>
          <p className="text-muted-foreground text-sm">
            {periodText(p.from, p.to)}
            {!p.mine && ` · il patto di ${p.author}`}
            {p.mine && !p.onlyMine && " · spese di tutto lo spazio"}
          </p>
        </div>
      </div>

      {s.state !== "upcoming" && (
        <div className="grid gap-1.5">
          <div className="bg-muted relative h-2.5 rounded-full">
            <div
              className={cn(
                "h-full rounded-full",
                s.state === "lost" ? "bg-red-500" : risky ? "bg-amber-500" : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(1, s.used) * 100}%` }}
            />
            {s.state === "active" && (
              <span
                aria-hidden
                title="Dove dovresti essere oggi"
                className="bg-foreground/70 absolute -top-1 h-4.5 w-0.5 rounded-full"
                style={{ left: `calc(${s.elapsed * 100}% - 1px)` }}
              />
            )}
          </div>
        </div>
      )}
      <div className="grid gap-1 text-sm">
        <p
          className={cn(
            s.state === "lost" && "font-medium text-red-700 dark:text-red-400",
            s.state === "won" && "font-medium text-emerald-700 dark:text-emerald-400",
          )}
        >
          {line}
        </p>
        {s.state === "active" && s.projected !== null && (
          <p className={cn(risky ? "text-(--warn-text)" : "text-muted-foreground")}>
            {risky
              ? `Di questo passo arrivi a ${money(s.projected)}: rallenta.`
              : "Di questo passo ce la fai."}
          </p>
        )}
      </div>

      <ul className="grid gap-2 border-t pt-3 text-sm">
        {p.referee && (
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <Gavel className="text-muted-foreground size-4" aria-hidden /> Arbitro:{" "}
              <strong>{p.referee.name}</strong>
            </span>
            <span className="text-muted-foreground text-xs">
              {p.referee.views === 0
                ? "non ha ancora aperto il link"
                : `ha aperto il link ${p.referee.views === 1 ? "una volta" : `${p.referee.views} volte`}`}
            </span>
            {p.mine && p.referee.canRelink && (
              <span className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => newRefereeLink(p.id), "")}
                >
                  <Link2 /> Nuovo link
                </Button>
                {p.referee.linkActive && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => revokeRefereeLink(p.id), "Link revocato")}
                  >
                    Revoca
                  </Button>
                )}
              </span>
            )}
          </li>
        )}
        {p.promise && (
          <li>
            <span className="text-muted-foreground">Se perde: </span>«{p.promise}»
          </li>
        )}
        {p.fine && (
          <li className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex items-center gap-1.5">
              <PiggyBank className="text-muted-foreground size-4" aria-hidden /> Multa:{" "}
              <strong className="tabular-nums">{money(p.fine.amount)}</strong>
              {p.fine.goal ? ` in «${p.fine.goal}»` : ""}
            </span>
            {p.fine.paidOn ? (
              <span className="text-xs text-emerald-700 dark:text-emerald-400">
                messa da parte {onDate(p.fine.paidOn)}
              </span>
            ) : (
              s.state === "lost" &&
              p.mine &&
              p.fine.goal && (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => payFine(p.id), "Multa messa da parte: è nel tuo obiettivo")
                  }
                >
                  Ho messo da parte {money(p.fine.amount)}
                </Button>
              )
            )}
          </li>
        )}
      </ul>

      {(ended || s.state === "lost" || p.mine) && (
        <div className="flex flex-wrap gap-2">
          {(s.state === "won" || (s.state === "lost" && ended)) && (
            <Button type="button" size="sm" variant="outline" onClick={share} disabled={sharing}>
              {typeof navigator !== "undefined" && "share" in navigator ? <Share2 /> : <Download />}
              {sharing ? "Preparo l'immagine…" : "Condividi, senza importi"}
            </Button>
          )}
          {p.mine && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setConfirm(true)}
            >
              <Trash2 /> Elimina
            </Button>
          )}
        </div>
      )}
      <ConfirmDeleteDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Eliminare il patto?"
        description={
          p.referee?.linkActive
            ? `Sparisce anche il link di ${p.referee.name}. Un patto cancellato a metà mese è un patto perso con te stesso.`
            : "Sparisce dal tuo storico dei patti."
        }
        successMessage="Patto eliminato"
        onConfirm={() => deletePact(p.id)}
      />
    </article>
  );
}
