import { RoundResult } from "./round-result";

export type SerializedRoundResult = {
  vote: string;
  username: string;
  userID: string;
  publicUserID: string;
};

export class RoundResultSerializer {
  public static serialize(roundResult: RoundResult): SerializedRoundResult {
    return {
      vote: roundResult.vote,
      username: roundResult.username,
      publicUserID: roundResult.publicUserID,
      userID: roundResult.userID,
    };
  }

  public static deserialize(
    serializedData: SerializedRoundResult,
  ): RoundResult {
    return new RoundResult(
      serializedData.userID,
      serializedData.publicUserID,
      serializedData.username,
      serializedData.vote,
    );
  }
}
