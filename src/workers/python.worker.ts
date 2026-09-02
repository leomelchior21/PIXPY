const PYODIDE_VERSION = '0.28.3'
const PYODIDE_ROOT = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

interface RunMessage {
  type: 'run'
  id: number
  code: string
  inputs: string[]
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
  const { id, code, inputs } = event.data

  const wrapped = `
import ast, contextlib, io, json

_pixpy_source = ${JSON.stringify(code)}
_pixpy_inputs = iter(json.loads(${JSON.stringify(JSON.stringify(inputs))}))
_pixpy_tree = ast.parse(_pixpy_source, mode="exec")
_pixpy_forbidden = (
    ast.Import, ast.ImportFrom, ast.Attribute, ast.Subscript, ast.Lambda,
    ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.For, ast.AsyncFor,
    ast.While, ast.With, ast.AsyncWith, ast.Try, ast.Raise, ast.Delete,
    ast.Global, ast.Nonlocal, ast.Await, ast.Yield, ast.YieldFrom,
)
for _pixpy_node in ast.walk(_pixpy_tree):
    if isinstance(_pixpy_node, _pixpy_forbidden):
        raise ValueError("This playground only needs small input, math, and print programs.")
    if isinstance(_pixpy_node, ast.Call):
        if not isinstance(_pixpy_node.func, ast.Name) or _pixpy_node.func.id not in {"print", "input", "int", "float", "str", "round", "abs"}:
            raise ValueError("That function is not available in this playground yet.")

def _pixpy_input(prompt=""):
    if prompt:
        print(prompt, end="")
    try:
        return next(_pixpy_inputs)
    except StopIteration:
        raise ValueError("This code asked for more input.")

_pixpy_safe = {
    "print": print,
    "input": _pixpy_input,
    "int": int,
    "float": float,
    "str": str,
    "round": round,
    "abs": abs,
}
_pixpy_scope = {"__builtins__": _pixpy_safe}
_pixpy_output = io.StringIO()
with contextlib.redirect_stdout(_pixpy_output):
    exec(compile(_pixpy_tree, "pixpy_playground.py", "exec"), _pixpy_scope, _pixpy_scope)

_pixpy_variables = {}
for _pixpy_key, _pixpy_value in _pixpy_scope.items():
    if _pixpy_key.startswith("_"):
        continue
    if _pixpy_value is None or isinstance(_pixpy_value, (str, int, float, bool)):
        _pixpy_variables[_pixpy_key] = _pixpy_value

json.dumps({"stdout": _pixpy_output.getvalue().rstrip(), "variables": _pixpy_variables})
`

  try {
    const runtime = await getRuntime()
    const result = await runtime.runPythonAsync(wrapped)
    self.postMessage({ type: 'result', id, result })
  } catch (error: unknown) {
    self.postMessage({ type: 'error', id, error: error instanceof Error ? error.message : String(error) })
  }
}
