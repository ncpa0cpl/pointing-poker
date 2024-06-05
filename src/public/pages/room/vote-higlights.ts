import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

/**
 * Contains a list of user id's to highlight in participants list.
 */
export const VoteHighlights = sig<readonly string[]>([]);