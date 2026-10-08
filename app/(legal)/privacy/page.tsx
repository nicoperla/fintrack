import Link from "next/link";
import { ContactLine, LegalDocument } from "@/components/marketing/legal-document";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Privacy · FinTrack" };

export default function PrivacyPage() {
  return (
    <LegalDocument title="Informativa sulla privacy">
      <p>
        FinTrack è un&apos;app per gestire le finanze personali. Questa pagina spiega quali dati
        trattiamo, perché, con chi li condividiamo e come puoi esercitare i tuoi diritti ai sensi
        del Regolamento UE 2016/679 (GDPR).
      </p>

      <section>
        <h2>Titolare del trattamento</h2>
        <p>
          Il titolare è {LEGAL.owner}. Per qualsiasi domanda sulla privacy puoi farlo{" "}
          <ContactLine />.
        </p>
      </section>

      <section>
        <h2>Quali dati trattiamo</h2>
        <ul>
          <li>
            <strong>Account</strong>: nome, email e password (salvata solo in forma cifrata con
            bcrypt, nessuno può leggerla).
          </li>
          <li>
            <strong>Dati finanziari che inserisci</strong>: conti, saldi, movimenti con descrizioni
            e note, categorie, budget, obiettivi, debiti, spazi condivisi e pareggi, lo stipendio
            netto e le ore di lavoro se li imposti, le preferenze del coach, le spese grosse
            dell&apos;anno con giorno dello stipendio e tredicesima per «Lo stipendio vero», e per
            il «Radar dei diritti» fascia di reddito, anno di nascita, contratto d&apos;affitto e
            welfare aziendale. I totali del 730 precompilato che scrivi per il confronto restano nel
            tuo browser: non li riceviamo.
          </li>
          <li>
            <strong>Il Tariffometro</strong>: la provincia e, se lo indichi, quante persone vivono
            in casa; i premi RC auto con scadenza, classe di merito e fascia d&apos;età; il tipo e
            il costo dei conti correnti; le bollette della luce (totale, kWh e periodo). Il
            confronto con le medie pubbliche di IVASS, Banca d&apos;Italia e ARERA lo facciamo noi:
            a quegli enti non inviamo niente.
          </li>
          <li>
            <strong>Il crash test</strong>: se li scrivi e scegli di ricordarli, che lavoro fai, la
            RAL, da quando lavori e l&apos;anno di nascita, per stimare la NASpI. I numeri del mutuo
            che provi lì non li salviamo.
          </li>
          <li>
            <strong>Radiografia dei costi</strong>: per i conti investimenti, i costi che copi dal
            KID (ingresso, uscita, gestione, transazione, performance), il tipo di prodotto e il
            versamento mensile, se lo scrivi.
          </li>
          <li>
            <strong>Il patto</strong>: la categoria, il limite e il periodo, la posta che scegli (il
            nome di chi fa da arbitro, la promessa, la multa e l&apos;obiettivo) e quando l&apos;hai
            pagata. Del link per l&apos;arbitro salviamo solo un&apos;impronta (hash) e quante volte
            viene aperto: chi lo apre vede il limite, la percentuale usata e l&apos;esito, mai i
            movimenti. Il link smette di funzionare un mese dopo la fine del patto.
          </li>
          <li>
            <strong>Il caffè dei conti</strong>, negli spazi condivisi: i mesi di cui avete parlato
            e chi l&apos;ha segnato, le decisioni che scrivete con chi se ne occupa, la scadenza e
            quando è stata fatta. Le vedono tutte le persone dello spazio.
          </li>
          <li>
            <strong>Fascicolo di famiglia</strong>: le note che scrivi (dove sono i documenti, chi
            chiamare). Se crei un link per una persona di fiducia, del link salviamo solo
            un&apos;impronta (hash), la scadenza, per chi l&apos;hai indicato e quante volte viene
            aperto.
          </li>
          <li>
            <strong>Pratiche di «Riprenditeli»</strong>: per le disdette, i rimborsi e i reclami che
            apri, a chi sono rivolti, gli importi, il testo della lettera, le date di invio e di
            scadenza e com&apos;è finita. FinTrack non invia niente al posto tuo. I dati tra
            parentesi quadre, come IBAN e numero cliente, li completi tu nella tua email: non ti
            chiediamo di salvarli.
          </li>
          <li>
            <strong>Dati tecnici</strong>: il cookie di sessione, l&apos;indirizzo IP e l&apos;email
            usati per bloccare i tentativi di accesso ripetuti (conservati al massimo 2 giorni), i
            log tecnici dei fornitori di hosting.
          </li>
          <li>
            <strong>Pagamenti</strong> (solo con FinTrack Pro): li gestisce Stripe. Noi non vediamo
            né salviamo i dati della carta: riceviamo solo lo stato dell&apos;abbonamento.
          </li>
        </ul>
      </section>

      <section>
        <h2>Perché li trattiamo e su quale base</h2>
        <ul>
          <li>
            Fornirti il servizio (account, calcoli, grafici, previsioni, consigli del coach
            calcolati dall&apos;app, email di servizio come reset della password, conferma
            dell&apos;email e inviti): esecuzione del contratto, art. 6.1.b GDPR.
          </li>
          <li>
            Il riepilogo settimanale via email: fa parte del servizio e puoi disattivarlo in
            qualsiasi momento dalle Impostazioni o dal link nell&apos;email.
          </li>
          <li>
            Sicurezza e prevenzione degli abusi (limiti ai tentativi di accesso e alle richieste):
            legittimo interesse, art. 6.1.f GDPR.
          </li>
          <li>Il coach AI: solo con il tuo consenso esplicito, art. 6.1.a GDPR (vedi sotto).</li>
          <li>
            Il confronto anonimo tra utenti del Tariffometro: solo con il consenso esplicito, art.
            6.1.a GDPR (vedi sotto).
          </li>
          <li>
            Abbonamento a pagamento e relativi obblighi fiscali: contratto e obbligo di legge, art.
            6.1.b e 6.1.c GDPR.
          </li>
        </ul>
        <p>
          Non vendiamo i tuoi dati, non mostriamo pubblicità e non facciamo profilazione a fini
          commerciali. I consigli del coach sono calcolati solo per te e solo per mostrarteli.
        </p>
      </section>

      <section id="ai">
        <h2>Il coach AI</h2>
        <p>
          La pagina del coach, i consigli e le risposte rapide sono calcolati da FinTrack sui nostri
          server, senza inviare dati a terzi. Solo la chat con il coach AI usa un fornitore esterno
          di intelligenza artificiale: Groq Inc. oppure Anthropic PBC, negli Stati Uniti. La pagina
          del coach indica quale è in uso.
        </p>
        <p>
          Quando fai una domanda al coach AI inviamo al fornitore la domanda, la conversazione in
          corso e un riepilogo dei dati dello spazio attivo: medie mensili, spese per categoria,
          saldi dei conti, previsione, abbonamenti, budget, obiettivi, debiti, le tue preferenze del
          coach e gli ultimi movimenti (data, importo, descrizione, categoria, conto). Non inviamo
          la tua email né la password.
        </p>
        <p>
          Il fornitore usa questi dati solo per generare la risposta, come responsabile del
          trattamento. Lo facciamo solo dopo che hai premuto «Accetto, attiva il coach AI». Puoi
          revocare il consenso in qualsiasi momento da <Link href="/settings">Impostazioni</Link>:
          da quel momento non inviamo più niente.
        </p>
      </section>

      <section id="confronto">
        <h2>Il confronto anonimo tra utenti</h2>
        <p>
          Il Tariffometro confronta quello che paghi con medie pubbliche. Più avanti mostrerà anche
          quanto pagano le famiglie FinTrack della tua provincia. Per costruire quel confronto
          usiamo solo i dati degli spazi in cui qualcuno ha scelto «Partecipo»: importi del
          Tariffometro, provincia e numero di persone in casa.
        </p>
        <p>
          Agli altri utenti mostreremo solo medie di almeno 20 famiglie, con un piccolo scarto
          casuale: mai nomi, mai i singoli importi. Finché il confronto non parte, questi dati non
          vengono usati per nient&apos;altro. La scelta vale per tutto lo spazio e chiunque ne
          faccia parte può ritirarla dal Tariffometro: da quel momento i dati dello spazio non
          entrano più nelle statistiche.
        </p>
      </section>

      <section>
        <h2>Con chi condividiamo i dati</h2>
        <p>Usiamo questi fornitori, che trattano i dati per nostro conto:</p>
        <ul>
          <li>Vercel Inc. (USA): hosting dell&apos;app; le funzioni girano a Francoforte.</li>
          <li>Neon Inc.: database PostgreSQL, ospitato a Francoforte (UE).</li>
          <li>Resend Inc. (USA): invio delle email.</li>
          <li>Groq Inc. o Anthropic PBC (USA): solo il coach AI, solo con il tuo consenso.</li>
          <li>Stripe (Irlanda/USA): solo i pagamenti di FinTrack Pro.</li>
        </ul>
        <p>
          Il fascicolo di famiglia lo vede anche chi riceve il link che crei tu, fino alla scadenza
          o finché non lo revochi: senza importi, a meno che tu non scelga di mostrarli.
        </p>
        <p>
          I trasferimenti verso gli Stati Uniti avvengono con le garanzie previste dal GDPR (EU-US
          Data Privacy Framework o clausole contrattuali standard). I tassi di cambio arrivano dalla
          Banca Centrale Europea tramite Frankfurter, senza inviare alcun dato personale.
        </p>
        <p>
          Se fai parte di uno spazio condiviso, le altre persone dello spazio vedono i dati dello
          spazio, compresi i movimenti che registri tu: è lo scopo degli spazi condivisi.
        </p>
      </section>

      <section>
        <h2>Per quanto tempo</h2>
        <p>
          Teniamo i dati finché hai un account. Se elimini l&apos;account cancelliamo subito
          profilo, spazi personali e tutti i loro dati; le copie di sicurezza tecniche del database
          si sovrascrivono entro 7 giorni. I movimenti che hai registrato in spazi condivisi con
          altre persone restano a loro, senza il tuo nome; le pratiche di «Riprenditeli» che hai
          aperto lì invece le cancelliamo, perché le lettere sono a tuo nome. I dati di fatturazione
          sono conservati per il tempo previsto dalla legge (10 anni).
        </p>
      </section>

      <section>
        <h2>I tuoi diritti</h2>
        <p>
          Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opporti al
          trattamento basato sul legittimo interesse. Molto lo puoi fare da solo in{" "}
          <Link href="/settings">Impostazioni</Link>:
        </p>
        <ul>
          <li>«Scarica i tuoi dati»: un file con tutti i tuoi dati in formato leggibile (JSON).</li>
          <li>«Elimina account»: cancella account e dati.</li>
          <li>
            Revoca del consenso al coach AI e al confronto anonimo del Tariffometro, disattivazione
            del riepilogo settimanale.
          </li>
        </ul>
        <p>
          Per il resto puoi farlo <ContactLine />. Hai anche diritto di proporre reclamo al Garante
          per la protezione dei dati personali (
          <a href="https://www.garanteprivacy.it" target="_blank" rel="noreferrer">
            garanteprivacy.it
          </a>
          ).
        </p>
      </section>

      <section>
        <h2>Cookie e archiviazione nel browser</h2>
        <p>
          Usiamo solo strumenti tecnici necessari al funzionamento: il cookie di sessione per
          tenerti connesso, un cookie per ricordare la modalità discreta, la memoria del browser per
          il tema chiaro/scuro e per i movimenti registrati offline in attesa di invio. Niente
          cookie di profilazione o di terze parti, quindi non serve un banner di consenso.
        </p>
      </section>

      <section>
        <h2>Sicurezza e minori</h2>
        <p>
          Le connessioni sono cifrate (HTTPS), le password salvate con bcrypt, i link di invito, di
          reset e di conferma salvati solo come impronta crittografica. FinTrack è riservato ai
          maggiorenni.
        </p>
      </section>

      <section>
        <h2>Modifiche</h2>
        <p>
          Se cambiamo questa informativa aggiorniamo la data in alto e, per i cambiamenti
          importanti, te lo segnaliamo nell&apos;app o via email.
        </p>
      </section>
    </LegalDocument>
  );
}
