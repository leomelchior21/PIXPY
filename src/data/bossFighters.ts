import type { BossFighter, FighterBase } from '../types'
import type { ConditionBoss } from './conditionBosses'

export interface PixelPalette { body: string; shade: string; light: string; accent: string }

export function paletteColor(palette: PixelPalette, key: string): string | null {
  switch (key) {
    case 'o': return '#1b1d2a'
    case 'b': return palette.body
    case 'd': return palette.shade
    case 'l': return palette.light
    case 'a': return palette.accent
    case 'w': case 't': return '#ffffff'
    case 'p': return '#1b1d2a'
    case 'm': return '#3b1022'
    default: return null
  }
}

export function pixelColor(boss: ConditionBoss, key: string): string | null {
  return paletteColor(boss.palette, key)
}

/** Left halves of 16 × 16 sprites; the right half is the mirror image. */
const fighterHalves: Record<FighterBase, string[]> = {
  bot: ['......oo', '.......o', '...ooooo', '..obbbbb', '..obllll', '..oblwpl', '..oblwpl', '..obllll', '..obbbbb', '...ooooo', '..odddda', '.obdddda', '.obdddda', '..oooooo', '...obb..', '...ooo..'],
  blob: ['........', '........', '......oo', '....oobb', '...obbbb', '..oaaaaa', '..obbbbb', '.obbwpbb', '.obbwpbb', '.obbbbbb', '.oblbbbb', '.obbbbbb', '.odbbbbb', '..oddddd', '...ooooo', '........'],
  cat: ['........', '..o.....', '..oo....', '..obo...', '..obbooo', '..obbbbb', '.obbbbbb', '.obwpbbb', '.obwpbbb', '.obbbbba', '.obbbbbb', '..obbbbb', '..odbbbb', '..odllll', '..odllll', '...ooooo'],
  wizard: ['.......o', '......oa', '.....oaa', '....oaaa', '...oaaal', '..oaaaaa', 'oooooooo', '..obbbbb', '..obwpbb', '..obwpbb', '..obbbbb', '...ollll', '..oddlll', '..oddddd', '.odddddd', '.ooooooo'],
}

export function fighterRows(base: FighterBase): string[] {
  return fighterHalves[base].map((half) => half + [...half].reverse().join(''))
}

export const fighterBases: Array<{ id: FighterBase; label: string }> = [
  { id: 'bot', label: 'Robot' }, { id: 'blob', label: 'Slime' }, { id: 'cat', label: 'Cat' }, { id: 'wizard', label: 'Wizard' },
]

export const fighterColors: Array<PixelPalette & { label: string }> = [
  { label: 'Lime', body: '#9be35a', shade: '#4f9c37', light: '#e2fbb8', accent: '#ffcb47' },
  { label: 'Sky', body: '#6fc8ff', shade: '#2f78c4', light: '#d8f1ff', accent: '#ff7aa2' },
  { label: 'Rose', body: '#ff8fb8', shade: '#cf5486', light: '#ffe0ec', accent: '#72dcff' },
  { label: 'Flame', body: '#ff9b5e', shade: '#d4582a', light: '#ffe1c8', accent: '#ffe066' },
  { label: 'Violet', body: '#b49cff', shade: '#7458d6', light: '#ece4ff', accent: '#7dffab' },
  { label: 'Gold', body: '#ffd34e', shade: '#c9921b', light: '#fff4c2', accent: '#ff5f7e' },
]

export const defaultFighter = (name: string): BossFighter => ({ base: 'bot', color: 0, name: name.trim().slice(0, 12) || 'Coder' })
