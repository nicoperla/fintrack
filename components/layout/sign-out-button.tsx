"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        // Pages cached for offline use contain this account's finances.
        navigator.serviceWorker?.controller?.postMessage("clear-pages");
        signOut({ callbackUrl: "/login" });
      }}
    >
      <LogOut data-icon="inline-start" />
      Esci
    </Button>
  );
}
