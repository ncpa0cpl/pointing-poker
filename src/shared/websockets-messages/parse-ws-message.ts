import type { AllDataTypes, GetDataType } from "dilswer";
import { compileFastValidator } from "dilswer";

export const createWsMsgParser = <D extends AllDataTypes>(
  type: D,
): (message: string | Uint8Array) => GetDataType<D> => {
  const isValid = compileFastValidator(type);

  return (msg) => {
    const strMsg = typeof msg === "string"
      ? msg
      : new TextDecoder().decode(msg);
    const data = JSON.parse(strMsg);
    if (isValid(data)) {
      return data;
    } else {
      throw new Error("Invalid message");
    }
  };
};
