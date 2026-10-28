export type StatementParseErrorCode =
  | "unsupported_format"
  | "empty"
  | "no_transactions"
  | "pdf_extraction_failed"
  | "file_too_large";

/** Fatal parse error. The UI translates `code`; `message` is an English developer string. */
export class StatementParseError extends Error {
  readonly code: StatementParseErrorCode;

  constructor(code: StatementParseErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = "StatementParseError";
    this.code = code;
  }
}

export function isStatementParseError(err: unknown): err is StatementParseError {
  return err instanceof StatementParseError;
}

/** Max accepted upload size (15 MB). */
export const MAX_FILE_SIZE = 15 * 1024 * 1024;
