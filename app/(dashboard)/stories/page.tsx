import { requireSpace } from "@/lib/auth/session";
import { getStory } from "@/lib/data/stories";
import { EmptyState } from "@/components/empty-state";
import { StoryViewer } from "@/components/stories/story-viewer";

export const metadata = { title: "Il mese in storie · FinTrack" };

type SearchParams = { month?: string | string[] };

export default async function StoriesPage({ searchParams }: { searchParams: SearchParams }) {
  const space = await requireSpace();
  const month = typeof searchParams.month === "string" ? searchParams.month : undefined;
  const page = await getStory(space.id, month);

  if (!page) {
    return (
      <EmptyState
        illustration="celebrate"
        title="Ancora nessuna storia"
        description="Registra i movimenti del mese: alla fine te lo racconto in storie, come un recap."
      />
    );
  }
  // Keyed by month: moving to another month starts again from the first slide.
  return <StoryViewer key={page.story.month} page={page} />;
}
