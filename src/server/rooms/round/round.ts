import { StatusCodes } from "http-status-codes";
import * as uuid from "uuid";
import type { RoundUpdateOutgoingMessage } from "../../../shared/websockets-messages/room-websocket-outgoing-message-types";
import { isNumber } from "../../utilities/is-number";
import { PDependency } from "../../utilities/persistent-objects/persistent-property-dependency-decorator";
import { PWatch } from "../../utilities/persistent-objects/persistent-property-watcher-decorator";
import { RequestError } from "../../utilities/request-error";
import type { RoundOption } from "./option/round-option";
import type { RoundResult } from "./result/round-result";
import { RoundSerializer } from "./serializer";

export type FinalResults = Exclude<
  RoundUpdateOutgoingMessage["finalResult"],
  undefined
>;

const EMPTY_RESULT_SET = Object.freeze({
  votes: 0,
  mean: "N/A",
  mode: "N/A",
  median: "N/A",
});

export class Round {
  public static serializer = RoundSerializer;

  public readonly id: string;
  @PDependency()
  public options: ReadonlyArray<RoundOption> = [];
  @PDependency()
  public results: ReadonlyArray<RoundResult> = [];
  @PWatch()
  public isInProgress = true;

  public finalResults?: FinalResults;

  public constructor(
    id?: string,
    options?: RoundOption[],
    results?: RoundResult[],
    isInProgress?: boolean,
    finalResults?: FinalResults,
  ) {
    this.id = id ?? uuid.v4();

    if (options) {
      this.options = options;
    }

    if (results) {
      this.results = results;
    }

    if (isInProgress != null) {
      this.isInProgress = isInProgress;
    }

    if (finalResults) {
      this.finalResults = finalResults;
    }
  }

  private calculateMean(votes: number[]): string {
    return (votes.reduce((acc, curr) => acc + curr, 0) / votes.length).toFixed(
      2,
    );
  }

  private calculateMode(votes: number[]): string {
    const count: number[] = [];
    for (let i = 0; i < votes.length; i++) {
      const voteValue = votes[i]!;
      if (count[voteValue] == null) {
        count[voteValue] = 0;
      }
      count[voteValue]++;
    }
    let max = { value: 0, count: 0, same: [] as number[] };
    for (let voteValue = 0; voteValue < count.length; voteValue++) {
      const voteCount = count[voteValue];
      if (voteCount) {
        if (voteCount === max.count) {
          max.same.push(voteValue);
        } else if (voteCount > max.count) {
          max = { value: voteValue, count: voteCount, same: [] };
        }
      }
    }
    if (max.same.length > 0) {
      return `${max.value}, ${max.same.join(", ")}`;
    }
    return max.value.toFixed(0);
  }

  private calculateMedian(votes: number[]): string {
    const sortedVotes = votes.sort((a, b) => a - b);
    if (sortedVotes.length % 2 === 0) {
      const med1 = sortedVotes[sortedVotes.length / 2 - 1]!;
      const med2 = sortedVotes[sortedVotes.length / 2]!;
      return ((med1 + med2) / 2).toFixed(2);
    } else {
      const med = sortedVotes[(sortedVotes.length - 1) / 2]!;
      return med.toFixed(0);
    }
  }

  private calculateFinalResults(): FinalResults {
    const votes = this.results.map((result) => Number(result.vote)).filter(
      isNumber,
    );

    if (votes.length === 0) {
      return EMPTY_RESULT_SET;
    }

    const mean = this.calculateMean(votes);
    const mode = this.calculateMode(votes);
    const median = this.calculateMedian(votes);

    return {
      votes: votes.length,
      mean,
      mode,
      median,
    };
  }

  private addResult(result: RoundResult): void {
    const existingResultIdx = this.results?.findIndex(
      (r) => r.userID === result.userID,
    );

    if (existingResultIdx != -1) {
      this.results = this.results.map((r, idx) => {
        if (idx === existingResultIdx) {
          return result;
        }
        return r;
      });
    } else {
      this.results = [...this.results, result];
    }
  }

  public setOptions(options: RoundOption[]): void {
    this.options = options;
  }

  public addResultVote(result: RoundResult) {
    this.addResult(result);
  }

  public getOption(id: string): RoundOption | RequestError {
    const option = this.options.find((option) => option.id === id);

    if (!option) {
      return new RequestError(
        StatusCodes.NOT_FOUND,
        `RoundOption with id ${id} not found.`,
      );
    }

    return option;
  }

  public hasResults(): boolean {
    return !!this.results;
  }

  public finish(): void {
    this.isInProgress = false;
    this.finalResults = this.calculateFinalResults();
  }

  public getFinishMessage(): string {
    const { mean, median, mode } = this.finalResults!;
    return `Round ended with following result:
    Avg: ${mean}
    Median: ${median}
    Mode: ${mode}`;
  }

  public toView(): Omit<RoundUpdateOutgoingMessage, "type"> {
    return {
      options: this.options.map((option) => option.toView()),
      results: this.results.map((result) => result.toView()) ?? [],
      isInProgress: this.isInProgress,
      hasResults: this.hasResults(),
      finalResult: this.finalResults ? { ...this.finalResults } : undefined,
      id: this.id,
    };
  }
}
