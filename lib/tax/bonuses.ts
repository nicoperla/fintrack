/*
 * "Trova bonus": the national benefits most families can ask for, with a few questions to tell
 * who might be entitled. Amounts and thresholds change every year (budget law, INPS circulars):
 * each one says "circa" and points to the official site, where the request is made. Checked in
 * October 2026; Orbitly never applies on anyone's behalf.
 */

export const BONUSES_CHECKED_AT = "ottobre 2026";

export type BonusAnswers = {
  /** The ISEE value, null if not known. */
  isee: number | null;
  /** People in the family (nucleo ISEE). */
  people: number;
  /** Children under 21 / under 6 / under 3, born this year or last, turning 18. */
  childrenUnder21: number;
  childUnder6: boolean;
  childUnder3: boolean;
  newborn: boolean;
  turning18: boolean;
  age: number | null;
  rent: boolean;
  workless: boolean;
};

export const EMPTY_BONUS_ANSWERS: BonusAnswers = {
  isee: null,
  people: 1,
  childrenUnder21: 0,
  childUnder6: false,
  childUnder3: false,
  newborn: false,
  turning18: false,
  age: null,
  rent: false,
  workless: false,
};

/** "yes": the conditions seem met; "isee": it depends on the ISEE, which isn't known; "maybe": other conditions to check. */
export type BonusMatch = "yes" | "isee" | "maybe" | "no";

export type Bonus = {
  key: string;
  title: string;
  amount: string;
  who: string;
  how: string[];
  /** Where to ask: the official site to search. */
  where: string;
  match: (a: BonusAnswers) => BonusMatch;
};

/** Below a threshold, or unknown. */
const under = (a: BonusAnswers, max: number): BonusMatch =>
  a.isee === null ? "isee" : a.isee <= max ? "yes" : "no";

export const BONUSES: Bonus[] = [
  {
    key: "assegno-unico",
    title: "Assegno unico per i figli",
    amount:
      "Da circa 58 a circa 204 € al mese per figlio, secondo l'ISEE (di più per i figli piccoli e dal terzo).",
    who: "Per ogni figlio a carico fino a 21 anni (senza limiti con disabilità). Senza ISEE spetta l'importo minimo.",
    how: [
      "Domanda una volta sola sul sito dell'INPS, con un patronato o dall'app IO.",
      "Ogni anno rinnova l'ISEE entro fine febbraio, altrimenti da marzo ricevi il minimo.",
      "Se lo rinnovi entro il 30 giugno, gli arretrati da marzo arrivano lo stesso.",
    ],
    where: "INPS · «Assegno unico e universale»",
    match: (a) => (a.childrenUnder21 > 0 ? "yes" : "no"),
  },
  {
    key: "nuovi-nati",
    title: "Bonus nuovi nati",
    amount: "1.000 € una volta sola, per ogni figlio nato o adottato.",
    who: "Per i figli nati o adottati dal 2025, con ISEE fino a 40.000 €.",
    how: ["Domanda all'INPS entro 120 giorni dalla nascita o dall'ingresso in famiglia."],
    where: "INPS · «Bonus nuovi nati»",
    match: (a) => (a.newborn ? under(a, 40_000) : "no"),
  },
  {
    key: "nido",
    title: "Bonus asilo nido",
    amount: "Fino a circa 3.600 € l'anno per le rette, secondo l'ISEE.",
    who: "Per i bambini sotto i 3 anni che vanno al nido (o con gravi patologie, assistiti a casa).",
    how: [
      "Domanda all'INPS ogni anno, con le ricevute delle rette.",
      "Le rette rimborsate dal bonus non si detraggono anche nel 730.",
    ],
    where: "INPS · «Bonus asilo nido»",
    match: (a) => (a.childUnder3 ? "yes" : "no"),
  },
  {
    key: "bonus-sociale",
    title: "Bonus sociale luce, gas e acqua",
    amount: "Uno sconto in bolletta, automatico.",
    who: "Con ISEE fino a circa 9.800 € (circa 20.000 € con almeno quattro figli a carico).",
    how: ["Basta presentare la DSU per l'ISEE: lo sconto arriva da solo nelle bollette."],
    where: "ARERA · «Bonus sociale»",
    match: (a) => under(a, a.childrenUnder21 >= 4 ? 20_000 : 9_796),
  },
  {
    key: "dedicata-a-te",
    title: "Carta «Dedicata a te»",
    amount: "Circa 500 € su una carta per la spesa alimentare.",
    who: "Nuclei di almeno tre persone con ISEE fino a 15.000 €, scelti dal Comune con l'INPS.",
    how: [
      "Non si fa domanda: il Comune pubblica l'elenco e la carta si ritira alle Poste.",
      "Tieni d'occhio gli avvisi del tuo Comune.",
    ],
    where: "Il tuo Comune · «Carta Dedicata a te»",
    match: (a) =>
      a.people < 3 ? "no" : a.isee === null ? "isee" : a.isee <= 15_000 ? "maybe" : "no",
  },
  {
    key: "psicologo",
    title: "Bonus psicologo",
    amount: "Fino a 1.500 € per le sedute, secondo l'ISEE.",
    who: "Con ISEE fino a 50.000 €.",
    how: [
      "Domanda all'INPS nella finestra dell'anno (di solito pochi mesi): poi si sceglie uno psicologo aderente.",
    ],
    where: "INPS · «Contributo sessioni di psicoterapia»",
    match: (a) => under(a, 50_000),
  },
  {
    key: "adi",
    title: "Assegno di inclusione",
    amount: "Un sostegno al mese, secondo il reddito e la famiglia.",
    who: "Famiglie con minori, persone con disabilità, over 60 o seguite dai servizi sociali, con ISEE fino a circa 10.140 €.",
    how: ["Domanda all'INPS o a un patronato, poi un patto con i servizi sociali."],
    where: "INPS · «Assegno di inclusione»",
    match: (a) =>
      a.childrenUnder21 > 0 || (a.age !== null && a.age >= 60) ? under(a, 10_140) : "no",
  },
  {
    key: "carta-acquisti",
    title: "Carta acquisti",
    amount: "80 € ogni due mesi, su una carta per spesa e bollette.",
    who: "Per chi ha più di 65 anni o per i bambini sotto i 3 anni, con ISEE molto basso (circa 8.100 €).",
    how: ["Domanda alle Poste con il modulo e l'ISEE."],
    where: "INPS · «Carta acquisti»",
    match: (a) => ((a.age !== null && a.age >= 65) || a.childUnder3 ? under(a, 8_117) : "no"),
  },
  {
    key: "carta-cultura",
    title: "Carta della cultura giovani",
    amount:
      "500 € per libri, cinema, musica, corsi (e altri 500 € con la Carta del merito per chi si diploma con 100).",
    who: "Per chi compie 18 anni, con ISEE fino a 35.000 €.",
    how: ["Si chiede l'anno dopo i 18 anni, con SPID o CIE, sul sito dedicato."],
    where: "Ministero della Cultura · «Carta della cultura giovani»",
    match: (a) => (a.turning18 ? under(a, 35_000) : "no"),
  },
  {
    key: "ticket",
    title: "Esenzione dal ticket per reddito",
    amount: "Niente ticket su visite ed esami.",
    who: "Bambini sotto i 6 anni e over 65 con reddito familiare fino a 36.151,98 €; chi ha perso il lavoro con reddito basso; pensionati sociali.",
    how: ["Si chiede alla ASL o al medico di base, con un'autocertificazione."],
    where: "La tua ASL · «Esenzione per reddito»",
    match: (a) => (a.childUnder6 || (a.age !== null && a.age >= 65) || a.workless ? "maybe" : "no"),
  },
  {
    key: "canone-rai",
    title: "Esenzione dal canone RAI",
    amount: "Il canone in bolletta non si paga.",
    who: "Da 75 anni, con reddito (insieme al coniuge) fino a 8.000 €.",
    how: ["Una dichiarazione sostitutiva all'Agenzia delle Entrate."],
    where: "Agenzia delle Entrate · «Canone TV, esenzione over 75»",
    match: (a) => (a.age !== null && a.age >= 75 ? "maybe" : "no"),
  },
  {
    key: "affitto",
    title: "Contributo per l'affitto",
    amount: "Una parte del canone, secondo il bando.",
    who: "Inquilini con ISEE basso: le soglie le decidono Regione e Comune ogni anno.",
    how: ["Segui i bandi del tuo Comune: di solito escono una volta l'anno."],
    where: "Il tuo Comune · «Contributo affitto»",
    match: (a) => (a.rent ? (a.isee === null ? "isee" : a.isee <= 20_000 ? "maybe" : "no") : "no"),
  },
];

const ORDER: Record<BonusMatch, number> = { yes: 0, maybe: 1, isee: 2, no: 3 };

/** The catalog sorted by how likely each bonus is, with its match. */
export function findBonuses(answers: BonusAnswers) {
  return BONUSES.map((bonus) => ({ bonus, match: bonus.match(answers) })).sort(
    (a, b) => ORDER[a.match] - ORDER[b.match],
  );
}
