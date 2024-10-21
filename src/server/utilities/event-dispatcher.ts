export function createActionDispatcher() {
  let lastTimeout: Timer | undefined;

  const dispatch = (action: () => void) => {
    if (lastTimeout !== undefined) {
      clearTimeout(lastTimeout);
      lastTimeout = undefined;
    }

    lastTimeout = setTimeout(() => {
      lastTimeout = undefined;
      action();
    }, 25);
  };

  return { dispatch };
}

export type ActionDispatcher = ReturnType<typeof createActionDispatcher>;
