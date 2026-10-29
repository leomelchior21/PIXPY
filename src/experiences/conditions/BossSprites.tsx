import { useMemo } from 'react'
import { fighterColors, fighterRows, paletteColor, type PixelPalette } from '../../data/bossFighters'
import { bossSprite, type ConditionBoss } from '../../data/conditionBosses'
import type { BossFighter } from '../../types'

/** Pixel art drawn with one shadow per pixel. `shadow` paints every pixel one colour, for silhouettes. */
function PixelArt({ rows, palette, size, locked = false, shadow, className = '' }: { rows: string[]; palette: PixelPalette; size: number; locked?: boolean; shadow?: string; className?: string }) {
  const pixels = useMemo(() => rows.flatMap((row, y) => [...row].flatMap((key, x) => {
    const color = paletteColor(palette, key)
    // Silhouettes keep the eyes lit.
    const paint = shadow ? (key === 'w' || key === 't' ? '#ff5a36' : shadow) : locked ? '#2a2d3d' : color
    return color ? [`${x * size}px ${y * size}px 0 ${paint}`] : []
  })).join(','), [rows, palette, size, locked, shadow])
  return <span className={`ba-mini ${className}`} style={{ width: size * 16, height: size * 16 }} aria-hidden="true"><i style={{ width: size, height: size, boxShadow: pixels }} /></span>
}

export function MiniSprite({ boss, size, beaten = false, locked = false, shadow }: { boss: ConditionBoss; size: number; beaten?: boolean; locked?: boolean; shadow?: string }) {
  return <PixelArt rows={bossSprite(boss.sprite)} palette={boss.palette} size={size} locked={locked} shadow={shadow} className={beaten ? 'is-beaten' : ''} />
}

/** The character a student builds for the arena. */
export function FighterSprite({ fighter, size }: { fighter: BossFighter; size: number }) {
  const rows = useMemo(() => fighterRows(fighter.base), [fighter.base])
  return <PixelArt rows={rows} palette={fighterColors[fighter.color] ?? fighterColors[0]} size={size} />
}
