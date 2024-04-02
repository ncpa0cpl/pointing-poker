function groupByPolyfill<T, R extends string | number | symbol>(
  iterable: Iterable<T>,
  select: (value: T, idx: number) => R,
): Record<R, T[]> {
  const result: Record<R, T[]> = {} as any;
  let idx = 0;
  for (const value of iterable) {
    const key = select(value, idx++);
    if (key in result) {
      result[key].push(value);
    } else {
      result[key] = [value];
    }
  }
  return result;
}

export function groupBy<T, R extends string | number | symbol>(
  iterable: Iterable<T>,
  select: (value: T, idx: number) => R,
): Record<R, T[]> {
  if ("groupBy" in Object) {
    // @ts-ignore
    return Object.groupBy(iterable, select);
  }
  return groupByPolyfill(iterable, select);
}
