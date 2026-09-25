import { Illustration, type IllustrationName } from "@/components/illustrations";

export function EmptyState({
  illustration,
  title,
  description,
  action,
}: {
  illustration: IllustrationName;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card/50 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
      <Illustration name={illustration} />
      <h2 className="mt-1 text-lg font-medium">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm text-balance">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
