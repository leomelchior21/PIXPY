import type { PrintActivityId } from '../types'
import { isMorningGreetingOutput } from './printMatching'

export type PrintReward =
  | { type: 'morning-greeting'; message: string }
  | { type: 'personal-message'; greeting: string; message: string }
  | { type: 'empty-line'; top: string; bottom: string }
  | { type: 'text-frame'; output: string; lines: string[] }
  | { type: 'heart-stack'; output: string; lines: string[] }
  | { type: 'launch-sequence'; countdown: string[]; liftoff: string }

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

function isLiftoffPhrase(line: string | undefined): boolean {
  const phrase = (line ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('0', 'o')
    .replace(/[^a-z]/g, '')

  return phrase.length >= 5 && phrase.length <= 9 && phrase.startsWith('l') && editDistance(phrase, 'liftoff') <= 2
}

function getLaunchLines(lines: string[]): string[] | null {
  const meaningfulLines = lines.map((line) => line.trim()).filter(Boolean)
  if (meaningfulLines.length !== 4) return null
  if (meaningfulLines[0] !== '3' || meaningfulLines[1] !== '2' || meaningfulLines[2] !== '1') return null
  return isLiftoffPhrase(meaningfulLines[3]) ? meaningfulLines : null
}

export function detectPrintReward(activityId: PrintActivityId, output: string, successfulRun: boolean): PrintReward | null {
  if (!successfulRun) return null
  const normalized = normalizeOutput(output)
  const lines = normalized.split('\n')

  if (activityId === 'morning-chat' && isMorningGreetingOutput(normalized)) {
    return { type: 'morning-greeting', message: normalized.trim() }
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
  if (activityId === 'launch-countdown') {
    const launchLines = getLaunchLines(lines)
    if (launchLines) return { type: 'launch-sequence', countdown: launchLines.slice(0, 3), liftoff: launchLines[3] }
  }
  return null
}
