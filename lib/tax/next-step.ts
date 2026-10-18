import {
  describeTiming,
  keepUntil,
  longDay,
  refundTiming,
  sendDeadlines,
  type Payer,
  type Stage,
} from "@/lib/tax/calendar";
import type { YearRules } from "@/lib/tax/rules";
import type { Assessment } from "@/lib/tax/situation";

/** Where on the page the next step is done. */
export type StepTarget =
  "situation" | "documents" | "folder" | "estimate" | "precompiled" | "send" | "after";

export type NextStep = { title: string; text: string; target: StepTarget; due?: string };

export type Decision = "ACCEPT" | "MODIFY" | "CAF";
export type Channel = "SELF" | "CAF";

const eur = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
const withYear = (iso: string) => `${longDay(iso)} ${iso.slice(0, 4)}`;

const DAY_MS = 86_400_000;

/**
 * The next step worth a line in the weekly summary: when its date is three weeks away or less,
 * or while the precompilato is out and the 730 isn't decided or sent yet.
 */
export function digestNote(next: NextStep, stage: Stage, today: string) {
  if (next.target === "situation") return null;
  const days = next.due
    ? Math.round((Date.parse(`${next.due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
    : null;
  const near = days !== null && days >= 0 && days <= 21;
  const season =
    (stage === "precompiled" || stage === "send") &&
    (next.target === "precompiled" || next.target === "send");
  return near || season ? { title: next.title, text: next.text } : null;
}

/** The one thing to do now, given the stage of the year and what the person has done so far. */
export function nextStep(input: {
  stage: Stage;
  rules: YearRules;
  today: string;
  assessment: Assessment | null;
  docs: { done: number; total: number };
  toCheck: number;
  hasCu: boolean;
  decision: Decision | null;
  channel: Channel | null;
  sentAt: string | null;
  /** From the 730-3: positive back to you, negative to pay. */
  result: number | null;
  refundReceivedAt: string | null;
  payer: Payer;
}): NextStep {
  const { stage, rules, today, assessment: a, docs } = input;
  const c = rules.calendar;
  const docsLeft = docs.total - docs.done;

  if (!a) {
    return {
      title: "Rispondi a sei domande",
      text: "Due minuti: mi servono per dirti se puoi fare da solo, cosa preparare e cosa succede dopo.",
      target: "situation",
    };
  }
  if (a.vat) {
    return {
      title: "Prepara i documenti per il commercialista",
      text: "Con la partita IVA si usa il modello Redditi: porta la lista dei documenti e le spese che ho raccolto.",
      target: "documents",
    };
  }

  switch (stage) {
    case "year":
      if (input.toCheck > 0) {
        return {
          title: input.toCheck === 1 ? "Conferma una spesa" : `Conferma ${input.toCheck} spese`,
          text: "Potrebbero valere per il 730: dimmi tu se contano.",
          target: "folder",
        };
      }
      return {
        title: "Continua a registrare le spese",
        text: `Raccolgo io quelle detraibili e ti avviso se qualcosa non va. A gennaio ${rules.year + 1} prepariamo i documenti.`,
        target: "folder",
      };

    case "prepare":
      if (!input.hasCu) {
        return {
          title: "Quando arriva la CU, scrivi i suoi numeri",
          text: `Il datore di lavoro o l'INPS te la danno entro il ${longDay(c.cu)}: con quattro numeri ti dico se avrai un rimborso o un debito.`,
          target: "estimate",
          due: c.cu,
        };
      }
      if (docsLeft > 0) {
        return {
          title: `Raccogli i documenti: ${docs.done} di ${docs.total} pronti`,
          text: `Il precompilato esce il ${longDay(c.precompiled)}: arrivarci con tutto in mano rende il resto veloce.`,
          target: "documents",
          due: c.precompiled,
        };
      }
      return {
        title: `Hai tutto: il precompilato esce il ${longDay(c.precompiled)}`,
        text: "Ti avviso io quando è il momento di aprirlo.",
        target: "precompiled",
        due: c.precompiled,
      };

    case "precompiled":
    case "send": {
      if (!input.decision) {
        return {
          title: "Apri il precompilato e confrontalo con me",
          text:
            stage === "precompiled"
              ? `Da oggi si può leggere; dal ${longDay(c.sendFrom)} si può anche inviare.`
              : "Ti dico cosa c'è, cosa manca e dove scriverlo.",
          target: "precompiled",
          due: stage === "precompiled" ? c.sendFrom : c.deadline,
        };
      }
      const next = sendDeadlines(rules, today, input.payer)[0];
      const timing = next ? ` per avere il rimborso ${describeTiming(next.timing)}` : "";
      if (input.decision === "CAF") {
        return {
          title: "Prenota il CAF e porta i documenti",
          text: `${docsLeft > 0 ? `Ti mancano ${docsLeft} documenti della lista. ` : ""}Vai entro il ${longDay(next?.sentBy ?? c.deadline)}${timing}.`,
          target: "send",
          due: next?.sentBy ?? c.deadline,
        };
      }
      return {
        title: `Invia il 730 entro il ${longDay(next?.sentBy ?? c.deadline)}`,
        text: `${input.decision === "MODIFY" ? "Prima fai le modifiche che ti ho indicato, poi invia" : "Accettalo così com'è e invialo"}${timing}. La scadenza ultima è il ${longDay(c.deadline)}.`,
        target: "send",
        due: next?.sentBy ?? c.deadline,
      };
    }

    case "after": {
      if (!input.sentAt) {
        return {
          title: "La scadenza del 730 è passata",
          text: `Se dovevi farla, c'è il modello Redditi entro il ${withYear(c.redditiBy)}, con un CAF o un professionista. Se non eri obbligato e avevi un rimborso, chiedi a un CAF se puoi ancora recuperarlo.`,
          target: "after",
        };
      }
      const timing = refundTiming(rules, input.sentAt, input.payer);
      if (input.result === null) {
        return {
          title: "Scrivi il risultato del tuo 730",
          text: `Lo trovi nel prospetto di liquidazione (730-3): rimborso o debito. Così ti dico quando arriva e cosa tenere da parte. Di solito arriva ${describeTiming(timing)}.`,
          target: "after",
        };
      }
      if (input.result > 0 && !input.refundReceivedAt) {
        return {
          title: `Rimborso di ${eur(input.result)} in arrivo`,
          text: `Arriva ${describeTiming(timing)}. Quando lo vedi, segnalo come arrivato.`,
          target: "after",
        };
      }
      if (input.result < 0) {
        return {
          title: `Debito di ${eur(-input.result)}`,
          text:
            timing.kind === "agency"
              ? "Senza datore di lavoro lo paghi tu con il modello F24, anche dal sito dell'Agenzia."
              : `Te lo trattengono ${describeTiming(timing)}; a novembre c'è il secondo acconto. Mettilo tra le stangate per non avere sorprese.`,
          target: "after",
        };
      }
      return {
        title: "Tutto fatto: conserva i documenti",
        text: `Ricevute e 730 vanno tenuti fino al 31 dicembre ${keepUntil(rules.year).slice(0, 4)}.`,
        target: "after",
      };
    }
  }
}
