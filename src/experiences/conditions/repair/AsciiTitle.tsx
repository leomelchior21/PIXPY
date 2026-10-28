import type { CSSProperties } from 'react'

// Big block letters drawn with text characters, with a shaded drop shadow.

const font: Record<string, string[]> = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  B: ['####.', '#...#', '####.', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#####'],
  F: ['#####', '#....', '####.', '#....', '#....'],
  G: ['.####', '#....', '#..##', '#...#', '.###.'],
  H: ['#...#', '#...#', '#####', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '####.', '#....', '#....'],
  Q: ['.###.', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['#####', '...#.', '..#..', '.#...', '#####'],
  0: ['.###.', '#..##', '#.#.#', '##..#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '..##.', '.#...', '#####'],
  3: ['####.', '....#', '.###.', '....#', '####.'],
  '-': ['.....', '.....', '.###.', '.....', '.....'],
  ' ': ['...', '...', '...', '...', '...'],
}

/** Lit pixels of the text, one column gap between letters. */
function render(text: string) {
  const pixels: Array<[number, number]> = []
  let x = 0
  for (const char of text.toUpperCase()) {
    const glyph = font[char] ?? font[' ']
    glyph.forEach((row, y) => { [...row].forEach((pixel, dx) => { if (pixel === '#') pixels.push([x + dx, y]) }) })
    x += glyph[0].length + 1
  }
  return { pixels, width: x }
}

/** The machine's name in big pixel letters with a dithered drop shadow, like an ANSI-art banner. */
export function AsciiTitle({ text }: { text: string }) {
  const { pixels, width } = render(text)
  return <svg className="rs-ascii-title" viewBox={`0 0 ${width + 1} 6.2`} preserveAspectRatio="xMinYMid meet" aria-hidden="true" style={{ '--cols': width } as CSSProperties}>
    <defs>
      <pattern id="rs-dither" width="0.5" height="0.5" patternUnits="userSpaceOnUse"><rect width="0.25" height="0.25" /><rect x="0.25" y="0.25" width="0.25" height="0.25" /></pattern>
    </defs>
    <g className="rs-ascii-title__shadow">{pixels.map(([x, y]) => <rect key={`s${x}-${y}`} x={x + 0.35} y={y + 0.35} width="1" height="1" />)}</g>
    <g className="rs-ascii-title__face">{pixels.map(([x, y]) => <rect key={`f${x}-${y}`} x={x} y={y} width="0.92" height="0.92" rx="0.08" />)}</g>
  </svg>
}
