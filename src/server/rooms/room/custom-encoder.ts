const ALPHABET = "01234567qwertyuiopasdfghjklzxcvb";

const STEP = 5n;
const MASK = (1n << STEP) - 1n;

export class Encoder {
  static encode(n: number) {
    const num = BigInt(n);
    let encoded = "";
    for (let i = 1; i <= 26; i++) {
      const next = (num >> STEP * BigInt(i - 1)) & MASK;
      encoded += ALPHABET[Number(next)];
    }
    while (encoded.at(-1) === "0") {
      encoded = encoded.slice(0, -1);
    }
    return encoded;
  }

  static decode(encoded: string): number {
    let result = 0;
    for (let i = 0; i < encoded.length; i++) {
      const char = encoded[i]!;
      const num = ALPHABET.indexOf(char);
      if (num === -1) {
        throw new Error("invalid character: " + char);
      }
      result += Number(BigInt(num) << (BigInt(i) * STEP));
    }
    return result;
  }
}
