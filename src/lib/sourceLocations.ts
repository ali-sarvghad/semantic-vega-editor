function lineFromIndex(source: string, index: number): number {
  if (index < 0) return 1;
  let line = 1;
  for (let i = 0; i < Math.min(index, source.length); i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

export function lineFromJsonError(source: string, message: string): number | undefined {
  const match = message.match(/position\s+(\d+)/i);
  if (!match) return undefined;
  return lineFromIndex(source, Number(match[1]));
}
