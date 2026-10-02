import { highlightPython } from '../lib/pythonHighlight'

interface Props {
  code: string
  className?: string
}

export function PythonCode({ code, className }: Props) {
  return <code className={className}>
    {highlightPython(code).map((token, index) => token.kind === 'plain'
      ? token.value
      : <span key={index} className={`py-tok py-tok--${token.kind}`}>{token.value}</span>)}
  </code>
}
