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
  { name: 'ipad-landscape', width: 1024, height: 768 },
  { name: 'compact-browser-100-percent', width: 852, height: 575 },
  { name: 'ipad-safari-landscape', width: 1024, height: 694 },
  { name: 'modern-ipad-landscape', width: 1180, height: 820 },
  { name: 'modern-ipad-safari-landscape', width: 1180, height: 744 },
  { name: 'chromebook', width: 1366, height: 768 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'desktop', width: 1920, height: 1080 },
].filter((size) => !process.env.PIXPY_VIEWPORT || size.name === process.env.PIXPY_VIEWPORT)

const routes = [
  { name: 'home', route: 'home', selector: '.playground-home' },
  { name: 'variables', route: 'variables', selector: '.variables-home' },
  { name: 'dino', route: 'dino-variables', selector: '.dino-experience', experience: true, surface: '.dino-game canvas', panels: ['.dino-world', '.dino-control-panel'] },
  { name: 'print', route: 'print-playground', selector: '.print-experience', experience: true, surface: '.pixpy-editor', panels: ['.print-editor-stage', '.terminal-stage'] },
  { name: 'black-box', route: 'black-box', selector: '.blackbox-experience', experience: true, surface: '.real-black-box', panels: ['.blackbox-stage', '.hypothesis-panel'] },
  { name: 'input', route: 'input-machine', selector: '.input-experience', experience: true, surface: '.vending-machine', panels: ['.input-stage', '.code-workbench'] },
  { name: 'memory', route: 'memory-machine', selector: '.memory-experience', experience: true, surface: '.memory-code-lines', panels: ['.memory-code-panel', '.memory-result-panel'] },
  { name: 'build', route: 'build-black-box', selector: '.buildbox-experience', experience: true, surface: '.pixpy-editor', panels: ['.build-reference-panel', '.build-editor-panel'] },
  { name: 'bosses', route: 'final-bosses', selector: '.boss-experience', experience: true, surface: '.boss-grid', panels: ['.boss-stage', '.code-workbench'] },
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
  printPlaygroundActivity: 'morning-chat',
  printPlaygroundCode: { 'morning-chat': '#Change the message to "Bom dia, chat!"\nprint("Bom dia, chat!")' },
  printPlaygroundOutputs: { 'morning-chat': { text: 'Bom dia, chat!', kind: 'success' } },
  printPlaygroundVisited: ['morning-chat'],
  printPlaygroundCompleted: ['morning-chat'],
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
    const { resolve, reject, method } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(`${method}: ${message.error.message}`))
    else resolve(message.result)
  }
  await new Promise((resolve) => { socket.onopen = resolve })
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        id += 1
        pending.set(id, { resolve, reject, method })
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
  const state = await send('Runtime.evaluate', { expression: `JSON.stringify({ text: document.body.innerText.slice(-1800), inputs: [...document.querySelectorAll('input')].map(input => ({ id: input.id, value: input.value })) })`, returnByValue: true })
  throw new Error(`Timed out waiting for ${expression}\n${state.result.value}`)
}

function visibleRectExpression(selector) {
  return `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top >= -1 && rect.left >= -1 && rect.bottom <= innerHeight + 1 && rect.right <= innerWidth + 1;
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
  if (routeConfig.route === 'print-playground') {
    await send('Runtime.evaluate', { expression: `document.querySelector('.print-editor-controls .primary-action')?.click()` })
    await waitFor(send, `Boolean(document.querySelector('.morning-greeting-reward'))`)
  }
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
        actionsInsideViewport: [...root.querySelectorAll('.primary-action, .run-row button, .hint-button')].every((button) => {
          const box = button.getBoundingClientRect();
          return box.width > 0 && box.height >= 44 && box.top >= 0 && box.bottom <= innerHeight + 1 && box.right <= innerWidth + 1;
        }),
        hasHorizontalScroll: page.scrollWidth > innerWidth + 1,
        panelsSideBySide: (() => {
          const panels = ${JSON.stringify(routeConfig.panels ?? [])}.map(selector => document.querySelector(selector).getBoundingClientRect());
          return panels.length === 0 || (panels[0].right <= panels[1].left && Math.abs(panels[0].top - panels[1].top) < 2);
        })(),
        panelsFitWithoutScrolling: [...root.querySelectorAll('.panel-surface')].every(panel => {
          const box = panel.getBoundingClientRect();
          return box.top >= 0 && box.bottom <= innerHeight + 1 && box.right <= innerWidth + 1 && panel.scrollHeight <= panel.clientHeight + 1;
        }),
        contentFits: root.scrollHeight <= root.clientHeight + 1 && [...root.children].every(child => {
          const box = child.getBoundingClientRect();
          const rootBox = root.getBoundingClientRect();
          return box.top >= rootBox.top - 1 && box.bottom <= rootBox.bottom + 1 && box.right <= rootBox.right + 1;
        }),
        criticalContentClear: (() => {
          const orderedPairs = [
            ['.dino-control-panel > header', '.dino-sliders'],
            ['.dino-sliders', '.dino-control-panel .run-row'],
          ];
          const pairsClear = orderedPairs.every(([first, second]) => {
            const before = root.querySelector(first), after = root.querySelector(second);
            return !before || !after || before.getBoundingClientRect().bottom <= after.getBoundingClientRect().top + 1;
          });
          const machine = root.querySelector('.vending-machine'), machineHeading = root.querySelector('.machine-heading');
          const machineClear = !machine || !machineHeading || machineHeading.getBoundingClientRect().top >= machine.getBoundingClientRect().top - 1;
          const recipesClear = [...root.querySelectorAll('.code-recipes article')].every(article => {
            const articleBox = article.getBoundingClientRect();
            return [...article.children].every(child => {
              const box = child.getBoundingClientRect();
              return box.top >= articleBox.top - 1 && box.bottom <= articleBox.bottom + 1 && box.left >= articleBox.left - 1 && box.right <= articleBox.right + 1;
            });
          });
          const cardsClear = [...root.querySelectorAll('.experience-card')].every(card => {
            const cardBox = card.getBoundingClientRect();
            return [...card.children].filter(child => getComputedStyle(child).display !== 'none').every(child => {
              const box = child.getBoundingClientRect();
              return box.top >= cardBox.top - 1 && box.bottom <= cardBox.bottom + 1 && box.right <= cardBox.right + 1;
            });
          });
          return pairsClear && machineClear && recipesClear && cardsClear;
        })(),
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
  await sleep(300)
  await waitFor(send, 'Boolean(document.querySelector(".memory-quiz"))')
  await send('Runtime.evaluate', { expression: `document.querySelector('.quiz-unlock .primary-action')?.click()` })
  await waitFor(send, 'Boolean(document.querySelector(".memory-quiz-options button"))')
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
        contentFits: document.querySelector('.memory-quiz').scrollHeight <= document.querySelector('.memory-quiz').clientHeight + 1,
        optionsClearFeedback: document.querySelector('.memory-quiz-options').getBoundingClientRect().bottom <= document.querySelector('.quiz-response').getBoundingClientRect().top + 1,
      };
    })()`,
    returnByValue: true,
  })
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const screenshotPath = path.join(outputDir, `memory-quiz-${size.name}.png`)
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  await send('Runtime.evaluate', { expression: `document.querySelector('.memory-quiz-options button')?.click()` })
  await sleep(850)
  await send('Runtime.evaluate', { expression: `document.querySelector('.quiz-next')?.click()` })
  await sleep(150)
  const advanced = await send('Runtime.evaluate', { expression: `document.querySelector('.memory-quiz-header > strong')?.innerText.startsWith('2') ?? false`, returnByValue: true })
  return { ...result.result.value, advanced: advanced.result.value, screenshotPath }
}

async function checkBlackBoxQuiz(send, size) {
  const quizSession = { ...session, blackBoxLevels: [0, 1, 2], blackBoxQuizAnswers: [] }
  await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
  await send('Runtime.evaluate', { expression: `sessionStorage.setItem('pixpy.session.v2', ${JSON.stringify(JSON.stringify(quizSession))})` })
  await send('Page.reload', { ignoreCache: true })
  await sleep(300)
  await waitFor(send, 'document.readyState === "complete"')
  await send('Page.navigate', { url: `${appUrl}#/black-box` })
  await waitFor(send, 'Boolean(document.querySelector(".operation-quiz"))')
  await send('Runtime.evaluate', { expression: `document.querySelector('.blackbox-quiz-start .primary-action')?.click()` })
  await waitFor(send, 'Boolean(document.querySelector(".memory-quiz-options button"))')
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
        contentFits: document.querySelector('.operation-quiz').scrollHeight <= document.querySelector('.operation-quiz').clientHeight + 1,
        optionsClearFeedback: document.querySelector('.memory-quiz-options').getBoundingClientRect().bottom <= document.querySelector('.quiz-response').getBoundingClientRect().top + 1,
      };
    })()`,
    returnByValue: true,
  })
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const screenshotPath = path.join(outputDir, `black-box-quiz-${size.name}.png`)
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  await send('Runtime.evaluate', { expression: `document.querySelector('.memory-quiz-options button')?.click()` })
  await sleep(850)
  await send('Runtime.evaluate', { expression: `document.querySelector('.quiz-next')?.click()` })
  await sleep(150)
  const advanced = await send('Runtime.evaluate', { expression: `document.querySelector('.memory-quiz-header > strong')?.innerText.startsWith('2') ?? false`, returnByValue: true })
  return { ...result.result.value, advanced: advanced.result.value, screenshotPath }
}

async function checkClassroomInteractions(send, size) {
  const checks = []
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value
  const click = async (selector) => {
    const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2; return { x, y, inside: x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight, route: location.hash }; })()`)
    if (!point.inside) {
      checks.push({ size: size.name, name: `Touch target ${selector} is visible on ${point.route}`, passed: false })
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
      await sleep(80)
      return
    }
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, radiusX: 2, radiusY: 2, force: 1 }] })
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await sleep(80)
  }
  const press = async (key, code, windowsVirtualKeyCode, modifiers = 0) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, modifiers, ...(key === 'Enter' ? { text: '\r' } : {}) })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, modifiers })
  }
  const type = async (selector, value) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
    await press('a', 'KeyA', 65, 2)
    await send('Input.insertText', { text: value })
  }
  const go = async (route, selector) => {
    await send('Page.navigate', { url: `${appUrl}#/${route}` })
    await waitFor(send, `Boolean(document.querySelector(${JSON.stringify(selector)}))`)
    await sleep(150)
  }
  const check = async (name, expression) => checks.push({ size: size.name, name, passed: Boolean(await evaluate(expression)) })
  const capture = async (name) => {
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(path.join(outputDir, `${name}-${size.name}.png`), Buffer.from(screenshot.data, 'base64'))
  }
  const visible = (selector) => `(() => {
    const elements = [...document.querySelectorAll(${JSON.stringify(selector)})];
    return elements.length > 0 && elements.every((el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < 0 || r.left < 0) return false;
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), p = parent.getBoundingClientRect();
        if (/(auto|hidden|scroll)/.test(style.overflowY) && (r.top < p.top - 1 || r.bottom > p.bottom + 1)) return false;
      }
      return true;
    });
  })()`

  await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
  await seedSession(send)
  await go('input-machine', '.input-experience')
  await click('.mode-tabs button:nth-child(2)')
  await type('#machine-input', '9')
  await press('Enter', 'Enter', 13)
  await waitFor(send, `document.querySelector('.machine-output strong')?.innerText === '18'`, 15000)
  await check('Touch mode selection and Enter sends real input', `document.querySelector('.machine-output strong').innerText === '18'`)
  await type('#machine-input', 'hello')
  await click('.vending-machine button')
  await waitFor(send, `Boolean(document.querySelector('.vending-machine.has-error'))`, 15000)
  await check('Invalid input produces readable error', visible('.machine-output'))
  await click('.code-workbench .secondary-action')
  await check('Reset restores the selected machine', `document.querySelector('#machine-input').value === '8' && !document.querySelector('.vending-machine.has-error')`)
  await click('.vending-machine button')
  await waitFor(send, `document.querySelector('.machine-output strong')?.innerText === '16'`, 15000)
  await capture('input-success')
  await click('.hint-button')
  await press('Escape', 'Escape', 27)
  await check('Escape closes hint and restores keyboard focus', `!document.querySelector('.hint-drawer') && document.activeElement.matches('.hint-button')`)
  await click('.quick-list-button')
  await press('Escape', 'Escape', 27)
  await check('Escape closes activity list', `!document.querySelector('.quick-list')`)

  await go('memory-machine', '.memory-code-lines')
  await click('.memory-tabs button:nth-child(3)')
  for (let i = 0; i < 4; i += 1) {
    await click('.execute-line-button')
    await waitFor(send, `!document.querySelector('.execute-line-button').disabled`)
  }
  await check('Both stored values remain visible', visible('.memory-result-row article'))
  await check('Memory execution prints both values', `document.querySelector('.memory-result-row--output pre').textContent.replace(/\\r/g, '') === '5\\n8'`)
  await capture('memory-two-values')

  await go('build-black-box', '.build-editor-panel')
  await type('.cm-content', 'number = int(input())\nresult = number * 2\nprint(result)')
  await click('.machine-run')
  await waitFor(send, `document.querySelector('.custom-machine > span:last-child strong').innerText === '20'`, 15000)
  await type('.custom-machine input', '7')
  await click('.machine-run')
  await waitFor(send, `document.querySelector('.custom-machine > span:last-child strong').innerText === '14'`, 15000)
  await check('Two real Python runs produce matching clues', `document.querySelectorAll('.test-history > span').length === 2`)
  await click('.hide-code-bar button')
  await check('Classmate mode hides code and keeps testing available', `Boolean(document.querySelector('.secret-code')) && !document.querySelector('.cm-content') && !document.querySelector('.machine-run').disabled`)
  await capture('build-secret')
  await click('.hide-code-bar button')
  await type('.cm-content', 'number = int(input())\nresult = number + 3\nprint(result)')
  await check('A new rule clears old clues', `document.querySelectorAll('.test-history > span').length === 0`)

  await go('black-box', '.real-black-box')
  for (let level = 0; level < 3; level += 1) {
    if (level) await click(`.level-tabs button:nth-child(${level + 1})`)
    await click('.real-black-box')
    await click('.real-black-box')
    await click('.hypothesis-panel .primary-action')
    await click(`.rule-options button:nth-child(${level === 1 ? 1 : 2})`)
    await click('.hypothesis-panel .primary-action')
    if (level < 2) await check(`Box ${level + 1} reveals Python without clipping`, visible('.python-reveal .pixpy-editor'))
    else await check('Final box reveals the surprise quiz', visible('.quiz-unlock'))
    await capture(`black-box-${level + 1}-result`)
  }
  await capture('black-box-revealed')
  if (!await evaluate(`Boolean(document.querySelector('.blackbox-quiz-start'))`)) await click('.level-tabs button:last-child')
  await click('.blackbox-quiz-start .primary-action')
  await check('All quiz answers and Next are visible', visible('.memory-quiz-options button, .quiz-next'))
  await click('.memory-quiz-options button')
  await sleep(900)
  await check('Quiz waits for the student', `document.querySelector('.memory-quiz-header > strong').innerText.startsWith('1') && !document.querySelector('.quiz-next').disabled`)
  await capture('quiz-feedback')
  await click('.quiz-next')
  await check('Quiz advances only with Next', `document.querySelector('.memory-quiz-header > strong').innerText.startsWith('2')`)

  await go('final-bosses', '.boss-grid')
  await type('.cm-content', 'a = int(input())\nb = int(input())\nresult = a + b\nprint(result)')
  await click('.code-workbench .primary-action')
  await waitFor(send, `Boolean(document.querySelector('.boss-result.is-victory'))`, 15000)
  await check('Boss evaluates a real Python solution', `document.querySelector('.boss-result').innerText.includes('12')`)
  await capture('boss-victory')
  await click('.boss-grid button:nth-child(2)')
  await click('.boss-grid button:nth-child(1)')
  await check('Boss solution survives switching', `document.querySelector('.cm-content').innerText.includes('result = a + b')`)
  await send('Page.reload')
  await sleep(750)
  await waitFor(send, `Boolean(document.querySelector('.boss-grid .is-done'))`)
  await check('Refresh keeps session completion', `Boolean(document.querySelector('.boss-grid .is-done'))`)
  await send('Emulation.setDeviceMetricsOverride', { width: size.height, height: size.width, deviceScaleFactor: 1, mobile: false })
  await check('Portrait asks for rotation and hides the activity', `getComputedStyle(document.querySelector('.landscape-notice')).display === 'flex' && getComputedStyle(document.querySelector('.landscape-app')).visibility === 'hidden' && document.documentElement.scrollHeight <= innerHeight`)
  await capture('rotate-to-landscape')
  await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false })
  await check('Rotating back restores the same activity', `getComputedStyle(document.querySelector('.landscape-notice')).display === 'none' && Boolean(document.querySelector('.boss-grid .is-done'))`)
  return checks
}

async function main() {
  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'pixpy-viewport-'))
  const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${tempProfile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true })
  try {
    await waitForBrowser()
    const { send, close } = await makeClient()
    await send('Page.enable')
    await send('Runtime.enable')
    if (process.env.PIXPY_INTERACTIONS_ONLY === '1') {
      const interactionChecks = []
      for (const size of targetSizes.slice(0, 2)) interactionChecks.push(...await checkClassroomInteractions(send, size))
      close()
      console.log(JSON.stringify({ interactionChecks: interactionChecks.length, failures: interactionChecks.filter((item) => !item.passed) }, null, 2))
      if (interactionChecks.some((item) => !item.passed)) process.exitCode = 1
      return
    }
    const nameChecks = []
    for (const size of targetSizes) nameChecks.push(await checkNameEntry(send, size))
    await seedSession(send)
    const metrics = []
    for (const size of targetSizes) for (const routeConfig of routes) metrics.push(await collectRouteMetrics(send, size, routeConfig))
    const quizChecks = []
    for (const size of targetSizes.slice(0, 2)) quizChecks.push(await checkMemoryQuiz(send, size))
    const blackBoxQuizChecks = []
    for (const size of targetSizes.slice(0, 2)) blackBoxQuizChecks.push(await checkBlackBoxQuiz(send, size))
    const printCheck = await checkPrintView(send)
    const interactionChecks = []
    for (const size of targetSizes.slice(0, 2)) interactionChecks.push(...await checkClassroomInteractions(send, size))
    close()
    const failures = metrics.filter((item) => item.hasDocumentVerticalScroll || item.hasHorizontalScroll || !item.panelsSideBySide || !item.panelsFitWithoutScrolling || !item.contentFits || !item.criticalContentClear || !item.actionsInsideViewport || !item.rootInsideViewport || !item.navVisible || !item.quickListVisible || !item.experienceHeaderVisible || !item.hintVisible || !item.surfaceVisible)
    const quizFailures = quizChecks.filter((item) => item.hasDocumentVerticalScroll || !item.rootInsideViewport || !item.quizVisible || !item.codeVisible || !item.contentFits || !item.optionsClearFeedback || item.optionCount !== 4 || !item.advanced)
    const blackBoxQuizFailures = blackBoxQuizChecks.filter((item) => item.hasDocumentVerticalScroll || !item.rootInsideViewport || !item.quizVisible || !item.codeVisible || !item.contentFits || !item.optionsClearFeedback || item.optionCount !== 4 || !item.advanced)
    const nameFailures = nameChecks.filter((item) => item.hasDocumentVerticalScroll || !item.rootInsideViewport || !item.formVisible || !item.inputVisible || !item.placeholderCorrect)
    const printFailed = !printCheck.printVisible || !printCheck.websiteHidden || !printCheck.studentVisible || !printCheck.progressVisible || printCheck.pdfBytes < 1000
    const interactionFailures = interactionChecks.filter((item) => !item.passed)
    console.log(JSON.stringify({ outputDir, checked: metrics.length + quizChecks.length + blackBoxQuizChecks.length + nameChecks.length, interactionChecks: interactionChecks.length, failures, quizFailures, blackBoxQuizFailures, nameFailures, interactionFailures, printCheck }, null, 2))
    if (failures.length || quizFailures.length || blackBoxQuizFailures.length || nameFailures.length || interactionFailures.length || printFailed) process.exitCode = 1
  } finally {
    if (!browser.killed) browser.kill()
    await Promise.race([new Promise((resolve) => browser.once('exit', resolve)), sleep(2500)])
    try { fs.rmSync(tempProfile, { recursive: true, force: true }) } catch { /* Windows may release it later. */ }
  }
}

main().catch((error) => { console.error(error); process.exit(1) })
