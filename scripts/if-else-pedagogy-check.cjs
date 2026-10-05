const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const appUrl = process.env.PIXPY_URL ?? 'http://127.0.0.1:5173/'
const browserPath = process.env.PIXPY_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const port = 9241
const outputDir = path.join(os.tmpdir(), 'pixpy-pedagogy-check')
fs.mkdirSync(outputDir, { recursive: true })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pixpy-pedagogy-browser-'))
  const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
  let socket
  try {
    let tab
    for (let tries = 0; tries < 60; tries += 1) {
      try { tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json(); break }
      catch { await sleep(250) }
    }
    if (!tab) throw new Error('Could not start the browser')
    socket = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((resolve) => { socket.onopen = resolve })
    let id = 0
    const pending = new Map()
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data), callback = pending.get(message.id)
      if (!callback) return
      pending.delete(message.id)
      message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result)
    }
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      id += 1; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
      return result.result.value
    }
    const waitFor = async (expression) => {
      for (let tries = 0; tries < 160; tries += 1) {
        if (await evaluate(expression)) return
        await sleep(100)
      }
      const state = await evaluate("({ url: location.href, counter: document.querySelector('.ieb-counter')?.textContent, title: document.querySelector('.ieb-problem h1')?.textContent, dialog: document.querySelector('.ieb-outcome h2')?.textContent, text: document.body.innerText.slice(0, 500) })")
      console.error(JSON.stringify(state))
      await capture('failed-state')
      throw new Error(`Timed out: ${expression}`)
    }
    const clickLabel = async (label) => {
      const clicked = await evaluate(`(() => { const button = [...document.querySelectorAll('.ieb-screen button')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)}); if (!button || button.disabled) return false; button.scrollIntoView({ block: 'nearest' }); button.click(); return true })()`)
      if (!clicked) throw new Error(`Unavailable button: ${label}`)
      await sleep(30)
    }
    const clickText = async (text) => {
      const clicked = await evaluate(`(() => { const root = document.querySelector('.ieb-outcome') ?? document.querySelector('.ieb-screen'); const button = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) return false; button.scrollIntoView({ block: 'nearest' }); button.click(); return true })()`)
      if (!clicked) throw new Error(`Unavailable button: ${text}`)
      await sleep(30)
    }
    const capture = async (name) => {
      await sleep(250)
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      fs.writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(screenshot.data, 'base64'))
    }
    const verifyDialog = async () => {
      await waitFor("document.activeElement === document.querySelector('.ieb-outcome .ieb-primary')")
      const result = await evaluate(`(() => { const button = document.querySelector('.ieb-outcome .ieb-primary'), r = button.getBoundingClientRect(); return { visible: r.top >= 0 && r.bottom <= innerHeight + 1, overflow: document.documentElement.scrollWidth > innerWidth + 1, focused: document.activeElement === button, inert: document.querySelector('.ieb-layout').inert } })()`)
      if (!result.visible || result.overflow || !result.focused || !result.inert) throw new Error(`Dialog accessibility/layout: ${JSON.stringify(result)}`)
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.navigate', { url: appUrl })
    await waitFor("Boolean(document.querySelector('.name-screen'))")
    await evaluate(`sessionStorage.setItem('pixpy.session.v3', JSON.stringify({ name: 'Pedagogy review', username: 'pedagogyreview', isTeacher: true, completed: [] }))`)
    await send('Page.reload', { ignoreCache: true })
    await waitFor("Boolean(document.querySelector('.playground-home'))")
    const levels = await evaluate(`(async () => {
      const { ifElseProblems, problemLines } = await import('/src/data/ifElseBuilder.ts')
      const { ifElsePedagogy } = await import('/src/data/ifElsePedagogy.ts')
      const { splitCondition, evaluateCondition } = await import('/src/lib/ifElseLearning.ts')
      return ifElseProblems.map((problem, index) => ({ ...problem, pedagogy: ifElsePedagogy[index], lines: problemLines(problem, ifElsePedagogy[index].useInput), parts: splitCondition(problem.condition), truth: evaluateCondition(problem.condition, problem.variable, problem.initial) }))
    })()`)
    for (const size of [{ name: 'chromebook', width: 1366, height: 637 }, { name: 'ipad', width: 1024, height: 768 }, { name: 'compact', width: 852, height: 575 }, { name: 'mobile', width: 390, height: 844 }, { name: 'small-landscape', width: 740, height: 430 }]) {
      await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
      await send('Page.navigate', { url: `${appUrl}#/if-else` }); await send('Page.reload', { ignoreCache: true })
      await waitFor("Boolean(document.querySelector('.ieb-screen'))")
      if (size.height > size.width) {
        const rotationNotice = await evaluate("getComputedStyle(document.querySelector('.landscape-notice')).display !== 'none' && getComputedStyle(document.querySelector('.landscape-app')).visibility === 'hidden'")
        if (!rotationNotice) throw new Error('Portrait rotation notice missing')
        await capture(`rotation-${size.name}`)
        console.log(JSON.stringify({ viewport: size.name, rotationNotice: true }))
        continue
      }
      for (const [index, level] of levels.entries()) {
        const challenge = index + 1
        await waitFor(`document.querySelector('.ieb-counter')?.textContent.includes('Challenge ${String(challenge).padStart(2, '0')}')`)
        await evaluate("document.querySelector('.ieb-screen').scrollTop = 0")
        await capture(`level-${challenge}-${size.name}`)
        const overflow = await evaluate("document.documentElement.scrollWidth > innerWidth + 1 || document.querySelector('.ieb-screen').scrollWidth > document.querySelector('.ieb-screen').clientWidth + 1")
        if (overflow) throw new Error(`Overflow at level ${challenge}, ${size.name}`)
        if (level.pedagogy.requirePrediction === 'output') await clickLabel(`Predict ${level.trueOutput}`)
        if (level.pedagogy.useInput) await clickText(`Use starting value (${level.initial})`)
        if (level.pedagogy.requireDebugRun) {
          await clickText('CHECK CODE + RUN'); await waitFor("Boolean(document.querySelector('.ieb-outcome--wrong'))")
          await verifyDialog(); await capture(`debug-result-${size.name}`)
          const printed = await evaluate("document.querySelector('.ieb-outcome .ieb-trace').textContent")
          if (!printed.includes(level.falseOutput)) throw new Error('Debug program did not show its actual incorrect output')
          await clickText('TRY AGAIN')
        }
        if (['sequence', 'slot'].includes(level.pedagogy.construction)) {
          for (const [line, code] of level.lines.entries()) if (!level.pedagogy.prefilledLines.includes(line)) await clickLabel(`Add ${code.trim()}`)
        } else {
          for (const part of ['left', 'operator', 'right']) {
            if (level.pedagogy.construction === 'operator' && part !== 'operator') continue
            await clickLabel(`Choose ${part === 'operator' ? 'operator' : `${part} value`} ${level.parts[part]}`)
          }
        }
        if (level.pedagogy.construction === 'independent') {
          await clickLabel(`Use ${level.trueOutput} in IF`); await clickLabel(`Use ${level.falseOutput} in ELSE`)
        }
        if (level.pedagogy.requirePrediction === 'truth') await clickLabel(`Predict ${level.truth ? 'TRUE' : 'FALSE'}`)
        await clickText('CHECK CODE + RUN'); await waitFor("Boolean(document.querySelector('.ieb-outcome--success'))")
        await verifyDialog()
        if ([0, 3, 6, 9].includes(index)) await capture(`success-${challenge}-${size.name}`)
        const printed = await evaluate("document.querySelector('.ieb-outcome .ieb-trace').textContent")
        if (!printed.includes(level.truth ? level.trueOutput : level.falseOutput)) throw new Error(`Wrong output at ${challenge}`)
        await clickText(index === 9 ? 'FINISH ACTIVITY' : 'NEXT PROBLEM')
      }
      await waitFor("Boolean(document.querySelector('.ieb-finish'))")
      const saved = await evaluate("JSON.parse(sessionStorage.getItem('pixpy.session.v3'))")
      if (!saved.completed.includes('if-else') || !saved.ifElseLearning.some(e => e.kind === 'prediction')) throw new Error('Completion or learning records missing')
      await capture(`complete-${size.name}`)
      console.log(JSON.stringify({ viewport: size.name, levels: 10, completion: true, predictionHistory: true, screenshotDir: outputDir }))
    }
  } finally { socket?.close(); browser.kill() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
