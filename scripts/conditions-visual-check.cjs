const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const browserPath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const port = 9235
const appUrl = process.env.PIXPY_URL ?? 'http://127.0.0.1:5173/'
const outputDir = path.join(os.tmpdir(), 'pixpy-conditions-check')
fs.mkdirSync(outputDir, { recursive: true })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const session = { name: 'Leo', username: 'leleomaker', isTeacher: true, completed: [] }

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pixpy-conditions-browser-'))
  const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
  let socket
  try {
    let tab
    for (let tries = 0; tries < 60; tries += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
        tab = await response.json()
        break
      } catch { await sleep(250) }
    }
    if (!tab) throw new Error('Could not start the browser')
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
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value
    const waitFor = async (selector) => {
      for (let tries = 0; tries < 80; tries += 1) {
        if (await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)) return
        await sleep(100)
      }
      throw new Error(`Timed out waiting for ${selector}`)
    }
    const capture = async (name) => {
      await sleep(300)
      const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      const screenshotPath = path.join(outputDir, `${name}.png`)
      fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'))
      const metrics = await evaluate(`(() => {
        const box = (selector) => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r && { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom) } }
        return { viewport: { width: innerWidth, height: innerHeight }, documentScroll: document.documentElement.scrollHeight > innerHeight + 1, world: box('.conditions-home'), firstCard: box('.conditions-home .experience-card:first-child'), secondCard: box('.conditions-home .experience-card:nth-child(2)'), fifthCard: box('.conditions-home .experience-card:nth-child(5)'), intro: box('.cm-intro'), lesson: box('.cm-lesson'), story: box('.cm-story'), quiz: box('.cm-quiz'), screenshotPath: ${JSON.stringify(screenshotPath)} }
      })()`)
      console.log(JSON.stringify({ name, ...metrics }))
    }

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Page.navigate', { url: appUrl })
    await waitFor('.name-screen')
    await evaluate(`sessionStorage.setItem('pixpy.session.v3', ${JSON.stringify(JSON.stringify(session))})`)
    await send('Page.reload', { ignoreCache: true })
    for (const size of [{ name: 'chromebook', width: 1366, height: 637 }, { name: 'ipad', width: 1024, height: 768 }, { name: 'compact', width: 852, height: 575 }, { name: 'mobile', width: 390, height: 844 }]) {
      await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
      await send('Page.navigate', { url: `${appUrl}#/conditionals` })
      await evaluate(`sessionStorage.setItem('pixpy.session.v3', ${JSON.stringify(JSON.stringify(session))})`)
      await send('Page.reload', { ignoreCache: true })
      await sleep(500)
      await waitFor('.conditions-home')
      await capture(`world-${size.name}`)
      await send('Page.navigate', { url: `${appUrl}#/choice-machine` })
      await waitFor('.cm-intro')
      await capture(`intro-${size.name}`)
      await evaluate(`document.querySelector('.cm-intro .cm-primary').click()`)
      await waitFor('.cm-lesson')
      await capture(`lesson-${size.name}`)
      if (size.name === 'chromebook') {
        for (const [scene, answer] of [['rain', 0], ['password', 1], ['grade', 0]]) {
          if (scene !== 'rain') await capture(`lesson-${scene}-chromebook`)
          await evaluate(`document.querySelectorAll('.cm-choice-buttons button')[${answer}].click()`)
          await sleep(30)
          await evaluate(`document.querySelector('.cm-lesson-content .cm-primary').click()`)
          await sleep(30)
        }
        await waitFor('.cm-story')
        await capture('story-chromebook')
        for (let storyIndex = 0; storyIndex < 3; storyIndex += 1) {
          for (const valueIndex of [0, 1]) {
            await evaluate(`document.querySelectorAll('.cm-value-picker button')[${valueIndex}].click()`)
            for (let step = 0; step < 4; step += 1) {
              await evaluate(`document.querySelector('.cm-story-bottom .cm-primary').click()`)
              await sleep(25)
            }
            if (storyIndex === 0 && valueIndex === 0) await capture('story-path-chromebook')
            await evaluate(`document.querySelector('.cm-story-bottom .cm-primary').click()`)
            await sleep(40)
          }
        }
        await waitFor('.cm-quiz-intro')
        await evaluate(`document.querySelector('.cm-quiz-intro .cm-primary').click()`)
        await waitFor('.cm-quiz')
        await capture('quiz-chromebook')
      }
    }
  } finally {
    socket?.close()
    browser.kill()
    await sleep(500)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* Browser may still be releasing files. */ }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
