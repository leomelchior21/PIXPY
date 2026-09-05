function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array.from({ length: right.length + 1 }, () => 0)

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length]
}

function compactLetters(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('0', 'o')
    .replace(/[^a-z]/g, '')
}

export function isMorningGreetingOutput(output: string): boolean {
  const lines = output.replace(/\r\n?/g, '\n').split('\n')
  if (lines.length !== 1) return false

  const phrase = compactLetters(lines[0])
  return phrase.length >= 8 && phrase.length <= 12 && phrase.startsWith('b') && editDistance(phrase, 'bomdiachat') <= 2
}
