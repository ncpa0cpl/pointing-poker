import type { Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

export function localStorageSignal<T>(key: string, initialValue: T): Signal<T> {
  const localValue = localStorage.getItem(key);

  const signal = sig(localValue ? JSON.parse(localValue) : initialValue);

  signal.add((value) => {
    localStorage.setItem(
      key,
      JSON.stringify(value),
    );
  });

  return signal;
}
