import type { StatusCodes } from "http-status-codes";
import { logger } from "../app-logger";

export class RequestError extends Error {
  public static is<T>(value: T | RequestError): value is RequestError {
    return value instanceof RequestError;
  }

  public constructor(
    public readonly code: StatusCodes,
    public readonly message: string,
    cause?: any,
  ) {
    super(message, { cause });
    logger.warn({
      message: "Incoming request has resulted with an error.",
      errorMessage: message,
      errorCode: code,
      errorStack: this.stack,
      errorCause: cause,
    });
  }
}
