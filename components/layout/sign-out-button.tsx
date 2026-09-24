"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOut data-icon="inline-start" />
      Esci
    </Button>
  );
}
