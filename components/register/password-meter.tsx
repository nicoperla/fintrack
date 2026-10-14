import { Check } from "lucide-react";
import {
  hasCommonPattern,
  passwordChecks,
  passwordStrength,
  STRENGTH_LABELS,
} from "@/lib/auth/password-rules";
import { cn } from "@/lib/utils";

export const STRENGTH_COLORS = [
  "",
  "bg-amber-400",
  "bg-lime-400",
  "bg-emerald-400",
  "bg-emerald-300 shadow-[0_0_8px_rgb(110_231_183/0.8)]",
];

const TIPS = [
  "",
  "Va bene così, ma un'altra parola la renderebbe molto più forte.",
  "Buona. Ancora qualche carattere e diventa forte.",
  "Forte: difficile da indovinare.",
  "Perfetta: difficile da indovinare, facile da ricordare.",
];

/** The password rules ticked off while typing, with a strength bar on top. */
export function PasswordMeter({
  password,
  name,
  email,
  hideTip = false,
}: {
  password: string;
  name: string;
  email: string;
  /** While an error is shown under the field, a cheerful tip would contradict it. */
  hideTip?: boolean;
}) {
  const checks = passwordChecks(password, { name, email });
  const strength = passwordStrength(password, { name, email });
  const tip =
    strength === 1 && hasCommonPattern(password)
      ? "Contiene una sequenza molto comune, come «1234» o «password»: è la prima cosa che si prova a indovinare."
      : TIPS[strength];

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300",
                strength >= n ? STRENGTH_COLORS[strength] : "bg-white/10",
              )}
            />
          ))}
        </div>
        <span className="text-muted-foreground w-20 text-right text-xs">
          {password ? STRENGTH_LABELS[strength] : ""}
        </span>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {checks.map((check) => (
          <li
            key={check.id}
            className={cn(
              "flex items-center gap-2 transition-colors duration-200",
              check.ok ? "text-emerald-400" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                check.ok ? "scale-100 border-emerald-400 bg-emerald-400/15" : "border-white/20",
              )}
            >
              {check.ok && <Check className="size-3" aria-hidden />}
            </span>
            {check.label}
            <span className="sr-only">{check.ok ? " (fatto)" : " (da fare)"}</span>
          </li>
        ))}
      </ul>
      {tip && !hideTip && <p className="text-muted-foreground text-xs">{tip}</p>}
    </div>
  );
}
