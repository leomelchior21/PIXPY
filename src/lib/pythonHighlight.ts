import { pythonLanguage } from '@codemirror/lang-python'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { highlightTree } from '@lezer/highlight'
import { StyleModule } from 'style-mod'
import { LIVE_PREVIEW_MAX_CODE } from './liveCode'

export interface HighlightSpan {
  text: string
  className: string | null
}

let stylesMounted = false

function ensureHighlightStyles(): void {
  if (stylesMounted) return
  stylesMounted = true
  if (typeof document === 'undefined') return
  try {
    // The exact One Dark rules the app editors use, mounted for plain DOM.
    if (oneDarkHighlightStyle.module) StyleModule.mount(document, oneDarkHighlightStyle.module)
  } catch {
    // Highlighting is cosmetic; plain text still renders.
  }
}

/**
 * Tokenizes Python with the same Lezer parser and One Dark palette the CodeMirror
 * editors use, and returns one span list per line so previews can render real
 * syntax colors without a second palette or a regex tokenizer.
 */
export function highlightPythonLines(code: string): HighlightSpan[][] {
  ensureHighlightStyles()
  const source = code.slice(0, LIVE_PREVIEW_MAX_CODE)
  const tree = pythonLanguage.parser.parse(source)
  const flat: HighlightSpan[] = []
  let position = 0

  highlightTree(tree, oneDarkHighlightStyle, (from, to, classes) => {
    if (from > position) flat.push({ text: source.slice(position, from), className: null })
    flat.push({ text: source.slice(from, to), className: classes || null })
    position = to
  })
  if (position < source.length) flat.push({ text: source.slice(position), className: null })

  const lines: HighlightSpan[][] = [[]]
  for (const span of flat) {
    const pieces = span.text.split('\n')
    for (let index = 0; index < pieces.length; index += 1) {
      if (index > 0) lines.push([])
      if (pieces[index]) lines[lines.length - 1].push({ text: pieces[index], className: span.className })
    }
  }
  return lines
}
