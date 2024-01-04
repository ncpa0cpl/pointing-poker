import type { Signal } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx";

export const urlParamSig = <T>(
  paramName: string,
  initialValue?: T,
): Signal<T> => {
  const url = new URL(window.location.href);
  const paramValue = url.searchParams.get(paramName);
  const value = paramValue ? JSON.parse(paramValue) : initialValue;
  const signal = sig(value);
  signal.add((value) => {
    const url = new URL(window.location.href);
    url.searchParams.set(paramName, JSON.stringify(value));
    window.history.pushState({}, "", url.toString());
  });
  return signal;
};
