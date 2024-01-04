export type FindInUnion<U, M> = U extends infer T extends M ? T : never;
