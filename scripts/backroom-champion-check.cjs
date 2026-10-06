const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const appUrl = process.env.PIXPY_URL ?? 'http://127.0.0.1:5173/'
const browserPath = process.env.PIXPY_BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const port = 9248
const outputDir = path.join(os.tmpdir(), 'pixpy-backroom-champion-check')
fs.mkdirSync(outputDir, { recursive: true })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pixpy-backroom-champion-browser-'))
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

    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.navigate', { url: appUrl })
    await waitFor("Boolean(document.querySelector('.name-screen'))")
    const enter = async (best, gates = 10000) => {
      const progress = { name: 'Champion Review', username: 'review', isTeacher: true, completed: [], backroomRunBest: best, backroomRunGates: gates, backroomRunXp: 10050, backroomRunOperators: [] }
      await evaluate(`sessionStorage.setItem('pixpy.session.v3', ${JSON.stringify(JSON.stringify(progress))}); location.hash = '#/backroom-run'; window.__championBeforeReload = true`)
      await send('Page.reload', { ignoreCache: true })
      await waitFor("window.__championBeforeReload !== true && Boolean(document.querySelector('.br-screen'))")
    }
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 637, deviceScaleFactor: 1, mobile: false })
    await enter(669)
    if (await evaluate("Boolean(document.querySelector('.br-badge--champion'))")) throw new Error('Lifetime gates or a best of 669 awarded champion')
    await capture('not-yet-669')
    await enter(671)
    if (!await evaluate("Boolean(document.querySelector('.br-badge--champion'))")) throw new Error('Champion title missing above the threshold')
    for (const size of [{ name: 'desktop', width: 1366, height: 637 }, { name: 'tablet', width: 1024, height: 768 }, { name: 'compact', width: 852, height: 575 }, { name: 'phone-landscape', width: 740, height: 430 }]) {
      await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
      await enter(670)
      if (!await evaluate("document.querySelector('.br-badge--champion')?.textContent.includes('BACKROOM CHAMPION')")) throw new Error('Champion title missing at exactly 670')
      const layout = await evaluate("(() => { const badge = document.querySelector('.br-badge--champion').getBoundingClientRect(), stats = document.querySelector('.br-stats').getBoundingClientRect(), actions = document.querySelector('.br-actions').getBoundingClientRect(); return { overlap: badge.right > stats.left, overflow: actions.right > innerWidth || document.documentElement.scrollWidth > innerWidth + 1 } })()")
      if (layout.overlap || layout.overflow) throw new Error(`Champion HUD does not fit: ${JSON.stringify(layout)}`)
      await capture(`champion-running-${size.name}`)
      await clickText('CONDITIONS')
      await waitFor("Boolean(document.querySelector('.br-overlay--summary .br-champion-award'))")
      const award = await evaluate("(() => { const award = document.querySelector('.br-overlay--summary .br-champion-award'); const rect = award.getBoundingClientRect(); return { text: award.textContent, colour: getComputedStyle(award.querySelector('p')).color, fits: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight } })()")
      if (!award.text.includes('670 gates cleared in one run.') || award.colour !== 'rgb(23, 43, 58)' || !award.fits) throw new Error(`Champion summary failed: ${JSON.stringify(award)}`)
      await capture(`champion-summary-${size.name}`)
      console.log(JSON.stringify({ viewport: size.name, championAt670: true, championAbove670: true, noChampionAt669: true, ignoresLifetimeGates: true, summary: true, screenshotDir: outputDir }))
    }
  } finally { socket?.close(); browser.kill() }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
