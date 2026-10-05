const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const appUrl = process.env.PIXPY_URL ?? 'http://127.0.0.1:5173/'
const browserPath = process.env.PIXPY_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const port = 9242
const outputDir = path.join(os.tmpdir(), 'pixpy-choice-refresh-check')
fs.mkdirSync(outputDir, { recursive: true })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pixpy-choice-refresh-browser-'))
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
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      return result.result.value
    }
    const waitFor = async (expression) => {
      for (let tries = 0; tries < 160; tries += 1) {
        if (await evaluate(expression)) return
        await sleep(100)
      }
      const state = await evaluate("({ url: location.href, text: document.body.innerText.slice(0, 800) })")
      console.error(JSON.stringify(state))
      await capture('failed-state')
      throw new Error(`Timed out: ${expression}`)
    }
    const clickLabel = async (label) => {
      const clicked = await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)}); if (!button || button.disabled) return false; button.scrollIntoView({ block: 'nearest' }); button.click(); return true })()`)
      if (!clicked) throw new Error(`Unavailable button: ${label}`)
      await sleep(30)
    }
    const clickText = async (text) => {
      const clicked = await evaluate(`(() => { const root = document.body; const button = [...root.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) return false; button.scrollIntoView({ block: 'nearest' }); button.click(); return true })()`)
      if (!clicked) throw new Error(`Unavailable button: ${text}`)
      await sleep(30)
    }
    const capture = async (name) => {
      await sleep(250)
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      fs.writeFileSync(path.join(outputDir, `${name}.png`), Buffer.from(screenshot.data, 'base64'))
    }
    const roster = [
      { username: 'adareview', display_name: 'Ada Review', class_name: 'A', group_name: 'white', progress: { completed: ['backroom-run'], backroomRunGates: 18, backroomRunBest: 12, backroomRunXp: 450, choiceMachineIntroComplete: true, choiceMachineStoriesComplete: true, choiceMachineQuizIndex: 8, choiceMachineXp: 80, ifElseLearning: [
        { level: 1, mode: 'observe', kind: 'check', attempt: 1, value: 12, prediction: null, actualOutput: 'Correct output', conditionResult: true, errorKind: null, at: 1 },
        { level: 4, mode: 'prediction', kind: 'prediction', attempt: 0, value: 12, prediction: 'An output', actualOutput: null, conditionResult: null, errorKind: null, at: 2 },
        { level: 4, mode: 'prediction', kind: 'check', attempt: 1, value: 12, prediction: 'An output', actualOutput: 'An output', conditionResult: true, errorKind: null, at: 3 },
        { level: 7, mode: 'debug', kind: 'check', attempt: 1, value: 12, prediction: null, actualOutput: 'Another output', conditionResult: false, errorKind: 'logic', at: 4 },
      ] }, updated_at: '2026-10-05T15:00:00Z', last_login_at: null },
      { username: 'benreview', display_name: 'Ben Review', class_name: 'B', group_name: 'yellow', progress: { completed: ['backroom-run', 'choice-machine', 'if-else'], backroomRunGates: 9, backroomRunBest: 7, backroomRunXp: 250, choiceMachineXp: 200 }, updated_at: '2026-10-05T15:00:00Z', last_login_at: null },
      { username: 'claireview', display_name: 'Clai Review', class_name: 'C', group_name: null, progress: null, updated_at: null, last_login_at: null },
    ]
    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const realFetch = window.fetch.bind(window); window.fetch = (input, init) => String(input instanceof Request ? input.url : input).includes('pixpy_class_progress') ? Promise.resolve(new Response(JSON.stringify(${JSON.stringify(roster)}), { status: 200, headers: { 'Content-Type': 'application/json' } })) : realFetch(input, init) })()` })
    await send('Page.navigate', { url: appUrl })
    await waitFor("Boolean(document.querySelector('.name-screen'))")
    const go = async (route) => {
      await evaluate(`location.hash = '#/${route}'`)
      await sleep(120)
    }
    const noOverflow = async () => {
      if (await evaluate('document.documentElement.scrollWidth > innerWidth + 1')) throw new Error('Page overflows horizontally')
    }
    for (const size of [{ name: 'desktop', width: 1366, height: 637 }, { name: 'tablet', width: 1024, height: 768 }, { name: 'compact', width: 852, height: 575 }, { name: 'phone-landscape', width: 740, height: 430 }]) {
      await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
      await evaluate(`sessionStorage.setItem('pixpy.session.v3', JSON.stringify({ name: 'Review', username: 'review', isTeacher: true, completed: [] })); location.hash = '#/home'`)
      await evaluate('window.__choiceCheckBeforeReload = true')
      await send('Page.reload', { ignoreCache: true })
      await waitFor("window.__choiceCheckBeforeReload !== true && Boolean(document.querySelector('.world-grid [aria-label=\"Open Variables\"]'))")
      const home = await evaluate(`(() => { const a = document.querySelector('[aria-label="Open Variables"]').getBoundingClientRect(), b = document.querySelector('[aria-label="Open Conditions"]').getBoundingClientRect(); return { sameWidth: Math.abs(a.width - b.width) < 1, sameHeight: Math.abs(a.height - b.height) < 1, pulse: getComputedStyle(document.querySelector('.world-card.is-featured')).animationName } })()`)
      if (!home.sameWidth || !home.sameHeight || home.pulse === 'none') throw new Error(`Home cards: ${JSON.stringify(home)}`)
      await noOverflow(); await capture(`home-${size.name}`)
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      if (await evaluate("getComputedStyle(document.querySelector('.world-card.is-featured')).animationName !== 'none'")) throw new Error('Reduced motion not respected')
      await send('Emulation.setEmulatedMedia', { features: [] })
      await go('choice-machine')
      await waitFor("Boolean(document.querySelector('.cm-step-cards'))")
      const enabled = await evaluate("[...document.querySelectorAll('.cm-step-card')].filter(b => !b.disabled).length")
      if (enabled !== 1) throw new Error('The first visit should unlock only Intro')
      await noOverflow(); await capture(`steps-first-${size.name}`)
      if (size.height <= 480 && !await evaluate("document.querySelector('[aria-label=\"Intro\"]').getBoundingClientRect().bottom <= innerHeight")) throw new Error('Intro card extends below the small landscape viewport')
      await clickLabel('Intro')
      await waitFor("Boolean(document.querySelector('.cm-intro'))")
      await noOverflow(); await capture(`intro-${size.name}`)
      await clickText('START LEARNING')
      await waitFor("Boolean(document.querySelector('.cm-life-choice--rain'))")
      await noOverflow(); await capture(`rain-${size.name}`)
      await clickLabel('Leave the umbrella')
      await waitFor("Boolean(document.querySelector('.cm-feedback.is-wrong'))")
      if (size.name === 'desktop') await capture('rain-wrong-desktop')
      await clickLabel('Take an umbrella')
      await waitFor("Boolean(document.querySelector('.cm-feedback.is-correct'))")
      await clickText('NEXT SITUATION')
      await waitFor("Boolean(document.querySelector('.cm-life-choice--password'))")
      if (size.name === 'desktop') await capture('password-desktop')
      await clickLabel('Show an error'); await clickText('NEXT SITUATION')
      await waitFor("Boolean(document.querySelector('.cm-life-choice--grade'))")
      if (size.name === 'desktop') await capture('grade-desktop')
      await clickLabel('Approved'); await clickText('FINISH INTRO')
      await waitFor("Boolean(document.querySelector('.cm-step-cards'))")
      if (await evaluate("document.querySelector('[aria-label=\"Live flow\"]').disabled")) throw new Error('Intro did not unlock Live flow')
      await go('home'); await go('choice-machine')
      await waitFor("Boolean(document.querySelector('.cm-step-cards'))")
      if (await evaluate("[...document.querySelectorAll('.cm-step-card')].some(b => b.disabled)")) throw new Error('Returning students must be able to replay all steps')
      await capture(`steps-returning-${size.name}`)
      await go('teacher')
      await waitFor("Boolean(document.querySelector('.teacher-table-wrap tbody tr'))")
      await clickText('Conditions')
      await waitFor("Boolean(document.querySelector('.teacher-roster--conditions'))")
      if (!await evaluate("document.body.innerText.includes('18 gates') && document.body.innerText.includes('Last check: Logic error') && document.body.innerText.includes('10 / 10 levels solved')")) throw new Error('Dashboard data missing')
      const completed = await evaluate("document.querySelector('.teacher-summary article:last-child strong').textContent")
      if (completed !== '1') throw new Error('Disabled activities incorrectly affect completion')
      await noOverflow(); await capture(`dashboard-${size.name}`)
      console.log(JSON.stringify({ viewport: size.name, equalWorldCards: true, pulse: true, choiceSteps: true, intro: true, dashboard: true, screenshotDir: outputDir }))
    }
  } finally { socket?.close(); browser.kill() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
