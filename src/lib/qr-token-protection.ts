import { z } from "zod";

export const QR_REGEN_CONFIRMATION_TEXT = "REGENERAR QR";
export const QR_DELETE_CONFIRMATION_TEXT = "ELIMINAR SOCIO";

export const qrDangerousActionSchema = z.object({
  confirmationText: z.string().trim().min(1),
  currentToken: z.string().trim().min(1).max(200),
});

export function matchesConfirmation(expected: string, value: string) {
  return value.trim().toUpperCase() === expected;
}
