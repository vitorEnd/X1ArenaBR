import { z } from "zod";

const EMAIL_MAX_LENGTH = 254;
export const RANKED_USERNAME_MIN_LENGTH = 3;
export const RANKED_USERNAME_MAX_LENGTH = 24;
export const USERNAME_CHANGE_COOLDOWN_MS = 3 * 60 * 60 * 1_000;

export const emailSchema = z
  .string()
  .trim()
  .max(EMAIL_MAX_LENGTH, "E-mail muito longo.")
  .email("Informe um e-mail válido.");

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
});

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem.",
  });

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem.",
  });

export const rankedUsernameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(
        RANKED_USERNAME_MIN_LENGTH,
        `Use pelo menos ${RANKED_USERNAME_MIN_LENGTH} caracteres.`,
      )
      .max(
        RANKED_USERNAME_MAX_LENGTH,
        `Use no máximo ${RANKED_USERNAME_MAX_LENGTH} caracteres.`,
      )
      .regex(
        /^[\p{L}\p{N}_. -]+$/u,
        "Use apenas letras, números, espaço, ponto, hífen ou sublinhado.",
      ),
  );

export function getSafeNextPath(
  value: string | null | undefined,
  fallback = "/conta",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (value.includes("\\") || /[\u0000-\u001f]/u.test(value)) {
    return fallback;
  }

  return value;
}

export function getFirstFieldError(
  fieldErrors: Record<string, string[] | undefined>,
): string | undefined {
  return Object.values(fieldErrors).find((messages) => messages?.length)?.[0];
}
