import type { StatusCodes } from "http-status-codes";
import { getReasonPhrase } from "http-status-codes";
import { RouterResponse } from "./simple-server/router-response";

export function createResponse(status: StatusCodes, message?: string) {
  const response = RouterResponse.empty({
    status,
    statusText: message ?? getReasonPhrase(status),
  });

  return response;
}
