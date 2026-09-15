import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  readOnly?: boolean
  minHeight?: string
  activeLine?: number | null
  attentionLine?: number | null
}

export function CodeEditor({ value, onChange, label = 'Python code editor', readOnly = false, minHeight = '220px', activeLine = null, attentionLine = null }: CodeEditorProps) {
  return (
    <div className="pixpy-editor" aria-label={label} data-active-line={activeLine ?? undefined} data-attention-line={attentionLine ?? undefined}>
      <div className="editor-titlebar"><span><b>PY</b> Python</span><small>REAL CODE</small></div>
      <CodeMirror
        value={value}
        height="100%"
        minHeight={minHeight}
        extensions={[python(), EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' })]}
        onChange={onChange}
        editable={!readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          autocompletion: true,
          bracketMatching: true,
        }}
        theme="dark"
      />
    </div>
  )
}
