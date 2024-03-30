export type Resolvable<T> = {
  then<U = void>(cb: (val: T) => U): Resolvable<U>;
  catch<U = void>(cb?: (err: any) => U): Resolvable<T | U>;
};

export class Immediate<T> implements Resolvable<T> {
  private value?: T;
  private error?: Error;
  private success?: boolean;

  public constructor(cb: () => T) {
    try {
      this.value = cb();
      this.success = true;
    } catch (e) {
      this.error = e as Error;
      this.success = false;
    }
  }

  public then<U>(cb: (val: T) => U): Immediate<U> {
    if (this.success) {
      return new Immediate<U>(() => {
        return cb(this.value!);
      });
    }
    return this as any as Immediate<U>;
  }

  public catch<U>(cb: (err: Error) => U): Immediate<T | U> {
    if (!this.success) {
      return new Immediate<U>(() => {
        return cb(this.error!);
      });
    }
    return this;
  }
}
