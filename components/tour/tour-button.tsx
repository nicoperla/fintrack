"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startTour } from "@/components/tour/product-tour";

/** The "?" in the header: replays the guided tour from any page. */
export function TourButton() {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Guida di Orbitly"
      title="Guida di Orbitly"
      data-tour="tour-button"
      onClick={startTour}
    >
      <CircleHelp />
    </Button>
  );
}
