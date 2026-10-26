const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const url = process.env.PIXPY_URL || 'http://127.0.0.1:5173/'
const outputDir = path.join(os.tmpdir(), 'pixpy-backroom-smoke')
fs.mkdirSync(outputDir, { recursive: true })

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pixpy-backroom-browser-'))
  const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--remote-debugging-port=9247', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
  let socket
  try {
    let tab
    for (let index = 0; index < 60; index += 1) {
      try { tab = await (await fetch('http://127.0.0.1:9247/json/new?about:blank', { method: 'PUT' })).json(); break }
      catch { await sleep(250) }
    }
    if (!tab) throw new Error('Browser did not start')
    socket = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((resolve) => { socket.onopen = resolve })
    let id = 0
    const pending = new Map()
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data)
      const callback = pending.get(message.id)
      if (!callback) return
      pending.delete(message.id)
      message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result)
    }
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      id += 1
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async (expression) => {
      const result = (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
      return result.value
    }
    const errors = []
    const waitFor = async (predicate, description, tries = 120) => {
      for (let index = 0; index < tries; index += 1) {
        if (await evaluate(predicate)) return
        await sleep(100)
      }
      const state = await evaluate(`({ screen: document.querySelector('.br-screen')?.className, code: document.querySelector('.br-code')?.textContent, coach: document.querySelector('.br-coach')?.textContent })`)
      throw new Error(`Timed out waiting for ${description}: ${JSON.stringify(state)}`)
    }
    const screenshot = async (name) => {
      const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      const file = path.join(outputDir, `${name}.png`)
      fs.writeFileSync(file, Buffer.from(result.data, 'base64'))
      return file
    }
    const key = (type, name) => evaluate(`window.dispatchEvent(new KeyboardEvent('${type}', { key: '${name}', bubbles: true }))`)
    const status = (name) => `document.querySelector('.br-screen')?.classList.contains('br-screen--${name}')`
    const overflow = () => evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth')

    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '))
    })
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1448, height: 1086, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url })
    await waitFor("Boolean(document.querySelector('.name-screen'))", 'name screen')
    // A teacher session: nothing is written to the classroom cloud.
    const session = { name: 'Leo', username: 'leleomaker', isTeacher: true, completed: [], backroomRunGates: 0, backroomRunXp: 0, backroomRunBest: 0, backroomRunOperators: [] }
    await evaluate(`sessionStorage.setItem('pixpy.session.v3', ${JSON.stringify(JSON.stringify(session))})`)
    await send('Page.navigate', { url: `${url}#/backroom-run` })
    await send('Page.reload', { ignoreCache: true })

    // The tape library opens first and says the gates run Python.
    await waitFor("Boolean(document.querySelector('.br-menu'))", 'tape library')
    const menu = await evaluate("({ text: document.querySelector('.br-menu-intro').textContent, tapes: document.querySelectorAll('.br-tape').length, header: getComputedStyle(document.querySelector('.app-header')).display })")
    if (!menu.text.includes('runs Python') || menu.text.includes('C#') || menu.tapes !== 5 || menu.header === 'none') throw new Error(`Tape library failed: ${JSON.stringify(menu)}`)
    if (await overflow()) throw new Error('Tape library overflows the page')
    console.log(JSON.stringify({ menu: true, screenshot: await screenshot('menu') }))

    // Tape 01 loads in the camcorder, then the briefing.
    await evaluate("document.querySelector('.br-tape').click()")
    await waitFor("Boolean(document.querySelector('.br-deck'))", 'tape deck')
    await sleep(1800)
    console.log(JSON.stringify({ tapeDeck: true, screenshot: await screenshot('tape-deck') }))
    await evaluate("document.querySelector('.br-deck-skip').click()")
    await waitFor(status('briefing'), 'briefing')
    console.log(JSON.stringify({ briefing: true, screenshot: await screenshot('briefing') }))

    // Press play: the entry door opens and the first gate is written in Python.
    await evaluate("document.querySelector('.br-overlay--briefing .br-primary').click()")
    await waitFor(status('running'), 'running')
    await sleep(600)
    const code = await evaluate("[...document.querySelectorAll('.br-code-line')].map((line) => line.textContent)")
    if (code[0] !== 'energy = 20' || !code[1]?.startsWith('if energy > 50:')) throw new Error(`Gate code is not Python: ${JSON.stringify(code)}`)
    console.log(JSON.stringify({ code, screenshot: await screenshot('running') }))

    // The field guide stops the first gate until the condition is TRUE.
    await waitFor("Boolean(document.querySelector('.br-coach--energy'))", 'energy field guide', 200)
    console.log(JSON.stringify({ coach: true, screenshot: await screenshot('coach') }))
    for (let index = 0; index < 31; index += 1) { await key('keydown', 'ArrowUp'); await key('keyup', 'ArrowUp') }
    await waitFor("document.querySelector('.br-slot')?.textContent === '51' && document.querySelector('.br-truth')?.textContent === 'TRUE'", 'energy raised to 51')
    await waitFor(status('running'), 'guide closes once TRUE', 60)
    await waitFor("Boolean(document.querySelector('.br-reveal'))", 'gate opens', 120)
    const reveal = await evaluate("document.querySelector('.br-reveal').textContent")
    if (!reveal.includes('51 > 50') || !reveal.includes('TRUE')) throw new Error(`Gate reveal failed: ${reveal}`)
    console.log(JSON.stringify({ reveal, screenshot: await screenshot('gate-open') }))

    // iPad landscape: the library still fits without sideways scrolling.
    await key('keydown', 'Escape')
    await waitFor(status('paused'), 'pause')
    await evaluate("[...document.querySelectorAll('.br-overlay--paused button')].find((button) => button.textContent.includes('TAPES')).click()")
    await waitFor("Boolean(document.querySelector('.br-menu'))", 'back to the tapes')
    await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false })
    await sleep(400)
    if (await overflow() || !await evaluate("Boolean(document.querySelector('.br-menu .br-tape'))")) throw new Error('Tape library does not fit on an iPad')
    console.log(JSON.stringify({ ipad: true, screenshot: await screenshot('menu-ipad') }))

    if (errors.length) throw new Error(`Browser errors: ${JSON.stringify(errors)}`)
    console.log(JSON.stringify({ passed: true, output: outputDir }))
  } finally {
    socket?.close()
    browser.kill()
    await sleep(400)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* Browser may still be releasing files. */ }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
