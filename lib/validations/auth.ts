import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Inserisci un'email valida"));

// bcrypt ignores bytes beyond 72, so longer passwords would be silently truncated.
const newPassword = z
  .string()
  .min(8, "La password deve avere almeno 8 caratteri")
  .max(72, "La password può avere al massimo 72 caratteri");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Inserisci la password").max(72),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Inserisci il tuo nome").max(80),
  email,
  password: newPassword,
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
