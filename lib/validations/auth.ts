import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Inserisci un'email valida"));

// bcrypt ignores bytes beyond 72, so longer passwords would be silently truncated. The other
// rules (not the email, not leaked) are in lib/auth/password-policy.ts.
export const PASSWORD_MIN = 10;
const newPassword = z
  .string()
  .min(PASSWORD_MIN, `La password deve avere almeno ${PASSWORD_MIN} caratteri`)
  .max(72, "La password può avere al massimo 72 caratteri");

/** Existing passwords may be shorter than today's minimum: they still work. */
const currentPassword = z.string().min(1, "Inserisci la password").max(72);

export const loginSchema = z.object({ email, password: currentPassword });

export const changePasswordSchema = z
  .object({
    current: currentPassword,
    password: newPassword,
    confirmPassword: z.string(),
    /** Required when 2FA is on. */
    code: z.string().trim().max(20).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });

/** The password asked again before a sensitive setting. */
export const reauthSchema = z.object({ password: currentPassword });

/** Password plus the 2FA code (or a recovery code), to turn 2FA off or replace the codes. */
export const reauthWithCodeSchema = z.object({
  password: currentPassword,
  code: z.string().trim().min(1, "Inserisci il codice").max(20),
});

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{3}\s?\d{3}$/, "Il codice è di 6 cifre"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Inserisci il tuo nome").max(80),
  email,
  password: newPassword,
  acceptTerms: z.literal(true, "Per creare l'account accetta i termini e la privacy"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });
