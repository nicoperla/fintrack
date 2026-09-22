import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Badge variant="secondary">Fase 0 — Setup progetto</Badge>
        <h1 className="text-4xl font-bold tracking-tight">FinTrack</h1>
        <p className="text-muted-foreground max-w-md">
          Scheletro dell&apos;app pronto: Next.js, TypeScript, Tailwind, shadcn/ui e Prisma sono
          collegati e funzionanti.
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Pipeline verificata</CardTitle>
          <CardDescription>Se vedi questa card stilizzata, il setup funziona.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full">Inizia il tracking</Button>
        </CardContent>
      </Card>
    </main>
  );
}
