import type { DispatchFunc, Signal } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx";

export function localStorageSignal<T>(key: string, initialValue: T): Signal<T> {
  const localValue = localStorage.getItem(key);

  const signal = sig(localValue ? JSON.parse(localValue) : initialValue);

  return {
    add: signal.add.bind(signal),
    current: signal.current.bind(signal),
    listenerCount: signal.listenerCount.bind(signal),
    derive: signal.derive.bind(signal),
    detachAll: signal.detachAll.bind(signal),
    destroy: signal.destroy.bind(signal),
    dispatch(t: T | DispatchFunc<T>) {
      const newValue = typeof t === "function"
        ? (t as DispatchFunc<T>)(signal.current())
        : t;

      signal.dispatch(newValue);

      localStorage.setItem(
        key,
        JSON.stringify(newValue),
      );
    },
  };
}
