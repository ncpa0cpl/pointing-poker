export function removeTrailing(text: string, char: string) {
  if (text.endsWith(char)) {
    return removeTrailing(text.slice(0, -1), char);
  }
  return text;
}
