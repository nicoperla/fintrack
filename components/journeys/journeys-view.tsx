"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ChevronRight, IdCard, Plus, Route, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TaxSection, TONE_BOX, TONE_TEXT, useAction, type Tone } from "@/components/tax/ui";
import { JOURNEY_ICONS, fullDay, onDay, relativeDays } from "@/components/journeys/shared";
import { deleteDocument, saveDocument } from "@/app/(dashboard)/percorsi/actions";
import { DOC_KINDS, DOC_KIND_INFO, type DocKind, type DocStatus } from "@/lib/journeys/documents";
import type { ActionResult } from "@/lib/action-result";
import type { JourneysData } from "@/lib/data/journeys";
import { cn } from "@/lib/utils";

const STATUS: Record<DocStatus, { label: string; tone: Tone | null }> = {
  expired: { label: "Scaduto", tone: "bad" },
  renew: { label: "Da rinnovare", tone: "warn" },
  soon: { label: "Entro un anno", tone: "info" },
  ok: { label: "Valido", tone: null },
};

export function JourneysView({ data }: { data: JourneysData }) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {data.active.length > 0 && (
        <TaxSection
          id="in-corso"
          icon={Route}
          title="I tuoi percorsi"
          subtitle="Il prossimo passo di ognuno, con la sua scadenza."
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.active.map((a) => {
              const Icon = JOURNEY_ICONS[a.journey.key];
              const late = a.next?.state === "late";
              return (
                <li key={a.journey.key}>
                  <Link
                    href={`/percorsi/${a.journey.key}`}
                    className="hover:bg-muted/40 flex gap-3 rounded-xl border p-4 text-sm transition-colors"
                  >
                    <Icon
                      className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-400"
                      aria-hidden
                    />
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="font-medium">{a.journey.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {a.done} di {a.total} passi fatti
                      </span>
                      {a.next ? (
                        <span className={cn("text-xs", late && TONE_TEXT.bad)}>
                          Prossimo: {a.next.title}
                          {a.next.due &&
                            ` · ${a.next.legal ? "entro" : "meglio entro"} ${onDay(a.next.due)} (${relativeDays(a.next.days!)})`}
                        </span>
                      ) : (
                        <span className={cn("text-xs", TONE_TEXT.good)}>Tutto fatto</span>
                      )}
                    </span>
                    <ChevronRight
                      className="text-muted-foreground size-4 shrink-0 self-center"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </TaxSection>
      )}

      <DocumentsCard data={data} />

      {data.available.length > 0 && (
        <TaxSection
          id="percorsi"
          icon={Route}
          title={data.active.length ? "Altri percorsi" : "I percorsi"}
          subtitle="Quando la vita cambia, ti dico cosa fare con soldi e pratiche, in ordine e con le scadenze."
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.available.map((j) => {
              const Icon = JOURNEY_ICONS[j.key];
              return (
                <li key={j.key}>
                  <Link
                    href={`/percorsi/${j.key}`}
                    className="hover:bg-muted/40 flex gap-3 rounded-xl border p-4 text-sm transition-colors"
                  >
                    <Icon
                      className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-400"
                      aria-hidden
                    />
                    <span className="grid gap-1">
                      <span className="font-medium">{j.title}</span>
                      <span className="text-muted-foreground text-xs">{j.intro}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </TaxSection>
      )}
    </div>
  );
}

function DocumentsCard({ data }: { data: JourneysData }) {
  const [adding, setAdding] = useState(data.documents.length === 0);
  const [kind, setKind] = useState<DocKind>("CIE");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const { pending, run } = useAction();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    const res = await saveDocument(null, {
      kind,
      label: String(values.get("label") ?? "").trim() || DOC_KIND_INFO[kind].label,
      expiresOn: String(values.get("expiresOn") ?? ""),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setSaving(false);
    setErrors(res.fieldErrors ?? {});
    if (res.ok) {
      toast.success("Aggiunto: ti avviso quando è ora di rinnovarlo");
      form.reset();
      setAdding(false);
    } else if (res.error) toast.error(res.error);
  }

  return (
    <TaxSection
      id="documenti"
      icon={IdCard}
      title="Scadenze dei documenti"
      subtitle="Carta d'identità, passaporto, patente, revisione: ti avviso quando è ora di rinnovarli, con i tempi di ciascuno. Solo nome e data, mai i numeri."
      aside={
        !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Aggiungi
          </Button>
        )
      }
    >
      {data.documents.length > 0 && (
        <ul className="divide-y text-sm">
          {data.documents.map((d) => {
            const status = STATUS[d.status];
            return (
              <li key={d.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {DOC_KIND_INFO[d.kind].label} · scade il {fullDay(d.expiresOn)} (
                    {relativeDays(d.days)})
                  </p>
                  {(d.status === "renew" || d.status === "expired") && (
                    <p className="mt-1 text-xs">{DOC_KIND_INFO[d.kind].renew}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs",
                    status.tone
                      ? cn(TONE_BOX[status.tone], TONE_TEXT[status.tone])
                      : "text-muted-foreground",
                  )}
                >
                  {status.label}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  aria-label={`Togli ${d.label}`}
                  onClick={() => run(() => deleteDocument(d.id), "Tolto")}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {adding && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 rounded-xl border p-4 sm:grid-cols-4"
          noValidate
        >
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground text-xs">Documento</span>
            <NativeSelect
              value={kind}
              onChange={(e) => setKind(e.target.value as DocKind)}
              className="w-full"
            >
              {DOC_KINDS.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {DOC_KIND_INFO[k].label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground text-xs">Di chi o quale (facoltativo)</span>
            <Input
              name="label"
              placeholder={`Es. ${DOC_KIND_INFO[kind].label} di Luca`}
              maxLength={60}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground text-xs">Scade il</span>
            <Input
              type="date"
              name="expiresOn"
              aria-invalid={errors.expiresOn ? true : undefined}
            />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Salvo…" : "Aggiungi"}
            </Button>
            {data.documents.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Annulla
              </Button>
            )}
          </div>
          {(errors.expiresOn || errors.label || errors.kind) && (
            <p className="text-destructive text-xs sm:col-span-4">
              {(errors.expiresOn ?? errors.label ?? errors.kind)![0]}
            </p>
          )}
        </form>
      )}
    </TaxSection>
  );
}
