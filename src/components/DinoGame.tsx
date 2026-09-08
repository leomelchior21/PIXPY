import { Keyboard, Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DinoConfig } from '../types'

interface Obstacle {
  x: number
  width: number
  height: number
  hit: boolean
}

interface DinoGameProps {
  config: DinoConfig
  runPulse: number
  challengeActive?: boolean
  onChallengeComplete?: () => void
}

const WORLD_WIDTH = 1000
const WORLD_HEIGHT = 556
const GROUND_Y = 445

export function DinoGame({ config, runPulse, challengeActive = false, onChallengeComplete }: DinoGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const previousTimeRef = useRef(0)
  const playerYRef = useRef(GROUND_Y - config.player_size)
  const velocityYRef = useRef(0)
  const obstaclesRef = useRef<Obstacle[]>([])
  const scoreRef = useRef(0)
  const displayScoreRef = useRef(0)
  const livesRef = useRef(config.lives)
  const runningRef = useRef(true)
  const invincibleUntilRef = useRef(0)
  const challengeReportedRef = useRef(false)
  const [running, setRunning] = useState(true)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(config.lives)

  useEffect(() => {
    runningRef.current = running
  }, [running])

  const resetObstacles = useCallback(() => {
    obstaclesRef.current = Array.from({ length: config.obstacle_count }, (_, index) => ({
      x: WORLD_WIDTH + 160 + index * Math.max(86, 760 / Math.max(1, config.obstacle_count)),
      width: 26 + (index % 3) * 8,
      height: 42 + (index % 2) * 28,
      hit: false,
    }))
  }, [config.obstacle_count])

  const resetGame = useCallback(() => {
    scoreRef.current = 0
    displayScoreRef.current = 0
    livesRef.current = config.lives
    playerYRef.current = GROUND_Y - config.player_size
    velocityYRef.current = 0
    setScore(0)
    setLives(config.lives)
    resetObstacles()
    setRunning(true)
    runningRef.current = true
    challengeReportedRef.current = false
  }, [config.lives, config.player_size, resetObstacles])

  useEffect(() => {
    resetGame()
  }, [runPulse, resetGame])

  useEffect(() => {
    if (!challengeActive || score < 100 || challengeReportedRef.current) return
    challengeReportedRef.current = true
    onChallengeComplete?.()
  }, [challengeActive, onChallengeComplete, score])

  const jump = useCallback(() => {
    const ground = GROUND_Y - config.player_size
    if (playerYRef.current >= ground - 3) {
      velocityYRef.current = -(config.jump_power * 25)
    }
  }, [config.jump_power, config.player_size])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('button, input, textarea, [contenteditable="true"], [role="dialog"]')) return
      if (event.code === 'Space') {
        event.preventDefault()
        jump()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [jump])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.floor(rect.width * ratio))
      canvas.height = Math.max(1, Math.floor(rect.height * ratio))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const draw = (time: number) => {
      const delta = Math.min(0.034, (time - previousTimeRef.current) / 1000 || 0)
      previousTimeRef.current = time
      const scaleX = canvas.width / WORLD_WIDTH
      const scaleY = canvas.height / WORLD_HEIGHT

      context.save()
      context.scale(scaleX, scaleY)
      drawWorld(context, time, config, scoreRef.current)

      if (runningRef.current) {
        const gravityForce = config.gravity * 72
        velocityYRef.current += gravityForce * delta
        playerYRef.current += velocityYRef.current * delta
        const ground = GROUND_Y - config.player_size
        if (playerYRef.current > ground) {
          playerYRef.current = ground
          velocityYRef.current = 0
        }

        const movement = (config.obstacle_speed * 24 + config.player_speed * 8) * delta
        obstaclesRef.current.forEach((obstacle) => {
          obstacle.x -= movement
          if (obstacle.x + obstacle.width < 0) {
            const furthest = Math.max(WORLD_WIDTH, ...obstaclesRef.current.map((item) => item.x))
            obstacle.x = furthest + 150 + Math.random() * 220
            obstacle.hit = false
          }

          const playerLeft = 125
          const playerRight = playerLeft + config.player_size * 1.2
          const playerBottom = playerYRef.current + config.player_size
          const obstacleTop = GROUND_Y - obstacle.height
          const collided = playerRight > obstacle.x && playerLeft < obstacle.x + obstacle.width && playerBottom > obstacleTop + 6
          if (collided && !obstacle.hit && time > invincibleUntilRef.current) {
            obstacle.hit = true
            invincibleUntilRef.current = time + 900
            livesRef.current = Math.max(0, livesRef.current - 1)
            setLives(livesRef.current)
            if (livesRef.current === 0) {
              runningRef.current = false
              setRunning(false)
            }
          }
        })

        scoreRef.current += delta * config.player_speed * 2.4
        if (Math.floor(scoreRef.current) !== displayScoreRef.current) {
          displayScoreRef.current = Math.floor(scoreRef.current)
          setScore(displayScoreRef.current)
        }
      }

      obstaclesRef.current.forEach((obstacle, index) => drawObstacle(context, obstacle, index, time))
      drawRunner(context, 125, playerYRef.current, config.player_size, time, runningRef.current, time < invincibleUntilRef.current)
      context.restore()
      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frameRef.current)
      observer.disconnect()
    }
  }, [config])

  return (
    <div className={`dino-game ${config.obstacle_count >= 10 ? 'dino-game--chaos' : ''}`}>
      <canvas ref={canvasRef} onPointerDown={jump} aria-label="Runner Lab world. Tap or press space to jump." />
      <div className="dino-game__scanlines" aria-hidden="true" />
      <div className="dino-game__topbar">
        <span className="game-mode"><i />{running ? 'RUNNING' : lives === 0 ? 'GAME OVER' : 'PAUSED'}</span>
        {challengeActive && <span className="game-challenge">CHALLENGE <b>{Math.min(score, 100)}/100</b></span>}
        <span>SCORE <b>{String(score).padStart(4, '0')}</b></span>
        <span>LIVES <b>{lives}</b></span>
      </div>
      <div className="dino-game__controls">
        <button onClick={() => setRunning((value) => !value)} disabled={lives === 0}>
          {running ? <Pause size={15} /> : <Play size={15} />}
          {running ? 'PAUSE' : lives === 0 ? 'GAME OVER' : 'PLAY'}
        </button>
        <button onClick={resetGame}><RotateCcw size={15} /> RESTART</button>
      </div>
      <button className="jump-button" onClick={jump}>JUMP <span>SPACE</span></button>
      <div className="dino-game__help"><Keyboard size={18} /> Tap the world or press SPACE to jump.</div>
      {!running && lives === 0 && (
        <div className="game-over">
          <small>GAME OVER</small>
          <strong>PLAYER DOWN. TRY AGAIN!</strong>
          <span className="game-over__skull" aria-hidden="true" />
          <button onClick={resetGame}>RETRY</button>
        </div>
      )}
    </div>
  )
}

function drawWorld(context: CanvasRenderingContext2D, time: number, config: DinoConfig, score: number) {
  const sky = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT)
  sky.addColorStop(0, '#061525')
  sky.addColorStop(0.58, '#072944')
  sky.addColorStop(1, '#041523')
  context.fillStyle = sky
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  const pulse = (Math.sin(time / 1400) + 1) / 2
  context.fillStyle = `rgba(0, 191, 242, ${0.07 + pulse * 0.04})`
  context.fillRect(0, 0, WORLD_WIDTH, 282)

  context.fillStyle = '#a9efff'
  for (let index = 0; index < 34; index += 1) {
    const x = (index * 97 + 34 - score * 0.8) % WORLD_WIDTH
    const y = 35 + ((index * 53) % 210)
    const size = index % 5 === 0 ? 5 : 2
    context.globalAlpha = 0.2 + (index % 5) * 0.12
    context.fillRect(x, y, size, size)
  }
  context.globalAlpha = 1

  context.fillStyle = '#031f33'
  for (let index = 0; index < 11; index += 1) {
    const x = index * 110 - (score * 0.45) % 110
    const height = 85 + (index % 4) * 24
    context.fillRect(x, GROUND_Y - height, 82, height)
    context.fillStyle = '#0b5d8a'
    for (let row = 0; row < 3; row += 1) {
      context.fillRect(x + 14 + row * 22, GROUND_Y - height + 20, 8, 8)
      context.fillRect(x + 14 + row * 22, GROUND_Y - height + 46, 8, 8)
    }
    context.fillStyle = '#031f33'
  }

  context.fillStyle = '#05283d'
  context.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y)
  context.fillStyle = '#20cbff'
  context.fillRect(0, GROUND_Y - 2, WORLD_WIDTH, 8)
  context.fillStyle = '#0b5f88'
  for (let x = -((score * 1.3) % 38); x < WORLD_WIDTH; x += 38) {
    context.fillRect(x, GROUND_Y, 32, 16)
    context.fillStyle = '#06233a'
    context.fillRect(x + 4, GROUND_Y + 15, 4, 13)
    context.fillRect(x + 26, GROUND_Y + 15, 4, 13)
    context.fillStyle = '#0b5f88'
  }
  context.fillStyle = '#123a50'
  for (let x = -((score * config.player_speed) % 56); x < WORLD_WIDTH; x += 56) {
    context.fillRect(x, GROUND_Y + 28, 31, 5)
    context.fillRect(x + 34, GROUND_Y + 58, 14, 5)
  }
}

function drawRunner(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  time: number,
  running: boolean,
  invincible: boolean,
) {
  const unit = size / 12
  context.save()
  context.translate(x, y)
  if (invincible && Math.floor(time / 90) % 2 === 0) context.globalAlpha = 0.28
  const runningFrame = running && Math.floor(time / 105) % 2 === 0

  // Pixel T-Rex: long tail, heavy feet, short arms, jaw, teeth, and a bright eye.
  const outline = '#07151a'
  const skin = '#79dc58'
  const highlight = '#b8f34a'
  context.fillStyle = outline
  context.beginPath()
  context.moveTo(0, unit * 7)
  context.lineTo(unit * 5, unit * 4)
  context.lineTo(unit * 7, unit * 9)
  context.closePath()
  context.fill()
  context.fillRect(unit * 4, unit * 3, unit * 8, unit * 7)
  context.fillRect(unit * 9, 0, unit * 8, unit * 6)
  context.fillRect(unit * 12, unit * 5, unit * 4, unit * 2)

  context.fillStyle = skin
  context.beginPath()
  context.moveTo(unit, unit * 7)
  context.lineTo(unit * 5, unit * 5)
  context.lineTo(unit * 6, unit * 8)
  context.closePath()
  context.fill()
  context.fillRect(unit * 5, unit * 4, unit * 6, unit * 5)
  context.fillRect(unit * 10, unit, unit * 6, unit * 4)
  context.fillStyle = highlight
  context.fillRect(unit * 6, unit * 5, unit * 3, unit * 3)

  context.fillStyle = '#f7fbff'
  context.fillRect(unit * 13, unit, unit, unit)
  context.fillStyle = outline
  context.fillRect(unit * 13.35, unit * 1.15, unit * .55, unit * .55)
  context.fillRect(unit * 13, unit * 4, unit * 4, unit)
  context.fillStyle = '#fff7d8'
  context.fillRect(unit * 14, unit * 4, unit * .7, unit * .75)
  context.fillRect(unit * 16, unit * 4, unit * .7, unit * .75)

  context.fillStyle = outline
  context.fillRect(unit * 9, unit * 7, unit * 4, unit)
  context.fillRect(unit * 12, unit * 7, unit, unit * 2)
  if (runningFrame) {
    context.fillRect(unit * 5, unit * 9, unit * 2, unit * 3)
    context.fillRect(unit * 5, unit * 11, unit * 4, unit)
    context.fillRect(unit * 9, unit * 8, unit * 2, unit * 3)
    context.fillRect(unit * 9, unit * 10, unit * 4, unit)
  } else {
    context.fillRect(unit * 5, unit * 8, unit * 2, unit * 3)
    context.fillRect(unit * 4, unit * 10, unit * 4, unit)
    context.fillRect(unit * 9, unit * 9, unit * 2, unit * 3)
    context.fillRect(unit * 9, unit * 11, unit * 4, unit)
  }
  context.restore()
}

function drawObstacle(context: CanvasRenderingContext2D, obstacle: Obstacle, index: number, time: number) {
  const y = GROUND_Y - obstacle.height
  const spikeCount = Math.max(1, Math.ceil(obstacle.width / 18))
  const spikeWidth = obstacle.width / spikeCount
  context.fillStyle = '#00141f'
  context.fillRect(obstacle.x - 4, GROUND_Y - 6, obstacle.width + 8, 10)
  for (let spike = 0; spike < spikeCount; spike += 1) {
    const left = obstacle.x + spike * spikeWidth
    context.beginPath()
    context.moveTo(left - 2, GROUND_Y - 4)
    context.lineTo(left + spikeWidth / 2, y)
    context.lineTo(left + spikeWidth + 2, GROUND_Y - 4)
    context.closePath()
    context.fillStyle = '#00141f'
    context.fill()

    context.beginPath()
    context.moveTo(left + 2, GROUND_Y - 7)
    context.lineTo(left + spikeWidth / 2, y + 9)
    context.lineTo(left + spikeWidth - 2, GROUND_Y - 7)
    context.closePath()
    context.fillStyle = obstacle.hit ? '#477082' : '#dff9ff'
    context.fill()
  }
  if (Math.floor(time / 260 + index) % 2 === 0) {
    context.fillStyle = '#20cbff'
    context.fillRect(obstacle.x + obstacle.width / 2 - 3, GROUND_Y - obstacle.height + 18, 6, 6)
  }
}
