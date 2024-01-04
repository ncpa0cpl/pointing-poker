export type RouteDef = {
  [key: string]: RouteDef | null;
};
type Prepend<T extends string, V extends string> = T extends "" ? T
  : `${V}${T}`;

type Concat<P extends any[], S extends string> = P extends
  [infer F extends string, ...infer R] ? `${F}${Prepend<Concat<R, S>, S>}`
  : "";

type ParamName<K> = K extends `:${infer PN}` ? PN : undefined;

type ParamsOf<R extends RouteDef | null> = Exclude<
  [keyof R] extends [never] ? undefined
    : ParamName<keyof R>,
  undefined
>;

export type HasParams<R extends RouteDef | null> = [keyof R] extends [never]
  ? false
  : ParamName<keyof R> extends undefined ? false
  : true;

export type Routes<
  T,
  P extends any[] = [],
> = T extends RouteDef ?
    & {
      [K in keyof T as K extends `:${infer N}` ? never : K]:
        & Routes<T[K], [...P, K]>
        & {
          path(): `/${Concat<[...P, K], "/">}`;
        };
    }
    & (
      HasParams<T> extends true ? {
          [KP in ParamsOf<T>]:
            & (<PR extends string>(param: PR) =>
              & Routes<T[`:${KP}`], [...P, PR]>
              & ({
                path(): `/${Concat<[...P, PR], "/">}`;
              }))
            & {
              pattern: `/${Concat<[...P, `:${KP}`], "/">}`;
            };
        }
        : {}
    )
  : {};
