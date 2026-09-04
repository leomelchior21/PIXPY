import type { PrintActivityId } from '../types'

export type PrintReward =
  | { type: 'morning-greeting'; message: string }
  | { type: 'personal-message'; greeting: string; message: string }
  | { type: 'empty-line'; top: string; bottom: string }
  | { type: 'text-frame'; output: string; lines: string[] }

function normalizeOutput(output: string): string {
  return output.replace(/\r\n?/g, '\n')
}

function isClosedFrame(lines: string[]): boolean {
  if (lines.length < 3 || lines[0].length < 3) return false
  if (lines.some((line) => line.length !== lines[0].length || !/^[# ]+$/.test(line))) return false
  return /^#+$/.test(lines[0]) && lines.at(-1) === lines[0] && lines.slice(1, -1).every((line) => line.startsWith('#') && line.endsWith('#'))
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
  return null
}
