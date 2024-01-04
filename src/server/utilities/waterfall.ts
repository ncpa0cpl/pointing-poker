export const waterfall = async (...actions: Array<() => any>) => {
  for (const action of actions) {
    await action();
  }
};
