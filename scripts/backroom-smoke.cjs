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
  const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--remote-debugging-port=9247', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
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
    const waitFor = async (predicate, description, tries = 120) => {
      for (let index = 0; index < tries; index += 1) {
        if (await evaluate(predicate)) return
        await sleep(100)
      }
      const state = await evaluate(`({ screen: document.querySelector('.br-screen')?.className, energy: document.querySelector('.br-variable strong')?.textContent, run: document.querySelector('.br-stat:first-child')?.textContent, xp: document.querySelector('.br-stat:nth-child(2)')?.textContent, crash: document.querySelector('.br-overlay--crash h2')?.textContent })`)
      throw new Error(`Timed out waiting for ${description}: ${JSON.stringify(state)}`)
    }
    const screenshot = async (name) => {
      const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      const file = path.join(outputDir, `${name}.png`)
      fs.writeFileSync(file, Buffer.from(result.data, 'base64'))
      return file
    }
    const travelToGate = async (gateNumber, noTurnBanner = false) => {
      let steering = 0
      let sawObstacle = false
      for (let index = 0; index < 300; index += 1) {
        const state = await evaluate(`(() => ({
          status: document.querySelector('.br-screen')?.className,
          run: document.querySelector('.br-stat:first-child')?.textContent,
          turn: document.querySelector('.br-turn')?.className || '',
          steer: document.querySelector('.br-steer')?.className || '',
        }))()`)
        if (state.status.includes('br-screen--crashed')) throw new Error(`Crashed in corridor: ${JSON.stringify(state)}`)
        if (noTurnBanner && state.turn) throw new Error(`Turn banner persisted after gate three: ${JSON.stringify(state)}`)
        if (!sawObstacle && (state.steer.includes('avoid-left') || state.steer.includes('avoid-right'))) {
          sawObstacle = true
          console.log(JSON.stringify({ obstacleRoute: gateNumber, screenshot: await screenshot(`obstacle-${gateNumber}`) }))
        }
        if (state.run.includes(String(gateNumber).padStart(3, '0'))) {
          if (steering !== 0) await evaluate(`document.querySelectorAll('.br-steer-button')[${steering < 0 ? 0 : 1}].dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, button: 0 }))`)
          if (!sawObstacle) throw new Error(`No obstacle appeared before gate ${gateNumber}`)
          return
        }
        const direction = state.steer.includes('avoid-left') ? -1 : state.steer.includes('avoid-right') ? 1 : state.steer.includes('is-left') ? -1 : state.steer.includes('is-right') ? 1 : 0
        if (direction !== steering) {
          if (steering !== 0) await evaluate(`document.querySelectorAll('.br-steer-button')[${steering < 0 ? 0 : 1}].dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, button: 0 }))`)
          if (direction !== 0) await evaluate(`document.querySelectorAll('.br-steer-button')[${direction < 0 ? 0 : 1}].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, button: 0 }))`)
          steering = direction
        }
        await sleep(200)
      }
      throw new Error(`Gate ${gateNumber} did not appear after the curved corridors`)
    }
    const solveCurrentGate = async () => {
      await evaluate(`(() => {
        const operator = document.querySelector('.br-operator').textContent
        const threshold = Number(document.querySelector('.br-condition strong').textContent)
        const current = Number(document.querySelector('.br-variable strong').textContent)
        const target = operator === '>' ? threshold + 1 : operator === '<' ? threshold - 1 : operator === '>=' || operator === '==' || operator === '<=' ? threshold : threshold + 1
        const button = document.querySelector(target > current ? '[aria-label="Increase energy"]' : '[aria-label="Decrease energy"]')
        for (let index = 0; index < Math.abs(target - current); index += 1) button.click()
      })()`)
      await waitFor("document.querySelector('.br-screen')?.classList.contains('is-true')", 'true gate condition')
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1448, height: 1086, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url })
    await waitFor("Boolean(document.querySelector('.name-screen'))", 'name screen')
    const session = { name: 'Leo', username: 'leleomaker', isTeacher: true, completed: [], backroomRunGates: 0, backroomRunXp: 0, backroomRunBest: 0, backroomRunOperators: [] }
    await evaluate(`sessionStorage.setItem('pixpy.session.v3', ${JSON.stringify(JSON.stringify(session))})`)
    await send('Page.navigate', { url: `${url}#/backroom-run` })
    await send('Page.reload', { ignoreCache: true })
    await waitFor("Boolean(document.querySelector('.br-screen'))", 'runner')
    await sleep(200)
    const initial = await evaluate(`(() => ({
      header: getComputedStyle(document.querySelector('.app-header')).display,
      condition: document.querySelector('.br-condition')?.textContent,
      energy: document.querySelector('.br-variable')?.textContent,
      slider: Boolean(document.querySelector('input[type=range]')),
      buttons: [...document.querySelectorAll('.br-energy-button')].map((button) => button.getAttribute('aria-label')),
    }))()`)
    if (initial.header === 'none' || !initial.condition.includes('required_energy') || initial.slider || initial.buttons.length !== 2) throw new Error(`Initial UI failed: ${JSON.stringify(initial)}`)
    console.log(JSON.stringify({ initial, screenshot: await screenshot('initial') }))

    await evaluate(`(() => { const screen = document.querySelector('.br-screen'); screen.focus(); screen.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true })); screen.dispatchEvent(new KeyboardEvent('keyup', { key: 'd', bubbles: true })) })()`)
    await waitFor("document.querySelector('.br-variable strong')?.textContent === '31'", 'D raises energy')
    await evaluate(`(() => { const screen = document.querySelector('.br-screen'); screen.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); screen.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true })) })()`)
    await waitFor("document.querySelector('.br-variable strong')?.textContent === '30'", 'A lowers energy')
    await evaluate(`document.querySelector('.br-screen').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`)
    await sleep(300)
    const arrowMotion = Number(await evaluate("document.querySelector('.br-screen')?.style.getPropertyValue('--wall-right')"))
    await evaluate(`document.querySelector('.br-screen').dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }))`)
    if (arrowMotion <= 0) throw new Error('Right arrow did not move the player')

    await evaluate(`document.querySelector('.br-actions button[aria-label="Pause run"]').click()`)
    await waitFor("document.querySelector('.br-screen')?.classList.contains('br-screen--paused')", 'pause')
    await evaluate(`document.querySelector('.br-overlay .br-primary').click()`)
    await waitFor("document.querySelector('.br-screen')?.classList.contains('br-screen--running')", 'resume')

    await evaluate(`document.querySelector('[aria-label="Increase energy"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }))`)
    await sleep(800)
    await evaluate(`(() => { const button = document.querySelector('[aria-label="Increase energy"]'); button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, button: 0 })); button.click() })()`)
    const afterHold = Number(await evaluate("document.querySelector('.br-variable strong')?.textContent"))
    if (afterHold < 32) throw new Error(`Hold did not repeat: ${afterHold}`)
    await evaluate(`(() => { const button = document.querySelector('[aria-label="Increase energy"]'); for (let index = ${afterHold}; index < 72; index += 1) button.click() })()`)
    await waitFor("document.querySelector('.br-screen')?.classList.contains('is-true')", 'true condition')
    await sleep(250)
    console.log(JSON.stringify({ trueEnergy: await evaluate("document.querySelector('.br-variable strong')?.textContent"), screenshot: await screenshot('open') }))
    await waitFor("document.querySelector('.br-stat:nth-child(2)')?.textContent.includes('15')", 'gate XP', 350)
    console.log(JSON.stringify({ passed: true, xp: await evaluate("document.querySelector('.br-stat:nth-child(2)')?.textContent"), screenshot: await screenshot('passed') }))

    await travelToGate(2)
    const nextGate = await evaluate(`({ run: document.querySelector('.br-stat:first-child')?.textContent, pace: document.querySelector('.br-stat--pace')?.textContent, condition: document.querySelector('.br-condition')?.textContent })`)
    if (!nextGate.pace.includes('1.1')) throw new Error(`Pace did not increase: ${JSON.stringify(nextGate)}`)
    await sleep(500)
    const gate2State = await evaluate(`(() => { const screen = document.querySelector('.br-screen'); return { status: screen?.className, wallLeft: Number(screen?.style.getPropertyValue('--wall-left')), wallRight: Number(screen?.style.getPropertyValue('--wall-right')) } })()`)
    if (gate2State.status.includes('crashed') || gate2State.status.includes('is-true') || gate2State.wallLeft > 0.5 || gate2State.wallRight > 0.5) throw new Error(`Second gate was not ready to play: ${JSON.stringify(gate2State)}`)
    console.log(JSON.stringify({ nextGate, screenshot: await screenshot('gate-2') }))
    if (process.env.PIXPY_VISUAL_CHECK === '1') return

    for (const size of [{ name: 'chromebook', width: 1366, height: 637 }, { name: 'compact', width: 852, height: 575 }]) {
      await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
      await sleep(250)
      const metrics = await evaluate(`(() => {
        const box = (selector) => { const rect = document.querySelector(selector)?.getBoundingClientRect(); return rect && { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } }
        return { viewport: [innerWidth, innerHeight], header: box('.app-header'), game: box('.br-screen'), energy: box('.br-panel'), steering: box('.br-steer') }
      })()`)
      if (metrics.energy.bottom > size.height || metrics.steering.right > size.width || metrics.game.top < metrics.header.bottom - 2) throw new Error(`Layout failed: ${JSON.stringify(metrics)}`)
      console.log(JSON.stringify({ size: size.name, metrics, screenshot: await screenshot(size.name) }))
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 1448, height: 1086, deviceScaleFactor: 1, mobile: false })
    await solveCurrentGate()
    await waitFor("document.querySelector('.br-stat:nth-child(2)')?.textContent.includes('30')", 'second gate XP', 250)
    await travelToGate(3)
    const thirdGate = await evaluate(`({ run: document.querySelector('.br-stat:first-child')?.textContent, pace: document.querySelector('.br-stat--pace')?.textContent, condition: document.querySelector('.br-condition')?.textContent })`)
    if (!thirdGate.pace.includes('1.2')) throw new Error(`Pace did not increase again: ${JSON.stringify(thirdGate)}`)
    console.log(JSON.stringify({ thirdGate, screenshot: await screenshot('gate-3') }))
    await solveCurrentGate()
    await waitFor("document.querySelector('.br-stat:nth-child(2)')?.textContent.includes('45')", 'third gate XP', 250)
    await travelToGate(4, true)
    const fourthGate = await evaluate(`({ run: document.querySelector('.br-stat:first-child')?.textContent, pace: document.querySelector('.br-stat--pace')?.textContent, banner: Boolean(document.querySelector('.br-turn')) })`)
    if (!fourthGate.pace.includes('1.3') || fourthGate.banner) throw new Error(`Fourth gate progression failed: ${JSON.stringify(fourthGate)}`)
    console.log(JSON.stringify({ fourthGate, screenshot: await screenshot('gate-4') }))
    await waitFor("document.querySelector('.br-screen')?.classList.contains('br-screen--crashed')", 'closed fourth gate collision', 350)
    const blocked = await evaluate(`({ gates: document.querySelector('.br-summary-grid article:first-child strong')?.textContent, xp: document.querySelector('.br-stat:nth-child(2)')?.textContent, reason: document.querySelector('.br-overlay--crash h2')?.textContent })`)
    if (blocked.gates !== '3' || !blocked.xp.includes('45') || blocked.reason !== 'THE GATE STAYED CLOSED') throw new Error(`Blocked gate validation failed: ${JSON.stringify(blocked)}`)
    await evaluate("document.querySelector('.br-overlay--crash .br-primary').click()")
    await waitFor("document.querySelector('.br-stat:first-child')?.textContent.includes('001') && document.querySelector('.br-screen')?.classList.contains('br-screen--running')", 'restart at gate one')
    console.log(JSON.stringify({ blocked, restarted: true }))
  } finally {
    socket?.close()
    browser.kill()
    await sleep(400)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* Browser may still be releasing files. */ }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
