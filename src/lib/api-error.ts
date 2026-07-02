import { NextResponse } from "next/server";
import { z } from "zod";

export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status }
  );
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleApiError(err: unknown, defaultMessage = "Error interno") {
  if (err instanceof z.ZodError) {
    return apiError("Datos inválidos", 400, err.issues);
  }
  console.error(defaultMessage, err);
  return apiError(defaultMessage, 500);
}
