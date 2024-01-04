import { RoundOption } from "./round-option";

export type SerializedRoundOption = {
  id: string;
  name: string;
};

export class RoundOptionSerializer {
  public static serialize(roundOption: RoundOption): SerializedRoundOption {
    return {
      id: roundOption.id,
      name: roundOption.name,
    };
  }

  public static deserialize(
    serializedData: SerializedRoundOption,
  ): RoundOption {
    return new RoundOption(serializedData.name, serializedData.id);
  }
}
