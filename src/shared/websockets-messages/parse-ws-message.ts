import type { AnyType, Infer } from "dilswer";
import { assertType, compileFastValidator } from "dilswer";

export const createWsMsgParser = <D extends AnyType>(
  type: D,
): (message: string | Buffer) => Infer<D> => {
  const isValid = compileFastValidator(type);

  return (msg) => {
    const strMsg = typeof msg === "string"
      ? msg
      : new TextDecoder().decode(msg);
    const data = JSON.parse(strMsg);
    if (isValid(data)) {
      return data;
    } else {
      assertType(type, data); // should throw a more detailed error
      throw new Error("Invalid message");
    }
  };
};
