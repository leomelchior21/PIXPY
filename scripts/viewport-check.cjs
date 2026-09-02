const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const port = 9234
const appUrl = process.env.PIXPY_URL ?? 'http://127.0.0.1:5173/'
const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((candidate) => fs.existsSync(candidate))

if (!browserPath) throw new Error('No supported browser executable found.')

const targetSizes = [
  { name: 'ipad-portrait', width: 768, height: 1024 },
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'modern-ipad-landscape', width: 1180, height: 820 },
  { name: 'chromebook', width: 1366, height: 768 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'desktop', width: 1920, height: 1080 },
]

const routes = [
  { name: 'home', route: 'home', selector: '.playground-home' },
  { name: 'variables', route: 'variables', selector: '.variables-home' },
  { name: 'dino', route: 'dino-variables', selector: '.dino-experience', experience: true, surface: '.dino-game canvas' },
  { name: 'print', route: 'print-playground', selector: '.print-experience', experience: true, surface: '.pixpy-editor' },
  { name: 'black-box', route: 'black-box', selector: '.blackbox-experience', experience: true, surface: '.real-black-box' },
  { name: 'input', route: 'input-machine', selector: '.input-experience', experience: true, surface: '.vending-machine' },
  { name: 'memory', route: 'memory-machine', selector: '.memory-experience', experience: true, surface: '.memory-code-lines' },
  { name: 'build', route: 'build-black-box', selector: '.buildbox-experience', experience: true, surface: '.pixpy-editor' },
  { name: 'bosses', route: 'final-bosses', selector: '.boss-experience', experience: true, surface: '.boss-grid' },
]

const outputDir = path.join(os.tmpdir(), 'pixpy-viewport-checks')
const resolvedOutput = path.resolve(outputDir)
const resolvedTemp = `${path.resolve(os.tmpdir())}${path.sep}`
if (!resolvedOutput.startsWith(resolvedTemp)) throw new Error('Viewport output must stay inside the system temp directory.')
fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })

const session = {
  name: 'Leo',
  completed: [],
  blackBoxLevels: [],
  blackBoxQuizAnswers: [],
  inputModes: [],
  memoryExamples: [],
  memoryQuizAnswers: [],
  bossProgress: [],
  blackBoxCode: 'number = int(input())\n\nresult = number * 2\n\nprint(result)',
  blackBoxTests: [],
  interestingValues: [],
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function fetchJson(url, init) {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`)
  return response.json()
}

async function waitForBrowser() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { await fetchJson(`http://127.0.0.1:${port}/json/version`); return } catch { await sleep(250) }
  }
  throw new Error('Timed out waiting for browser DevTools.')
}

async function makeClient() {
  const tab = await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
  const socket = new WebSocket(tab.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  }
  await new Promise((resolve) => { socket.onopen = resolve })
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        id += 1
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params }))
      })
    },
    close() { socket.close() },
  }
}

async function waitFor(send, expression, timeout = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true })
    if (result.result.value) return
    await sleep(150)
  }
  throw new Error(`Timed out waiting for ${expression}`)
}

function visibleRectExpression(selector) {
  return `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
  })()`
}

async function seedSession(send) {
  await send('Page.navigate', { url: appUrl })
  await waitFor(send, 'document.readyState === "complete"')
  await send('Runtime.evaluate', {
    expression: `sessionStorage.setItem('pixpy.session.v2', ${JSON.stringify(JSON.stringify(session))})`,
    returnByValue: true,
  })
  await send('Page.navigate', { url: `${appUrl}#/home` })
  await send('Page.reload', { ignoreCache: true })
  await waitFor(send, 'Boolean(document.querySelector(".playground-home"))')
}

async function checkNameEntry(send, size) {
  await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: appUrl })
  await waitFor(send, 'document.readyState === "complete"')
  await send('Runtime.evaluate', { expression: `sessionStorage.removeItem('pixpy.session.v2')` })
  await send('Page.reload', { ignoreCache: true })
  await waitFor(send, 'Boolean(document.querySelector(".name-screen"))')
  await sleep(700)
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('.name-screen');
      const rect = root.getBoundingClientRect();
      const input = document.querySelector('#student-name');
      return {
        size: ${JSON.stringify(size.name)},
        hasDocumentVerticalScroll: document.documentElement.scrollHeight > innerHeight + 1 || document.body.scrollHeight > innerHeight + 1,
        rootInsideViewport: rect.top >= -1 && rect.bottom <= innerHeight + 1,
        formVisible: ${visibleRectExpression('.name-card')},
        inputVisible: ${visibleRectExpression('#student-name')},
        placeholderCorrect: input?.placeholder === 'insert your name',
      };
    })()`,
    returnByValue: true,
  })
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const screenshotPath = path.join(outputDir, `name-${size.name}.png`)
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  return { ...result.result.value, screenshotPath }
}

async function collectRouteMetrics(send, size, routeConfig) {
  await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${appUrl}#/${routeConfig.route}` })
  await waitFor(send, `Boolean(document.querySelector(${JSON.stringify(routeConfig.selector)}))`)
  await sleep(400)
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const page = document.documentElement;
      const body = document.body;
      const root = document.querySelector(${JSON.stringify(routeConfig.selector)});
      const rect = root.getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentScrollHeight: page.scrollHeight,
        hasDocumentVerticalScroll: page.scrollHeight > innerHeight + 1 || body.scrollHeight > innerHeight + 1,
        rootTop: Math.round(rect.top),
        rootBottom: Math.round(rect.bottom),
        rootInsideViewport: rect.top >= -1 && rect.bottom <= innerHeight + 1,
        navVisible: ${visibleRectExpression('.app-header nav')},
        quickListVisible: ${visibleRectExpression('.quick-list-button')},
        experienceHeaderVisible: ${routeConfig.experience ? visibleRectExpression('.experience-header') : 'true'},
        hintVisible: ${routeConfig.experience ? visibleRectExpression('.hint-button') : 'true'},
        surfaceVisible: ${routeConfig.surface ? visibleRectExpression(routeConfig.surface) : 'true'},
      };
    })()`,
    returnByValue: true,
  })
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const screenshotPath = path.join(outputDir, `${routeConfig.name}-${size.name}.png`)
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  return { route: routeConfig.name, size: size.name, screenshotPath, ...result.result.value }
}

async function checkPrintView(send) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${appUrl}#/variables` })
  await waitFor(send, 'Boolean(document.querySelector(".variables-home"))')
  await send('Emulation.setEmulatedMedia', { media: 'print' })
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const printable = document.querySelector('.print-progress');
      const app = document.querySelector('.app-content');
      return {
        printVisible: getComputedStyle(printable).display !== 'none',
        websiteHidden: getComputedStyle(app).display === 'none',
        studentVisible: printable.innerText.includes('Leo'),
        progressVisible: printable.innerText.includes('My Variables Progress'),
      };
    })()`,
    returnByValue: true,
  })
  const pdf = await send('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: .45, marginBottom: .45, marginLeft: .45, marginRight: .45 })
  const pdfPath = path.join(outputDir, 'print-progress.pdf')
  fs.writeFileSync(pdfPath, Buffer.from(pdf.data, 'base64'))
  await send('Emulation.setEmulatedMedia', { media: 'screen' })
  return { ...result.result.value, pdfPath, pdfBytes: Buffer.byteLength(pdf.data, 'base64') }
}

async function checkMemoryQuiz(send, size) {
  const quizSession = { ...session, memoryExamples: ['create', 'change', 'two', 'reuse', 'input'], memoryQuizAnswers: [] }
  await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
  await send('Runtime.evaluate', { expression: `sessionStorage.setItem('pixpy.session.v2', ${JSON.stringify(JSON.stringify(quizSession))})` })
  await send('Page.navigate', { url: `${appUrl}#/memory-machine` })
  await send('Page.reload', { ignoreCache: true })
  await waitFor(send, 'Boolean(document.querySelector(".memory-quiz"))')
  await sleep(250)
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('.memory-quiz-experience');
      const rect = root.getBoundingClientRect();
      return {
        size: ${JSON.stringify(size.name)},
        hasDocumentVerticalScroll: document.documentElement.scrollHeight > innerHeight + 1 || document.body.scrollHeight > innerHeight + 1,
        rootInsideViewport: rect.top >= -1 && rect.bottom <= innerHeight + 1,
        quizVisible: ${visibleRectExpression('.memory-quiz')},
        codeVisible: ${visibleRectExpression('.memory-quiz-code')},
        optionCount: document.querySelectorAll('.memory-quiz-options button').length,
      };
    })()`,
    returnByValue: true,
  })
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const screenshotPath = path.join(outputDir, `memory-quiz-${size.name}.png`)
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  await send('Runtime.evaluate', { expression: `document.querySelector('.memory-quiz-options button')?.click()` })
  await sleep(850)
  const advanced = await send('Runtime.evaluate', { expression: `document.querySelector('.memory-quiz-header > strong')?.innerText.startsWith('2') ?? false`, returnByValue: true })
  return { ...result.result.value, advanced: advanced.result.value, screenshotPath }
}

async function checkBlackBoxQuiz(send, size) {
  const quizSession = { ...session, blackBoxLevels: [0, 1, 2], blackBoxQuizAnswers: [] }
  await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
  await send('Runtime.evaluate', { expression: `sessionStorage.setItem('pixpy.session.v2', ${JSON.stringify(JSON.stringify(quizSession))})` })
  await send('Page.reload', { ignoreCache: true })
  await waitFor(send, 'document.readyState === "complete"')
  await send('Page.navigate', { url: `${appUrl}#/black-box` })
  await waitFor(send, 'Boolean(document.querySelector(".operation-quiz"))')
  await sleep(250)
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('.blackbox-quiz-experience');
      const rect = root.getBoundingClientRect();
      return {
        size: ${JSON.stringify(size.name)},
        hasDocumentVerticalScroll: document.documentElement.scrollHeight > innerHeight + 1 || document.body.scrollHeight > innerHeight + 1,
        rootInsideViewport: rect.top >= -1 && rect.bottom <= innerHeight + 1,
        quizVisible: ${visibleRectExpression('.operation-quiz')},
        codeVisible: ${visibleRectExpression('.memory-quiz-code')},
        optionCount: document.querySelectorAll('.memory-quiz-options button').length,
      };
    })()`,
    returnByValue: true,
  })
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const screenshotPath = path.join(outputDir, `black-box-quiz-${size.name}.png`)
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  await send('Runtime.evaluate', { expression: `document.querySelector('.memory-quiz-options button')?.click()` })
  await sleep(850)
  const advanced = await send('Runtime.evaluate', { expression: `document.querySelector('.memory-quiz-header > strong')?.innerText.startsWith('2') ?? false`, returnByValue: true })
  return { ...result.result.value, advanced: advanced.result.value, screenshotPath }
}

async function main() {
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'pixpy-viewport-'))
  const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${tempProfile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
  try {
    await waitForBrowser()
    const { send, close } = await makeClient()
    await send('Page.enable')
    await send('Runtime.enable')
    const nameChecks = []
    for (const size of targetSizes) nameChecks.push(await checkNameEntry(send, size))
    await seedSession(send)
    const metrics = []
    for (const size of targetSizes) for (const routeConfig of routes) metrics.push(await collectRouteMetrics(send, size, routeConfig))
    const quizChecks = []
    for (const size of targetSizes.filter((item) => item.name === 'ipad-portrait' || item.name === 'ipad-landscape')) quizChecks.push(await checkMemoryQuiz(send, size))
    const blackBoxQuizChecks = []
    for (const size of targetSizes.filter((item) => item.name === 'ipad-portrait' || item.name === 'ipad-landscape')) blackBoxQuizChecks.push(await checkBlackBoxQuiz(send, size))
    const printCheck = await checkPrintView(send)
    close()
    const failures = metrics.filter((item) => item.hasDocumentVerticalScroll || !item.rootInsideViewport || !item.navVisible || !item.quickListVisible || !item.experienceHeaderVisible || !item.hintVisible || !item.surfaceVisible)
    const quizFailures = quizChecks.filter((item) => item.hasDocumentVerticalScroll || !item.rootInsideViewport || !item.quizVisible || !item.codeVisible || item.optionCount !== 4 || !item.advanced)
    const blackBoxQuizFailures = blackBoxQuizChecks.filter((item) => item.hasDocumentVerticalScroll || !item.rootInsideViewport || !item.quizVisible || !item.codeVisible || item.optionCount !== 4 || !item.advanced)
    const nameFailures = nameChecks.filter((item) => item.hasDocumentVerticalScroll || !item.rootInsideViewport || !item.formVisible || !item.inputVisible || !item.placeholderCorrect)
    const printFailed = !printCheck.printVisible || !printCheck.websiteHidden || !printCheck.studentVisible || !printCheck.progressVisible || printCheck.pdfBytes < 1000
    console.log(JSON.stringify({ outputDir, checked: metrics.length + quizChecks.length + blackBoxQuizChecks.length + nameChecks.length, failures, quizFailures, blackBoxQuizFailures, nameFailures, printCheck }, null, 2))
    if (failures.length || quizFailures.length || blackBoxQuizFailures.length || nameFailures.length || printFailed) process.exitCode = 1
  } finally {
    if (!browser.killed) browser.kill()
    await Promise.race([new Promise((resolve) => browser.once('exit', resolve)), sleep(2500)])
    try { fs.rmSync(tempProfile, { recursive: true, force: true }) } catch { /* Windows may release it later. */ }
  }
}

main().catch((error) => { console.error(error); process.exit(1) })
