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

  const cancel = () => {
    if (lastTimeout !== undefined) {
      clearTimeout(lastTimeout);
      lastTimeout = undefined;
    }
  };

  return { dispatch, cancel };
}

export type ActionDispatcher = ReturnType<typeof createActionDispatcher>;
