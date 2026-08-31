const PYODIDE_VERSION = '0.28.3'
const PYODIDE_ROOT = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

interface RunMessage {
  type: 'run'
  id: number
  code: string
}

interface PyodideRuntime {
  runPythonAsync: (code: string) => Promise<unknown>
}

let runtimePromise: Promise<PyodideRuntime> | null = null

async function getRuntime(): Promise<PyodideRuntime> {
  if (!runtimePromise) {
    runtimePromise = import(/* @vite-ignore */ `${PYODIDE_ROOT}pyodide.mjs`)
      .then((module) => module.loadPyodide({ indexURL: PYODIDE_ROOT }))
  }
  return runtimePromise
}

self.postMessage({ type: 'booting' })

void getRuntime()
  .then(() => self.postMessage({ type: 'ready' }))
  .catch((error: unknown) => self.postMessage({ type: 'boot-error', error: error instanceof Error ? error.message : String(error) }))

self.onmessage = async (event: MessageEvent<RunMessage>) => {
  if (event.data.type !== 'run') return
  const { id, code } = event.data

  const wrapped = `
import ast, json

_pixpy_source = ${JSON.stringify(code)}
_pixpy_tree = ast.parse(_pixpy_source, mode="exec")
_pixpy_allowed = (
    ast.Module, ast.Assign, ast.Name, ast.Store, ast.Constant,
    ast.UnaryOp, ast.UAdd, ast.USub, ast.BinOp,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
)
for _pixpy_node in ast.walk(_pixpy_tree):
    if not isinstance(_pixpy_node, _pixpy_allowed):
        raise ValueError("Runner Lab only needs number assignments for now.")

_pixpy_scope = {}
exec(compile(_pixpy_tree, "runner_lab.py", "exec"), {"__builtins__": {}}, _pixpy_scope)
_pixpy_keys = ["player_speed", "jump_power", "gravity", "obstacle_speed", "obstacle_count", "player_size", "lives"]
_pixpy_result = {}
for _pixpy_key in _pixpy_keys:
    if _pixpy_key not in _pixpy_scope:
        raise NameError(f"{_pixpy_key} is missing")
    _pixpy_value = _pixpy_scope[_pixpy_key]
    if isinstance(_pixpy_value, bool) or not isinstance(_pixpy_value, (int, float)):
        raise TypeError(f"{_pixpy_key} needs a number")
    _pixpy_result[_pixpy_key] = _pixpy_value
json.dumps(_pixpy_result)
`

  try {
    const runtime = await getRuntime()
    const result = await runtime.runPythonAsync(wrapped)
    self.postMessage({ type: 'result', id, result })
  } catch (error: unknown) {
    self.postMessage({ type: 'error', id, error: error instanceof Error ? error.message : String(error) })
  }
}
