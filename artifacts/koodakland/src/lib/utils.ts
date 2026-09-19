import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ApiError } from "@workspace/api-client-react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The server's own error text (e.g. "این کالا موجود نیست"), or `fallback`. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.data && typeof error.data === "object") {
    const message = (error.data as { error?: unknown }).error;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
