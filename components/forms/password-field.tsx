"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FieldShell } from "@/components/forms/form-field";

/** A password input with a button to show what was typed (handy on phones). */
export function PasswordField({
  label,
  name,
  errors,
  hint,
  ...props
}: { label: string; name: string; errors?: string[]; hint?: string } & Omit<
  ComponentProps<typeof Input>,
  "type"
>) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell label={label} name={name} errors={errors} hint={hint}>
      {(a11y) => (
        <div className="relative">
          <Input
            name={name}
            type={visible ? "text" : "password"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="pr-9"
            {...a11y}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Nascondi la password" : "Mostra la password"}
            aria-pressed={visible}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg outline-none focus-visible:ring-3"
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      )}
    </FieldShell>
  );
}
