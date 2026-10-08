/*
 * The public prices "Il Tariffometro" compares with, each with its source and period. Update them
 * when a new edition comes out: IVASS every quarter, Banca d'Italia every December, ARERA at the
 * start of every quarter. TARIFF_DATA_CHECKED_AT is shown next to the comparisons.
 */

export const TARIFF_DATA_CHECKED_AT = "ottobre 2026";

/** Percentiles: the value below which that share of people pays (e.g. 50: the median). */
export type Percentiles = Partial<Record<number, number>>;

// ---------- RC auto: IVASS, IPER survey ----------

/** The percentiles stored for each province, in the order of `p` below. */
export const CAR_PROVINCE_PERCENTILES = [5, 10, 25, 50, 75, 95, 99] as const;

export type ProvinceCarPrices = { name: string; mean: number; p: number[] };

/**
 * The yearly RC auto premium actually paid for private cars in the 2nd quarter of 2026, by
 * province (IVASS, Comunicazione statistica n. 7/2026, tavola A12). Keyed by the province's
 * abbreviation; Sardinia is split into the four historical provinces, as IVASS does.
 */
export const CAR_PROVINCES: Record<string, ProvinceCarPrices> = {
  AG: { name: "Agrigento", mean: 350.6, p: [164.5, 195.5, 239.1, 306.7, 410, 680.2, 1050.3] },
  AL: { name: "Alessandria", mean: 373.9, p: [173.5, 201.9, 254.8, 325.9, 432, 741, 1147.1] },
  AN: { name: "Ancona", mean: 439.6, p: [208, 239.7, 302.9, 390, 510, 838.1, 1300] },
  AO: { name: "Aosta", mean: 340.3, p: [169.2, 194.1, 235.9, 299.8, 394.4, 653.4, 979.4] },
  AR: { name: "Arezzo", mean: 383.4, p: [182.6, 214, 269.4, 343.1, 447, 706.5, 1093.7] },
  AP: { name: "Ascoli Piceno", mean: 387.8, p: [188.2, 217.4, 275.2, 350, 449.3, 705.2, 1100.1] },
  AT: { name: "Asti", mean: 365.4, p: [165.6, 196.1, 244.9, 319.1, 424.5, 721.4, 1134.3] },
  AV: { name: "Avellino", mean: 381.1, p: [169.4, 200.3, 252.2, 336.3, 454.1, 742.7, 1125.4] },
  BA: { name: "Bari", mean: 411.3, p: [183.5, 215, 275.1, 363.4, 484.9, 797, 1277.1] },
  BT: {
    name: "Barletta-Andria-Trani",
    mean: 425.2,
    p: [193, 225.1, 287.1, 377, 501.3, 822.1, 1257],
  },
  BL: { name: "Belluno", mean: 358.2, p: [182.2, 209.2, 258.1, 320, 412.3, 661.8, 1036.5] },
  BN: { name: "Benevento", mean: 385.1, p: [189.7, 216.1, 270.3, 342.4, 452.1, 710.3, 1050.4] },
  BG: { name: "Bergamo", mean: 384.9, p: [172.8, 201.9, 259.8, 338.9, 449.5, 744.8, 1197.3] },
  BI: { name: "Biella", mean: 340.8, p: [157.6, 182.3, 231.3, 300, 397.5, 664.4, 1024.1] },
  BO: { name: "Bologna", mean: 440.7, p: [195.4, 223.7, 290.5, 389.1, 518.5, 861.4, 1389.1] },
  BZ: { name: "Bolzano", mean: 389.3, p: [182, 215.8, 277.1, 352.7, 450.7, 734.2, 1072.6] },
  BS: { name: "Brescia", mean: 393.8, p: [176.5, 207.1, 265.6, 346.8, 460.6, 770.9, 1208.5] },
  BR: { name: "Brindisi", mean: 422.2, p: [185.8, 221.3, 284, 369.8, 493.1, 823.6, 1303] },
  CA: { name: "Cagliari", mean: 420.9, p: [195.2, 222.5, 277.9, 364, 489.4, 843.9, 1340] },
  CL: { name: "Caltanissetta", mean: 379.3, p: [156.5, 193.5, 248, 326.9, 447.2, 779.7, 1158] },
  CB: { name: "Campobasso", mean: 331.4, p: [155.5, 182.4, 230, 294.1, 386.6, 620.9, 982.2] },
  CE: { name: "Caserta", mean: 534.3, p: [234.5, 277.7, 357.9, 472.3, 629.3, 1049.2, 1581.8] },
  CT: { name: "Catania", mean: 435, p: [191.3, 222.8, 286.1, 379, 510.4, 874.5, 1333.3] },
  CZ: { name: "Catanzaro", mean: 367.7, p: [147.3, 186.6, 241, 323.3, 435.6, 721, 1155.1] },
  CH: { name: "Chieti", mean: 362.1, p: [170.9, 200, 250.5, 322.7, 421.7, 679.2, 1068.6] },
  CO: { name: "Como", mean: 412, p: [184.9, 213.3, 279.2, 367, 483.9, 796.5, 1241.9] },
  CS: { name: "Cosenza", mean: 348.4, p: [146.8, 181.8, 235.9, 305.6, 412.1, 681.4, 1034.3] },
  CR: { name: "Cremona", mean: 374.6, p: [171.8, 201.4, 254.9, 329.4, 432.3, 721.9, 1165.5] },
  KR: { name: "Crotone", mean: 431.3, p: [167, 208, 267.8, 361.7, 509.9, 910.9, 1500.7] },
  CN: { name: "Cuneo", mean: 358, p: [179, 204.2, 253.9, 317.8, 410.6, 665.8, 1047.4] },
  EN: { name: "Enna", mean: 312.3, p: [126.1, 156, 209.4, 270.6, 365.1, 624.1, 950.8] },
  FM: { name: "Fermo", mean: 416.6, p: [194, 230.4, 297.8, 377.7, 484.2, 765.1, 1171.7] },
  FE: { name: "Ferrara", mean: 391.3, p: [181.7, 210.3, 268.6, 347.9, 456.7, 746.5, 1186.4] },
  FI: { name: "Firenze", mean: 507, p: [230, 271.9, 348.1, 452.3, 594, 964.4, 1513.8] },
  FG: { name: "Foggia", mean: 452.7, p: [198.3, 226.6, 295.3, 391.7, 534.6, 920.2, 1448.8] },
  FC: { name: "Forlì-Cesena", mean: 399.2, p: [183, 212.5, 273.8, 355.4, 467.4, 764.2, 1225.2] },
  FR: { name: "Frosinone", mean: 401.6, p: [181.2, 212.7, 272.1, 354.5, 468.7, 779.9, 1236.2] },
  GE: { name: "Genova", mean: 483.5, p: [206.5, 243.9, 316, 419, 567, 990.5, 1549.1] },
  GO: { name: "Gorizia", mean: 343.5, p: [162.2, 188.7, 232.8, 297.9, 392.7, 677.1, 1129.6] },
  GR: { name: "Grosseto", mean: 409.4, p: [191, 219, 275.1, 358.8, 478.8, 803.1, 1269.3] },
  IM: { name: "Imperia", mean: 388.2, p: [170.4, 202.9, 261.6, 343.2, 455.1, 748.1, 1170.5] },
  IS: { name: "Isernia", mean: 353.1, p: [167, 199, 248.9, 314.1, 410.9, 655, 983] },
  AQ: { name: "L'Aquila", mean: 375.1, p: [174.2, 206.9, 257.7, 332, 433.2, 722.1, 1147.6] },
  SP: { name: "La Spezia", mean: 464.1, p: [213.2, 249.3, 315, 406.8, 534.6, 916, 1478.3] },
  LT: { name: "Latina", mean: 472.9, p: [199.6, 239.4, 315.1, 416.4, 556.2, 937.3, 1490.1] },
  LE: { name: "Lecce", mean: 376.1, p: [169.8, 203.4, 256.9, 331.2, 440, 719.8, 1116.3] },
  LC: { name: "Lecco", mean: 385.8, p: [175.9, 205.5, 263.1, 343.4, 451.4, 735.2, 1182.5] },
  LI: { name: "Livorno", mean: 451, p: [209.4, 242, 303.8, 394.4, 530, 877.6, 1368] },
  LO: { name: "Lodi", mean: 380, p: [169.1, 198.9, 256.1, 336.8, 442.8, 740.6, 1190.3] },
  LU: { name: "Lucca", mean: 496.5, p: [228.5, 271.3, 341.5, 441.3, 580, 955.7, 1489.8] },
  MC: { name: "Macerata", mean: 424.7, p: [199, 232.6, 297, 380, 491.8, 800, 1256.5] },
  MN: { name: "Mantova", mean: 363.7, p: [168, 197.3, 247.7, 319.4, 421.9, 709.7, 1107.6] },
  MS: { name: "Massa-Carrara", mean: 517, p: [232.7, 276, 352, 456, 605.6, 991, 1570.3] },
  MT: { name: "Matera", mean: 355.9, p: [158.2, 192.6, 241.9, 315.5, 412.4, 682.2, 1076.9] },
  ME: { name: "Messina", mean: 415.9, p: [172.9, 210, 272.5, 367.7, 491.9, 821.3, 1292.9] },
  MI: { name: "Milano", mean: 412.1, p: [172.3, 202, 265, 356.4, 486, 843.3, 1347.3] },
  MO: { name: "Modena", mean: 423.1, p: [186.4, 218, 284.8, 375.8, 499.5, 816.1, 1302.1] },
  MB: {
    name: "Monza e della Brianza",
    mean: 402.4,
    p: [176.2, 203.9, 267.2, 353.6, 474.1, 791.7, 1250.7],
  },
  NA: { name: "Napoli", mean: 595.5, p: [261.5, 314, 412.3, 534.3, 702.8, 1136, 1637.9] },
  NO: { name: "Novara", mean: 359, p: [160.9, 191.9, 239.9, 311.5, 414.4, 709.1, 1152.2] },
  NU: { name: "Nuoro", mean: 377.4, p: [171.1, 205.6, 253.2, 332.4, 443.2, 734.4, 1108] },
  OR: { name: "Oristano", mean: 315.6, p: [151, 176.5, 220.7, 279.8, 365.1, 600.5, 878.8] },
  PD: { name: "Padova", mean: 409.4, p: [188.7, 218, 280.6, 366.2, 479.6, 776, 1220.1] },
  PA: { name: "Palermo", mean: 416.6, p: [183, 217.2, 275.4, 361, 489.1, 834.9, 1310.9] },
  PR: { name: "Parma", mean: 408.4, p: [189, 218.5, 277.8, 363, 478.1, 780.9, 1228.7] },
  PV: { name: "Pavia", mean: 391.7, p: [175.3, 203.7, 261.4, 343.2, 456, 776.1, 1255.9] },
  PG: { name: "Perugia", mean: 411, p: [197.8, 228, 287.2, 366.1, 476, 774, 1222] },
  PU: {
    name: "Pesaro e Urbino",
    mean: 404.5,
    p: [196.9, 221.8, 284.7, 362.8, 470.2, 758.8, 1191.6],
  },
  PE: { name: "Pescara", mean: 413, p: [186.7, 216.4, 277.6, 366.5, 485.6, 798.9, 1244.3] },
  PC: { name: "Piacenza", mean: 404.2, p: [180.6, 212.9, 273.2, 358.7, 475.4, 779.9, 1229.4] },
  PI: { name: "Pisa", mean: 485.5, p: [225.2, 261.7, 334.1, 430, 568.5, 936.2, 1432.2] },
  PT: { name: "Pistoia", mean: 514.1, p: [239.3, 284, 357.1, 461.2, 599, 963.8, 1462.8] },
  PN: { name: "Pordenone", mean: 333.9, p: [160.7, 186.6, 233.1, 296.2, 388.1, 629.1, 966.9] },
  PZ: { name: "Potenza", mean: 309.8, p: [138.8, 169.4, 213.4, 272.9, 359.9, 594, 957.2] },
  PO: { name: "Prato", mean: 590.5, p: [283, 324.4, 407, 526.8, 690.5, 1132.1, 1661.7] },
  RG: { name: "Ragusa", mean: 401.6, p: [179.9, 212.5, 263.8, 342, 463.5, 809.1, 1378.2] },
  RA: { name: "Ravenna", mean: 427.1, p: [196.8, 225, 292.9, 382.9, 500.8, 812.4, 1265.3] },
  RC: {
    name: "Reggio Calabria",
    mean: 414.9,
    p: [161.8, 204.8, 270.8, 370.2, 498.3, 817.2, 1244.6],
  },
  RE: {
    name: "Reggio nell'Emilia",
    mean: 416.7,
    p: [190, 219.6, 284.8, 370.7, 490, 791.7, 1226.6],
  },
  RI: { name: "Rieti", mean: 445.2, p: [201.9, 239.1, 305.7, 395, 521.5, 847.8, 1356.9] },
  RN: { name: "Rimini", mean: 428.6, p: [190.7, 223.5, 291.9, 379.9, 502, 824.8, 1324.2] },
  RM: { name: "Roma", mean: 504.7, p: [205.7, 243.6, 322.1, 434, 598.4, 1048.3, 1638.4] },
  RO: { name: "Rovigo", mean: 370.4, p: [179.3, 205.9, 258.2, 328, 423.7, 712.6, 1131.4] },
  SA: { name: "Salerno", mean: 444.2, p: [203.2, 232.6, 299.4, 393.3, 520.2, 864.2, 1324.2] },
  SS: { name: "Sassari", mean: 394.5, p: [169.3, 204.4, 258.2, 343.8, 462.1, 793.5, 1249.8] },
  SV: { name: "Savona", mean: 376.8, p: [171.1, 203.1, 257, 339.4, 443.3, 703.9, 1070.5] },
  SI: { name: "Siena", mean: 371.9, p: [182.9, 209.2, 259, 331.6, 432.5, 692.1, 1067.3] },
  SR: { name: "Siracusa", mean: 399.6, p: [177.5, 208.7, 262.6, 343.1, 464.1, 802.6, 1321] },
  SO: { name: "Sondrio", mean: 365, p: [176.6, 204.7, 258.8, 329.3, 421.6, 670, 1073.1] },
  TA: { name: "Taranto", mean: 415.2, p: [178.5, 214.9, 274.8, 362, 486, 824.1, 1291.5] },
  TE: { name: "Teramo", mean: 381.3, p: [170, 208, 266.7, 344.8, 448, 704.3, 1071.9] },
  TR: { name: "Terni", mean: 414.8, p: [191.6, 223.2, 284.8, 366.7, 485.8, 793.7, 1212.7] },
  TO: { name: "Torino", mean: 454, p: [197.6, 228.7, 297.2, 394.8, 534.4, 912.7, 1430.1] },
  TP: { name: "Trapani", mean: 375.4, p: [170, 203.7, 254.5, 329.6, 438.3, 727.4, 1180.5] },
  TN: { name: "Trento", mean: 347.6, p: [169.4, 195.6, 244.8, 310, 400.3, 658.9, 1013.6] },
  TV: { name: "Treviso", mean: 411.2, p: [194.8, 224.9, 285.5, 368.9, 478.8, 773.2, 1220.9] },
  TS: { name: "Trieste", mean: 362.7, p: [161.7, 189.8, 242.1, 318.8, 425, 707.9, 1137.2] },
  UD: { name: "Udine", mean: 343.5, p: [169.5, 193.7, 242.5, 308.3, 398.8, 640.9, 954.4] },
  VA: { name: "Varese", mean: 397.3, p: [176.4, 204.3, 266.8, 352.8, 469.1, 768.1, 1220.7] },
  VE: { name: "Venezia", mean: 424.7, p: [196.3, 224.2, 291.2, 379.5, 495, 805.8, 1278.2] },
  VB: {
    name: "Verbano-Cusio-Ossola",
    mean: 347.9,
    p: [167.1, 193.3, 243.4, 312.7, 406.4, 637.7, 1021.2],
  },
  VC: { name: "Vercelli", mean: 342.6, p: [161, 188.9, 233.6, 298.9, 393.4, 658.9, 1148.2] },
  VR: { name: "Verona", mean: 386.5, p: [180.1, 208.7, 267.3, 345.7, 450.8, 730.6, 1122] },
  VV: { name: "Vibo Valentia", mean: 409.8, p: [157.5, 199, 265.7, 364, 491.1, 807.2, 1289.3] },
  VI: { name: "Vicenza", mean: 388.7, p: [180.8, 212.4, 268.9, 346.5, 450.7, 735.8, 1157.1] },
  VT: { name: "Viterbo", mean: 378, p: [179.5, 208.7, 261.1, 335.4, 440, 712, 1104.8] },
};

export const CAR_INSURANCE = {
  period: "2° trimestre 2026",
  source: "IVASS, rilevazione IPER sui premi RC auto pagati (Comunicazione statistica n. 7/2026)",
  url: "https://www.ivass.it/pubblicazioni-e-statistiche/statistiche/comunicazioni-statistiche/2026/cs-n-7-2026/index.html",
  /** National average by the age of the policyholder (tavola A3). */
  byAge: { "fino-24": 937.4, "25-34": 556.3, "35-44": 420.9, "45-59": 413.4, "60-oltre": 390.7 },
  /** National average by bonus-malus class (tavola A5): 87% of the policies are in class 1. */
  byClass: { first: 386.5, "2-3": 581.5, "4-10": 613.2, "11-18": 917.6 },
} as const;

export const AGE_BANDS = ["fino-24", "25-34", "35-44", "45-59", "60-oltre"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  "fino-24": "Fino a 24 anni",
  "25-34": "Da 25 a 34 anni",
  "35-44": "Da 35 a 44 anni",
  "45-59": "Da 45 a 59 anni",
  "60-oltre": "60 anni o più",
};

// ---------- Current accounts: Banca d'Italia survey ----------

export const BANK_ACCOUNT_KINDS = ["tradizionale", "online", "postale"] as const;
export type BankAccountKind = (typeof BANK_ACCOUNT_KINDS)[number];

/**
 * What a year of a current account cost families in 2024, from their statements: fees, cards,
 * transfers and withdrawals, without the stamp duty (Banca d'Italia, tavola A5).
 */
export const BANK_ACCOUNTS = {
  year: 2024,
  source: "Banca d'Italia, Indagine sul costo dei conti correnti nel 2024 (dicembre 2025)",
  url: "https://www.bancaditalia.it/pubblicazioni/indagine-costo-cc/indagine-costo-cc2025/index.html",
  kinds: {
    tradizionale: {
      label: "In banca, con la filiale",
      short: "conti in filiale",
      mean: 101.1,
      p: { 10: 7.2, 25: 39.5, 50: 82.3, 75: 132.9, 90: 203 } as Percentiles,
    },
    online: {
      label: "Online",
      short: "conti online",
      mean: 30.6,
      p: { 10: 0, 25: 1, 50: 14, 75: 39.3, 90: 90 } as Percentiles,
    },
    postale: {
      label: "Alle Poste",
      short: "conti postali",
      mean: 71.6,
      p: { 10: 18.5, 25: 46, 50: 66.3, 75: 91.4, 90: 123.8 } as Percentiles,
    },
  } satisfies Record<
    BankAccountKind,
    { label: string; short: string; mean: number; p: Percentiles }
  >,
  /** The yearly stamp duty on accounts whose average balance is above 5,000 €: a tax, not a fee. */
  stampDuty: { yearly: 34.2, threshold: 5000 },
};

// ---------- Electricity: ARERA ----------

/**
 * The reference price ARERA sets every quarter for vulnerable customers, taxes included, in € per
 * kWh: what a typical household (2,000 kWh a year, 3 kW) pays for each kWh, all in.
 */
export const ELECTRICITY = {
  source: "ARERA, prezzo di riferimento per i clienti vulnerabili, tasse incluse",
  url: "https://www.arera.it",
  typicalKwh: 2000,
  typicalKw: 3,
  quarters: [
    { from: "2025-10-01", to: "2025-12-31", price: 0.2875 },
    { from: "2026-01-01", to: "2026-03-31", price: 0.2797 },
    { from: "2026-04-01", to: "2026-06-30", price: 0.3024 },
    { from: "2026-07-01", to: "2026-09-30", price: 0.3163 },
    { from: "2026-10-01", to: "2026-12-31", price: 0.4343 },
  ],
} as const;

// ---------- Where to look for a better price: public, free comparators ----------

export const COMPARATORS = {
  car: { name: "Preventivass", url: "https://www.preventivass.it/home" },
  electricity: { name: "Portale Offerte", url: "https://www.ilportaleofferte.it" },
} as const;
