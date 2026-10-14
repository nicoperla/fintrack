"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Eye, EyeOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/forms/form-field";
import { LogoMark } from "@/components/brand/logo-mark";
import { MemberPass } from "@/components/register/member-pass";
import { PasswordMeter } from "@/components/register/password-meter";
import { PRIORITY_ICONS } from "@/components/register/priorities";
import { registerUser, type LoginStep } from "@/app/(auth)/actions";
import { registerSchema } from "@/lib/validations/auth";
import { passwordRuleProblem, passwordStrength } from "@/lib/auth/password-rules";
import { suggestEmail } from "@/lib/auth/email-suggestion";
import { COACH_PRIORITIES, type CoachPriority } from "@/lib/finance/coach-profile";
import { cn } from "@/lib/utils";

/*
 * Sign-up one question at a time: name, email, password, then what matters to the user and the
 * terms. Each answer is checked as it's given (the same rules the server applies) and lands on
 * the card at the top, so by the last step the user sees the account they're about to create.
 */

const STEPS = ["Nome", "Email", "Password", "Ultimo passo"] as const;
const LAST = STEPS.length - 1;

type Field = "name" | "email" | "password" | "priorities" | "acceptTerms";
/** The step asking each field: where an error from the server sends the user back. */
const STEP_OF: Record<Field, number> = {
  name: 0,
  email: 1,
  password: 2,
  priorities: 3,
  acceptTerms: 3,
};

const PRIORITIES = Object.entries(COACH_PRIORITIES) as [CoachPriority, string][];
const FAILED = "Registrazione non riuscita. Riprova tra poco.";
const EASE = [0.16, 1, 0.3, 1] as const;

const slide = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -28 }),
};

const firstIssue = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? null : (result.error?.issues[0]?.message ?? "Controlla questo campo");

export function RegisterWizard({
  callbackUrl = "/dashboard",
  email: invitedEmail,
}: {
  callbackUrl?: string;
  /** Prefilled from an invitation. */
  email?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [values, setValues] = useState({ name: "", email: invitedEmail ?? "", password: "" });
  const [priorities, setPriorities] = useState<CoachPriority[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState(false);

  const who = { name: values.name, email: values.email };
  const firstName = values.name.trim().split(/\s+/)[0] ?? "";
  const emailOk = registerSchema.shape.email.safeParse(values.email).success;
  const suggestion = suggestEmail(values.email);

  function update(field: "name" | "email" | "password", value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function go(to: number) {
    setDirection(to >= step ? 1 : -1);
    setStep(to);
    setFormError(null);
  }

  /** What stops the user from leaving the current step, if anything. */
  function problemHere(): [Field, string] | null {
    const issue = (field: Field, message: string | null) =>
      message ? ([field, message] as [Field, string]) : null;
    switch (step) {
      case 0:
        return issue("name", firstIssue(registerSchema.shape.name.safeParse(values.name)));
      case 1:
        return issue("email", firstIssue(registerSchema.shape.email.safeParse(values.email)));
      case 2:
        return issue(
          "password",
          firstIssue(registerSchema.shape.password.safeParse(values.password)) ??
            passwordRuleProblem(values.password, who),
        );
      default:
        return issue(
          "acceptTerms",
          firstIssue(registerSchema.shape.acceptTerms.safeParse(acceptTerms)),
        );
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const problem = problemHere();
    if (problem) {
      setErrors((e) => ({ ...e, [problem[0]]: problem[1] }));
      return;
    }
    if (step < LAST) return go(step + 1);

    setPending(true);
    setFormError(null);
    const res = await registerUser({ ...values, acceptTerms, priorities }).catch((): LoginStep => ({
      ok: false,
      error: FAILED,
    }));
    if (!res.ok || !res.ticket) {
      setPending(false);
      const fields = Object.entries(res.fieldErrors ?? {}).flatMap(([field, list]) =>
        list?.[0] && field in STEP_OF ? [[field as Field, list[0]] as const] : [],
      );
      if (fields.length === 0) {
        setFormError(res.error ?? FAILED);
        return;
      }
      // Back to the first answer to fix (a leaked password, an email already registered…).
      setErrors(Object.fromEntries(fields));
      go(Math.min(...fields.map(([field]) => STEP_OF[field])));
      return;
    }

    setCreated(true);
    const login = await signIn("credentials", { ticket: res.ticket, redirect: false });
    if (!login?.ok) {
      router.replace("/login");
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  }

  const loginHref = `/login?${new URLSearchParams({ callbackUrl })}`;

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {created ? (
          <Welcome key="welcome" name={firstName} />
        ) : (
          <motion.div
            key="wizard"
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="grid gap-5"
          >
            <Progress step={step} onBack={() => go(step - 1)} disabled={pending} />
            <MemberPass
              name={values.name}
              email={values.email}
              strength={passwordStrength(values.password, who)}
              priorities={priorities}
            />

            <form onSubmit={onSubmit} noValidate className="grid gap-5">
              {formError && <FormMessage tone="error">{formError}</FormMessage>}

              <AutoHeight>
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={slide}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: EASE }}
                    className="grid gap-4"
                  >
                    {step === 0 && (
                      <>
                        <Question
                          htmlFor="reg-name"
                          title="Come ti chiami?"
                          hint="Ti chiameremo così: anche solo il nome va benissimo."
                        />
                        <div className="grid gap-2">
                          <Input
                            id="reg-name"
                            name="name"
                            autoComplete="given-name"
                            placeholder="Il tuo nome"
                            value={values.name}
                            onChange={(e) => update("name", e.target.value)}
                            maxLength={80}
                            autoFocus
                            className="h-11 text-base md:text-base"
                            {...invalid("name", errors.name)}
                          />
                          <FieldError field="name" message={errors.name} />
                        </div>
                      </>
                    )}

                    {step === 1 && (
                      <>
                        <Question
                          htmlFor="reg-email"
                          title={
                            firstName
                              ? `Piacere, ${firstName}! Qual è la tua email?`
                              : "Qual è la tua email?"
                          }
                          hint={
                            invitedEmail
                              ? "È quella a cui è arrivato l'invito: lasciala così per entrare nello spazio condiviso."
                              : "La userai per accedere e per recuperare la password se la dimentichi."
                          }
                        />
                        <div className="grid gap-2">
                          <div className="relative">
                            <Input
                              id="reg-email"
                              name="email"
                              type="email"
                              inputMode="email"
                              autoComplete="email"
                              autoCapitalize="none"
                              spellCheck={false}
                              placeholder="nome@esempio.it"
                              value={values.email}
                              onChange={(e) => update("email", e.target.value)}
                              autoFocus
                              className="h-11 pr-10 text-base md:text-base"
                              {...invalid("email", errors.email)}
                            />
                            <AnimatePresence>
                              {emailOk && !suggestion && (
                                <motion.span
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-emerald-400"
                                >
                                  <CircleCheck className="size-5" aria-hidden />
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                          <FieldError field="email" message={errors.email} />
                          <div aria-live="polite">
                            {suggestion && (
                              <button
                                type="button"
                                onClick={() => {
                                  update("email", suggestion);
                                  // The button goes away: give the focus back to the field.
                                  document.getElementById("reg-email")?.focus();
                                }}
                                aria-label={`Forse intendevi ${suggestion}? Correggi`}
                                className="hover:bg-muted/60 focus-visible:ring-ring/50 w-full rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-left text-sm outline-none focus-visible:ring-3"
                              >
                                Forse intendevi{" "}
                                <span className="text-foreground font-medium break-all">
                                  {suggestion}
                                </span>
                                ? <span className="text-amber-300 underline">Correggi</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <Question
                          htmlFor="reg-password"
                          title="Scegli una password"
                          hint="Il trucco: una frase di tre o quattro parole. Facile da ricordare, difficile da indovinare."
                        />
                        {/* Lets password managers save the password with the right email. */}
                        <input
                          type="email"
                          name="username"
                          autoComplete="username"
                          value={values.email}
                          readOnly
                          hidden
                        />
                        <div className="grid gap-3">
                          <div className="relative">
                            <Input
                              id="reg-password"
                              name="password"
                              type={showPassword ? "text" : "password"}
                              autoComplete="new-password"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              placeholder="Es. treno lento sul lago"
                              value={values.password}
                              onChange={(e) => update("password", e.target.value)}
                              autoFocus
                              className="h-11 pr-10 text-base md:text-base"
                              {...invalid("password", errors.password)}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              aria-label={
                                showPassword ? "Nascondi la password" : "Mostra la password"
                              }
                              aria-pressed={showPassword}
                              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg outline-none focus-visible:ring-3"
                            >
                              {showPassword ? (
                                <EyeOff className="size-4" aria-hidden />
                              ) : (
                                <Eye className="size-4" aria-hidden />
                              )}
                            </button>
                          </div>
                          <FieldError field="password" message={errors.password} />
                          <PasswordMeter
                            password={values.password}
                            name={values.name}
                            email={values.email}
                            hideTip={Boolean(errors.password)}
                          />
                        </div>
                      </>
                    )}

                    {step === 3 && (
                      <>
                        <FocusedHeading
                          id="reg-priorities"
                          title={
                            firstName
                              ? `${firstName}, cosa conta di più per te?`
                              : "Cosa conta di più per te?"
                          }
                          hint="Scegli quello che vuoi, o niente: il coach e la tua dashboard partiranno da qui."
                        />
                        <div
                          role="group"
                          aria-labelledby="reg-priorities"
                          className="flex flex-wrap gap-2"
                        >
                          {PRIORITIES.map(([key, label]) => {
                            const on = priorities.includes(key);
                            const Icon = PRIORITY_ICONS[key];
                            return (
                              <motion.button
                                key={key}
                                type="button"
                                aria-pressed={on}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  setPriorities((list) =>
                                    on ? list.filter((p) => p !== key) : [...list, key],
                                  )
                                }
                                className={cn(
                                  "focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3",
                                  on
                                    ? "text-foreground border-violet-400/70 bg-violet-500/25 shadow-[0_0_16px_-4px_rgb(167_139_250/0.8)]"
                                    : "border-border text-muted-foreground hover:text-foreground hover:bg-white/5",
                                )}
                              >
                                {on ? (
                                  <Check className="size-3.5 text-violet-300" aria-hidden />
                                ) : (
                                  <Icon className="size-3.5" aria-hidden />
                                )}
                                {label}
                              </motion.button>
                            );
                          })}
                        </div>
                        <div className="grid gap-1 border-t border-white/10 pt-4">
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              name="acceptTerms"
                              checked={acceptTerms}
                              onChange={(e) => {
                                setAcceptTerms(e.target.checked);
                                setErrors((errs) => ({ ...errs, acceptTerms: undefined }));
                              }}
                              className="accent-primary mt-0.5 size-4 shrink-0"
                              {...invalid("acceptTerms", errors.acceptTerms)}
                            />
                            <span className="text-muted-foreground">
                              Ho almeno 18 anni e accetto i{" "}
                              <Link
                                href="/terms"
                                target="_blank"
                                className="text-foreground underline underline-offset-4"
                              >
                                termini di servizio
                              </Link>{" "}
                              e l&apos;
                              <Link
                                href="/privacy"
                                target="_blank"
                                className="text-foreground underline underline-offset-4"
                              >
                                informativa sulla privacy
                              </Link>
                              .
                            </span>
                          </label>
                          <FieldError field="acceptTerms" message={errors.acceptTerms} />
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </AutoHeight>

              <Button type="submit" size="lg" disabled={pending} className="h-11 text-base">
                {step < LAST ? (
                  <>
                    Continua
                    <ArrowRight aria-hidden />
                  </>
                ) : pending ? (
                  <>
                    <LogoMark seconds={1.2} className="size-5" />
                    Creo il tuo account…
                  </>
                ) : (
                  <>
                    <Sparkles aria-hidden />
                    Crea il mio account
                  </>
                )}
              </Button>
            </form>

            <p className="text-muted-foreground text-center text-sm">
              Hai già un account?{" "}
              <Link
                href={loginHref}
                className="text-foreground font-medium underline-offset-4 hover:underline"
              >
                Accedi
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

function invalid(field: Field, message?: string) {
  return message ? { "aria-invalid": true as const, "aria-describedby": `reg-${field}-error` } : {};
}

function FieldError({ field, message }: { field: Field; message?: string }) {
  if (!message) return null;
  return (
    <p id={`reg-${field}-error`} role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

function Question({ htmlFor, title, hint }: { htmlFor: string; title: string; hint: string }) {
  return (
    <div className="grid gap-1">
      <label
        htmlFor={htmlFor}
        className="font-display text-xl font-semibold tracking-tight text-balance"
      >
        {title}
      </label>
      <p className="text-muted-foreground text-sm">{hint}</p>
    </div>
  );
}

/** For the step without a single field: focus moves to its question. */
function FocusedHeading({ id, title, hint }: { id: string; title: string; hint: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="grid gap-1">
      <h2
        ref={ref}
        id={id}
        tabIndex={-1}
        className="font-display text-xl font-semibold tracking-tight text-balance outline-none"
      >
        {title}
      </h2>
      <p className="text-muted-foreground text-sm">{hint}</p>
    </div>
  );
}

function Progress({
  step,
  onBack,
  disabled,
}: {
  step: number;
  onBack: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onBack}
        disabled={disabled || step === 0}
        aria-label="Torna alla domanda precedente"
        className={cn(step === 0 && "invisible")}
      >
        <ArrowLeft />
      </Button>
      <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
        {STEPS.map((label, i) => (
          <span key={label} className="h-1 overflow-hidden rounded-full bg-white/10">
            <motion.span
              className="block h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400"
              initial={false}
              animate={{ width: i <= step ? "100%" : "0%" }}
              transition={{ duration: 0.45, ease: EASE }}
            />
          </span>
        ))}
      </div>
      <p
        className="text-muted-foreground min-w-8 text-right text-xs tabular-nums"
        aria-live="polite"
      >
        <span className="sr-only">Passo </span>
        {step + 1}
        <span aria-hidden>/</span>
        <span className="sr-only"> di </span>
        {STEPS.length}
        <span className="sr-only">: {STEPS[step]}</span>
      </p>
    </div>
  );
}

/** Grows and shrinks smoothly with its content, so the card doesn't jump between steps. */
function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    // The 4px margin keeps the focus rings visible inside the clipped area.
    <motion.div
      animate={{ height }}
      transition={{ duration: 0.25, ease: EASE }}
      className="-m-1 overflow-hidden"
    >
      <div ref={inner} className="p-1">
        {children}
      </div>
    </motion.div>
  );
}

function Welcome({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      role="status"
      className="grid justify-items-center gap-3 py-8 text-center"
    >
      <svg viewBox="0 0 52 52" className="size-16" aria-hidden>
        <defs>
          <linearGradient id="reg-done" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#e879f9" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <motion.circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke="url(#reg-done)"
          strokeWidth="2.5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <motion.path
          d="M15 27l7 7 15-16"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.45, duration: 0.35, ease: EASE }}
        />
      </svg>
      <h2 className="font-display text-xl font-semibold tracking-tight">
        Eccoti su FinTrack{name ? `, ${name}` : ""}!
      </h2>
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <LogoMark seconds={1.2} className="size-5" />
        Sto preparando il tuo spazio…
      </p>
    </motion.div>
  );
}
