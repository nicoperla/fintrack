import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type FieldShellProps = {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
  children: (a11y: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
};

export function FieldShell({ label, name, errors, hint, children }: FieldShellProps) {
  const error = errors?.[0];
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children({
        id: name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${name}-hint`} className="text-muted-foreground text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type Common = { label: string; name: string; errors?: string[]; hint?: string };

export function FormField({
  label,
  name,
  errors,
  hint,
  ...props
}: Common & ComponentProps<typeof Input>) {
  return (
    <FieldShell label={label} name={name} errors={errors} hint={hint}>
      {(a11y) => <Input name={name} {...a11y} {...props} />}
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  errors,
  hint,
  className,
  ...props
}: Common & ComponentProps<typeof NativeSelect>) {
  return (
    <FieldShell label={label} name={name} errors={errors} hint={hint}>
      {(a11y) => (
        <NativeSelect name={name} className={className ?? "w-full"} {...a11y} {...props} />
      )}
    </FieldShell>
  );
}

export function TextareaField({
  label,
  name,
  errors,
  hint,
  ...props
}: Common & ComponentProps<typeof Textarea>) {
  return (
    <FieldShell label={label} name={name} errors={errors} hint={hint}>
      {(a11y) => <Textarea name={name} {...a11y} {...props} />}
    </FieldShell>
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
