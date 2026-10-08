import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProPrice } from "@/lib/billing/stripe";
import { formatCurrency } from "@/lib/format";
import { Landing } from "@/components/landing/landing";

const description =
  "L'app italiana per i soldi di casa: tiene i conti in tre secondi anche a voce, ti dice quanto puoi spendere davvero e trova i soldi che stai perdendo, dal rimborso del 730 agli abbonamenti dimenticati, con le lettere per riprenderteli. Gratis per iniziare.";

export const metadata: Metadata = {
  title: "FinTrack · I tuoi soldi, finalmente chiari",
  description,
  openGraph: {
    title: "FinTrack · I tuoi soldi, finalmente chiari",
    description,
    type: "website",
    locale: "it_IT",
    images: [{ url: "/landing/video-desktop-poster.jpg", width: 1280, height: 800 }],
  },
  twitter: { card: "summary_large_image" },
};

type SearchParams = { account?: string | string[] };

/** Signed in: straight to the dashboard. Otherwise, the landing page. */
export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  if (await getSession()) redirect("/dashboard");
  const price = await getProPrice();
  return (
    <Landing
      deleted={searchParams.account === "eliminato"}
      priceLabel={
        price
          ? `${formatCurrency(price.amount, price.currency)} / ${price.interval === "year" ? "anno" : "mese"}`
          : null
      }
    />
  );
}
