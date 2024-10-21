import type {
  ClassSerializer,
  SerializedClassInstance,
} from "./persistent-decorator";
import { Storages } from "./storage/storages";

const getClassName = (obj: {
  name: string;
  getOriginalName?: () => string;
}) => {
  if (obj.getOriginalName) {
    return obj.getOriginalName();
  }
  return obj.name;
};

export async function deserializeClassInstancesFromPersistentStorage<T>(
  classConstructor: (new(...args: any[]) => any) & {
    serializer: ClassSerializer<T>;
  },
) {
  const items = await Storages.load(getClassName(classConstructor));
  const instances: T[] = [];

  for (const data of items) {
    const serializedData = data as SerializedClassInstance;
    instances.push(classConstructor.serializer.deserialize(serializedData));
  }

  return instances;
}
