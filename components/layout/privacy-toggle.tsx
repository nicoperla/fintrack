"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpaceInfo } from "@/components/currency-provider";

/** Hides every balance and amount in one tap, e.g. to open the app in public. */
export function PrivacyToggle() {
  const { hidden, setHidden } = useSpaceInfo();
  const label = hidden ? "Mostra gli importi" : "Nascondi gli importi";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={hidden}
      onClick={() => setHidden(!hidden)}
    >
      {hidden ? <EyeOff /> : <Eye />}
    </Button>
  );
}
