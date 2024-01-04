import type { StatusCodes } from "http-status-codes";
import { getReasonPhrase } from "http-status-codes";

export function createResponse(status: StatusCodes, message?: string) {
  const statusText = message;
  if (!statusText) {
    message = getReasonPhrase(status);
  }

  const response = new Response(undefined, {
    status,
    statusText,
  });

  return response;
}
