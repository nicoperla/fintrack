import { RULES, type DeductionType } from "@/lib/finance/deductions";
import { withoutAgent, type Situation } from "@/lib/tax/situation";

/*
 * The documents to prepare for the 730, only the ones this person needs: from the answers to
 * "Chi sei" and the deductible expenses Orbitly saw. They're the originals to keep (and to bring to
 * a CAF): Orbitly's own summary is a personal reminder, never a document for anyone else.
 */

export type DocGroup = "base" | "family" | "home" | "expenses" | "income";

export const DOC_GROUP_LABELS: Record<DocGroup, string> = {
  base: "Per tutti",
  family: "Famiglia",
  home: "Casa",
  expenses: "Spese da detrarre",
  income: "Altre entrate",
};

export type DocItem = {
  key: string;
  group: DocGroup;
  label: string;
  detail: string;
  /** Only needed at a CAF: whoever files alone on the Agenzia's site doesn't hand it over. */
  cafOnly?: boolean;
};

export type DocState = "have" | "skip";

export function documentsFor(input: {
  situation: Situation;
  /** Deduction types with expenses this year (counted or to check). */
  seen: DeductionType[];
  /** The rent deduction applies (home rented). */
  rent: boolean;
  /** Home bonuses being paid in instalments. */
  homeBonuses: number;
  year: number;
}): DocItem[] {
  const { situation: s, seen, year } = input;
  const items: DocItem[] = [
    {
      key: "id",
      group: "base",
      label: "Documento d'identità e tessera sanitaria",
      detail: "Per farti riconoscere e per il codice fiscale.",
      cafOnly: true,
    },
    {
      key: "cu",
      group: "base",
      label: s.moreEmployers
        ? `Tutte le Certificazioni Uniche ${year + 1}`
        : `Certificazione Unica ${year + 1}`,
      detail: s.moreEmployers
        ? "Una per ogni datore di lavoro o ente che ti ha pagato nell'anno: senza tutte, il conto delle tasse non torna."
        : "Te la dà il datore di lavoro o l'INPS entro il 16 marzo; c'è anche nel precompilato.",
    },
    {
      key: "previous",
      group: "base",
      label: "Il 730 dell'anno scorso",
      detail: "Serve per le rate dei bonus casa, i crediti e gli acconti già pagati.",
      cafOnly: true,
    },
    withoutAgent(s)
      ? {
          key: "iban",
          group: "base",
          label: "L'IBAN del tuo conto",
          detail: "Senza datore di lavoro o pensione il rimborso te lo paga l'Agenzia sul conto.",
        }
      : {
          key: "agent",
          group: "base",
          label: "I dati di chi ti paga a luglio",
          detail:
            "Nome e codice fiscale del datore di lavoro o dell'ente pensionistico: farà il rimborso o la trattenuta.",
        },
  ];

  if (s.spouse || s.children > 0 || s.parents > 0 || s.events.includes("child")) {
    items.push({
      key: "family-codes",
      group: "family",
      label: "Codici fiscali dei familiari a carico",
      detail: "Coniuge, figli (anche quelli sotto i 21 anni) e genitori che vivono con te.",
    });
  }
  if (s.children > 0) {
    items.push({
      key: "children-income",
      group: "family",
      label: "Quanto hanno guadagnato i figli a carico",
      detail:
        "Fino a 4.000 € sotto i 24 anni (2.840,51 € dopo) restano a carico: tirocini e lavori estivi contano.",
    });
  }
  if (s.events.includes("separated")) {
    items.push({
      key: "separation",
      group: "family",
      label: "Sentenza o accordo di separazione e i bonifici dell'assegno",
      detail: "L'assegno al coniuge (non quello per i figli) si deduce dal reddito: rigo E22.",
    });
  }

  if (s.home === "mortgage" || s.events.includes("house")) {
    items.push({
      key: "mortgage-interest",
      group: "home",
      label: "Certificazione degli interessi del mutuo",
      detail: "La manda la banca a inizio anno; nel precompilato di solito c'è già.",
    });
    items.push({
      key: "mortgage-deed",
      group: "home",
      label: "Contratto di mutuo e atto di acquisto",
      detail: "Al CAF servono la prima volta che porti il mutuo.",
      cafOnly: true,
    });
  }
  if (s.events.includes("house")) {
    items.push({
      key: "house-costs",
      group: "home",
      label: "Fatture del notaio e dell'agenzia immobiliare",
      detail:
        "Le spese del notaio per il mutuo si sommano agli interessi; il compenso dell'agenzia si detrae fino a 1.000 € (codice 17).",
    });
  }
  if (input.rent || s.home === "rent") {
    items.push({
      key: "rent-contract",
      group: "home",
      label: "Contratto d'affitto registrato",
      detail:
        "Servono il tipo di contratto e gli estremi di registrazione: la detrazione va nel rigo E71.",
    });
  }
  if (s.events.includes("moved")) {
    items.push({
      key: "moved",
      group: "home",
      label: "La prova del trasferimento per lavoro",
      detail: "Il cambio di residenza e il contratto di lavoro nel nuovo comune (rigo E72).",
    });
  }
  if (s.events.includes("renovation") || input.homeBonuses > 0) {
    items.push({
      key: "renovation",
      group: "home",
      label: "Fatture e bonifici «parlanti» dei lavori",
      detail:
        "Il bonifico deve citare la norma e il codice fiscale; per il risparmio energetico anche la ricevuta dell'ENEA.",
    });
  }

  for (const type of seen) {
    items.push(
      type === "sanitarie"
        ? {
            key: "expense-sanitarie",
            group: "expenses",
            label: "Il prospetto delle spese sanitarie del Sistema Tessera Sanitaria",
            detail:
              "Se i dati sono giusti al CAF basta quello, con una dichiarazione: gli scontrini servono solo per le spese che mancano.",
          }
        : {
            key: `expense-${type}`,
            group: "expenses",
            label: RULES[type].label,
            detail: RULES[type].documents,
          },
    );
  }

  if (s.otherIncome.includes("rent-income")) {
    items.push({
      key: "rent-income",
      group: "income",
      label: "Contratti delle case che dai in affitto e i canoni incassati",
      detail: "Con la cedolare secca o senza: va scritto nel quadro B.",
    });
  }
  if (s.otherIncome.includes("occasional")) {
    items.push({
      key: "occasional",
      group: "income",
      label: "Le certificazioni dei compensi occasionali",
      detail: "Con la ritenuta del 20% che ti hanno trattenuto: va scritto nel quadro D.",
    });
  }
  if (s.otherIncome.includes("foreign")) {
    items.push({
      key: "foreign",
      group: "income",
      label: "Estratti di conti e investimenti all'estero",
      detail: "Con il valore al 31 dicembre e i giorni di possesso, per il quadro W.",
    });
  }
  if (s.otherIncome.includes("crypto")) {
    items.push({
      key: "crypto",
      group: "income",
      label: "Il report annuale dell'exchange",
      detail: "Valori al 31 dicembre e guadagni realizzati, per i quadri W e T.",
    });
  }
  return items;
}

const DOC_STATES: readonly DocState[] = ["have", "skip"];

/** The checklist as stored (JSON): key → state, anything else dropped. */
export function readDocStates(raw: unknown): Record<string, DocState> {
  const o = (raw ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(o).filter(
      (entry): entry is [string, DocState] =>
        /^[a-z0-9-]{1,40}$/.test(entry[0]) && DOC_STATES.includes(entry[1] as DocState),
    ),
  );
}

/** How many of the documents are ready, leaving out the ones that don't apply. */
export function docProgress(items: DocItem[], states: Record<string, DocState>, caf: boolean) {
  const needed = items.filter((i) => (caf || !i.cafOnly) && states[i.key] !== "skip");
  return {
    done: needed.filter((i) => states[i.key] === "have").length,
    total: needed.length,
  };
}
