import type { StatusCodes } from "http-status-codes";
import { getReasonPhrase } from "http-status-codes";
import { RouterResponse } from "./simple-server/router-response";

export function createResponse(status: StatusCodes, message?: string) {
  const statusText = message;
  if (!statusText) {
    message = getReasonPhrase(status);
  }

  const response = new RouterResponse(Buffer.from(""), {
    status,
    statusText,
  });

  return response;
}
