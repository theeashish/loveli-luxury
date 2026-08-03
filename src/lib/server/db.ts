import "server-only";

export function throwIfError(
  error: { message: string } | null,
): void {
  if (error) {
    throw new Error(error.message);
  }
}

export function requireRow<T>(
  row: T | null,
  message = "Record not found",
): T {
  if (!row) {
    throw new Error(message);
  }

  return row;
}