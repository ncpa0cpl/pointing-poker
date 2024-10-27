import { RoundOption } from "./option/round-option";
import type { SerializedRoundOption } from "./option/serializer";
import { RoundResult } from "./result/round-result";
import type { SerializedRoundResult } from "./result/serializer";
import type { FinalResults } from "./round";
import { Round } from "./round";

export type SerializedRound = {
  id: string;
  options: SerializedRoundOption[];
  results: SerializedRoundResult[];
  finalResult?: FinalResults;
  isInProgress: boolean;
};

export class RoundSerializer {
  public static serialize(round: Round): SerializedRound {
    return {
      id: round.id,
      isInProgress: round.isInProgress,
      options: round.options.map((option) =>
        RoundOption.serializer.serialize(option)
      ),
      results:
        round.results?.map((result) => RoundResult.serializer.serialize(result))
          ?? [],
      finalResult: round.finalResults,
    };
  }

  public static deserialize(serializedData: SerializedRound): Round {
    const options = serializedData.options.map((option) =>
      RoundOption.serializer.deserialize(option)
    );
    const results = serializedData.results.map((result) =>
      RoundResult.serializer.deserialize(result)
    );
    const round = new Round(
      serializedData.id,
      options,
      results,
      serializedData.isInProgress,
      serializedData.finalResult,
    );
    return round;
  }
}
