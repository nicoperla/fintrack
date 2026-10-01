import Link from "next/link";
import { ContactLine, LegalDocument } from "@/components/marketing/legal-document";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Termini di servizio · FinTrack" };

export default function TermsPage() {
  return (
    <LegalDocument title="Termini di servizio">
      <p>
        Questi termini regolano l&apos;uso di FinTrack, fornito da {LEGAL.owner}. Creando un account
        li accetti, insieme all&apos;<Link href="/privacy">informativa sulla privacy</Link>.
      </p>

      <section>
        <h2>Il servizio</h2>
        <p>
          FinTrack ti aiuta a registrare entrate e spese, a pianificare budget e obiettivi e a
          capire le tue abitudini. Il piano gratuito comprende tutte le funzioni tranne la chat con
          il coach AI e i dettagli di Soldi ritrovati (le spese una per una, il dossier 730 e le
          lettere di disdetta), che fanno parte di FinTrack Pro.
        </p>
      </section>

      <section>
        <h2>Non è consulenza finanziaria</h2>
        <p>
          Previsioni, punteggi, consigli, risposte del coach (anche AI) e stime del rimborso 730
          sono calcoli automatici basati sui dati che inserisci, a scopo informativo. Non sono
          consulenza finanziaria, fiscale o sugli investimenti: le regole fiscali cambiano e la
          dichiarazione dei redditi va verificata con il CAF o un professionista. Le decisioni
          restano tue: per scelte importanti rivolgiti a un professionista abilitato. Le risposte
          del coach AI possono contenere errori.
        </p>
      </section>

      <section>
        <h2>Il tuo account</h2>
        <ul>
          <li>Devi essere maggiorenne e indicare un&apos;email che controlli.</li>
          <li>Sei responsabile della password e di ciò che avviene con il tuo account.</li>
          <li>
            Negli spazi condivisi le persone invitate vedono e modificano i dati dello spazio:
            invita solo chi vuoi davvero.
          </li>
          <li>
            Non usare FinTrack per attività illecite, per inviare inviti indesiderati o per
            sovraccaricare il servizio (per esempio con richieste automatiche al coach AI).
          </li>
        </ul>
      </section>

      <section>
        <h2>FinTrack Pro</h2>
        <ul>
          <li>
            Pro è un abbonamento mensile. Il prezzo, IVA inclusa, è indicato prima del pagamento,
            che avviene tramite Stripe.
          </li>
          <li>
            L&apos;abbonamento si rinnova automaticamente ogni mese. Puoi disdirlo quando vuoi da
            Impostazioni → Abbonamento: resta attivo fino alla fine del periodo già pagato.
          </li>
          <li>
            Se sei un consumatore hai 14 giorni dal primo pagamento per recedere e ottenere il
            rimborso: basta chiederlo <ContactLine />.
          </li>
          <li>
            Il coach AI ha un limite giornaliero di domande per persona, indicato nell&apos;app, per
            mantenere il servizio disponibile per tutti.
          </li>
          <li>
            Eventuali cambi di prezzo ti vengono comunicati in anticipo e valgono dal rinnovo
            successivo; puoi disdire prima.
          </li>
        </ul>
      </section>

      <section>
        <h2>I tuoi dati</h2>
        <p>
          I dati che inserisci restano tuoi. Puoi scaricarli o eliminare l&apos;account in qualsiasi
          momento dalle Impostazioni. Come li trattiamo è spiegato nell&apos;
          <Link href="/privacy">informativa sulla privacy</Link>.
        </p>
      </section>

      <section>
        <h2>Disponibilità e responsabilità</h2>
        <p>
          Facciamo il possibile perché FinTrack sia sempre disponibile e corretto, ma il servizio è
          fornito così com&apos;è e può avere interruzioni o errori: tieni una copia dei dati
          importanti con la funzione di esportazione. Nei limiti consentiti dalla legge non
          rispondiamo di danni indiretti derivanti dall&apos;uso del servizio; restano salvi i
          diritti che la legge riconosce ai consumatori.
        </p>
      </section>

      <section>
        <h2>Chiusura dell&apos;account</h2>
        <p>
          Puoi eliminare l&apos;account quando vuoi. Possiamo sospendere gli account che violano
          questi termini, avvisandoti quando possibile.
        </p>
      </section>

      <section>
        <h2>Modifiche e legge applicabile</h2>
        <p>
          Se cambiamo questi termini aggiorniamo la data in alto e, per i cambiamenti importanti, te
          lo comunichiamo in anticipo. Si applica la legge italiana; per i consumatori è competente
          il foro del luogo di residenza. Per qualsiasi domanda puoi farlo <ContactLine />.
        </p>
      </section>
    </LegalDocument>
  );
}
