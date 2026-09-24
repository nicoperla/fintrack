import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
};

export function FormField({ label, name, errors, ...inputProps }: FormFieldProps) {
  const errorId = `${name}-error`;
  const error = errors?.[0];
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
          : "rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
      }
    >
      {children}
    </p>
  );
}
