import type { PrintActivityId } from '../types'

export type PrintReward =
  | { type: 'morning-greeting'; message: string }
  | { type: 'personal-message'; greeting: string; message: string }
  | { type: 'empty-line'; top: string; bottom: string }
  | { type: 'text-frame'; output: string; lines: string[] }
  | { type: 'heart-stack'; output: string; lines: string[] }

function normalizeOutput(output: string): string {
  return output.replace(/\r\n?/g, '\n')
}

function isClosedFrame(lines: string[]): boolean {
  if (lines.length < 3 || lines[0].length < 3) return false
  if (lines.some((line) => line.length !== lines[0].length || !/^[# ]+$/.test(line))) return false
  return /^#+$/.test(lines[0]) && lines.at(-1) === lines[0] && lines.slice(1, -1).every((line) => line.startsWith('#') && line.endsWith('#'))
}

function isFiveLineHeart(lines: string[]): boolean {
  if (lines.length !== 5 || lines.some((line) => !/^[# ]+$/.test(line))) return false
  const visibleRows = lines.map((line) => line.trim())
  const hashCounts = visibleRows.map((line) => line.replaceAll(' ', '').length)
  return /^#+ +#+$/.test(visibleRows[0])
    && /^#+$/.test(visibleRows[1])
    && visibleRows.slice(2).every((line) => /^#+$/.test(line))
    && hashCounts[1] > hashCounts[0]
    && hashCounts[1] > hashCounts[2]
    && hashCounts[2] > hashCounts[3]
    && hashCounts[3] > hashCounts[4]
    && hashCounts[4] === 1
}

export function detectPrintReward(activityId: PrintActivityId, output: string, successfulRun: boolean): PrintReward | null {
  if (!successfulRun) return null
  const normalized = normalizeOutput(output)
  const lines = normalized.split('\n')

  if (activityId === 'morning-chat' && normalized === 'Bom dia, chat!') {
    return { type: 'morning-greeting', message: normalized }
  }
  if (activityId === 'introduce-yourself' && lines.length === 2 && lines.every(Boolean)) {
    return { type: 'personal-message', greeting: lines[0], message: lines[1] }
  }
  if (activityId === 'blank-line' && normalized === 'TOP\n\nBOTTOM') {
    return { type: 'empty-line', top: lines[0], bottom: lines[2] }
  }
  if (activityId === 'draw-frame' && isClosedFrame(lines)) {
    return { type: 'text-frame', output: normalized, lines }
  }
  if (activityId === 'initials-banner' && isFiveLineHeart(lines)) {
    return { type: 'heart-stack', output: normalized, lines }
  }
  return null
}
