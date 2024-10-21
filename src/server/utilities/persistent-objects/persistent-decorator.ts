import { createActionDispatcher } from "../event-dispatcher";
import { PersistentMetadataKeys } from "./metadata-keys";
import { Storages } from "./storage/storages";

export type SerializedClassInstance = object & { id: string };

export type ClassSerializer<T> = {
  serialize(instance: T): SerializedClassInstance;
  deserialize(serialized: SerializedClassInstance): T;
};

function applyWatchers(
  instance: Record<string, any> | Array<any>,
  onUpdate: () => void,
): void {
  if (Array.isArray(instance)) {
    instance.forEach((item) => applyWatchers(item, onUpdate));
    Object.freeze(instance); // prevent mutation on the array (push, pop, etc)
    return;
  }

  for (const key of Object.keys(instance)) {
    const isWatched =
      Reflect.getMetadata(PersistentMetadataKeys.PAWTCH, instance, key)
        === true;
    const isDependency =
      Reflect.getMetadata(PersistentMetadataKeys.DEPENDENCY, instance, key)
        === true;

    if (isWatched || isDependency) {
      const box = { value: instance[key] };

      Object.defineProperty(instance, key, {
        get: () => {
          return box.value;
        },
        set: (value) => {
          box.value = value;
          if (
            isDependency
            && typeof value === "object"
            && typeof value !== null
          ) {
            applyWatchers(value, onUpdate);
          }
          onUpdate();
          return true;
        },
      });
    }

    if (isDependency) {
      applyWatchers(instance[key], onUpdate);
    }
  }
}

export function Persistent<T>(
  constructor: (new(...args: any[]) => any) & {
    serializer: ClassSerializer<T>;
  },
): any {
  const name = constructor.name;
  const actions = createActionDispatcher();

  const wrapper = {
    [name]: class extends constructor {
      public static getOriginalName() {
        return name;
      }

      public constructor(...args: any[]) {
        super(...args);

        const data = constructor.serializer.serialize(this as any as T);
        Storages.has(name, data.id).then(exists => {
          if (!exists) {
            Storages.create(name, data.id, data);
          }

          const updatePersistentStorage = (): void => {
            const data = constructor.serializer.serialize(this as any as T);
            Storages.update(name, data.id, data);
          };

          applyWatchers(this, () => {
            actions.dispatch(updatePersistentStorage);
          });
        });
      }
    },
  }[name];

  return wrapper;
}
