import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
}

const WORLD_WIDTH = 900
const WORLD_HEIGHT = 500
const GROUND_Y = 395

export function DinoGame({ config, runPulse }: DinoGameProps) {
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
  const [running, setRunning] = useState(true)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(config.lives)

  useEffect(() => {
    runningRef.current = running
  }, [running])

  const mode = useMemo(() => {
    if (config.player_size >= 80) return 'GIANT MODE'
    if (config.obstacle_count >= 10) return 'CHAOS MODE'
    if (config.gravity <= 3) return 'MOON MODE'
    if (config.player_speed >= 15) return 'SUPER SPEED'
    if (config.lives >= 20) return 'SURVIVOR MODE'
    return 'LAB RUN'
  }, [config])

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
  }, [config.lives, config.player_size, resetObstacles])

  useEffect(() => {
    resetGame()
  }, [runPulse, resetGame])

  const jump = useCallback(() => {
    const ground = GROUND_Y - config.player_size
    if (playerYRef.current >= ground - 3) {
      velocityYRef.current = -(config.jump_power * 25)
    }
  }, [config.jump_power, config.player_size])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
          const playerRight = playerLeft + config.player_size * 0.82
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
    <div className={`dino-game ${mode === 'CHAOS MODE' ? 'dino-game--chaos' : ''}`}>
      <canvas ref={canvasRef} onPointerDown={jump} aria-label="Dino Lab runner world. Tap or press space to jump." />
      <div className="dino-game__scanlines" aria-hidden="true" />
      <div className="dino-game__topbar">
        <span className="game-mode"><i />{mode}</span>
        <span>SCORE <b>{String(score).padStart(4, '0')}</b></span>
        <span>LIVES <b>{lives}</b></span>
      </div>
      <div className="dino-game__controls">
        <button onClick={() => setRunning((value) => !value)}>
          {running ? <Pause size={15} /> : <Play size={15} />}
          {running ? 'Pause' : lives === 0 ? 'Game over' : 'Resume'}
        </button>
        <button onClick={resetGame}><RotateCcw size={15} /> Restart</button>
      </div>
      <button className="jump-button" onClick={jump}>JUMP <span>SPACE</span></button>
      {!running && lives === 0 && (
        <div className="game-over">
          <small>SYSTEM REPORT</small>
          <strong>CRASHED. NICE TRY.</strong>
          <button onClick={resetGame}>Run it again</button>
        </div>
      )}
    </div>
  )
}

function drawWorld(context: CanvasRenderingContext2D, time: number, config: DinoConfig, score: number) {
  context.fillStyle = '#14182c'
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  const pulse = (Math.sin(time / 1400) + 1) / 2
  context.fillStyle = `rgba(94, 76, 190, ${0.22 + pulse * 0.08})`
  context.fillRect(0, 0, WORLD_WIDTH, 300)

  context.fillStyle = '#91f4df'
  for (let index = 0; index < 28; index += 1) {
    const x = (index * 97 + 34 - score * 0.8) % WORLD_WIDTH
    const y = 35 + ((index * 53) % 210)
    const size = index % 4 === 0 ? 4 : 2
    context.globalAlpha = 0.2 + (index % 5) * 0.12
    context.fillRect(x, y, size, size)
  }
  context.globalAlpha = 1

  context.fillStyle = '#202648'
  for (let index = 0; index < 11; index += 1) {
    const x = index * 110 - (score * 0.45) % 110
    const height = 85 + (index % 4) * 24
    context.fillRect(x, GROUND_Y - height, 82, height)
    context.fillStyle = '#3b4772'
    for (let row = 0; row < 3; row += 1) {
      context.fillRect(x + 14 + row * 22, GROUND_Y - height + 20, 8, 8)
    }
    context.fillStyle = '#202648'
  }

  context.fillStyle = '#323753'
  context.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y)
  context.fillStyle = '#5ee0bd'
  context.fillRect(0, GROUND_Y, WORLD_WIDTH, 6)
  context.fillStyle = '#262b43'
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
  const unit = size / 8
  context.save()
  context.translate(x, y)
  if (invincible && Math.floor(time / 90) % 2 === 0) context.globalAlpha = 0.28
  const legOffset = running && Math.floor(time / 110) % 2 === 0 ? unit : 0

  context.fillStyle = '#71e3bd'
  context.fillRect(unit, unit * 2, unit * 5, unit * 4)
  context.fillRect(unit * 3, 0, unit * 5, unit * 4)
  context.fillRect(0, unit * 4, unit * 2, unit)
  context.fillStyle = '#b4f8d9'
  context.fillRect(unit * 4, unit, unit * 3, unit)
  context.fillStyle = '#171a2d'
  context.fillRect(unit * 6, unit, unit, unit)
  context.fillRect(unit * 7, unit * 3, unit, unit)
  context.fillStyle = '#f7d65a'
  context.fillRect(unit * 2, unit * 4, unit * 2, unit)
  context.fillStyle = '#71e3bd'
  context.fillRect(unit * 2 - legOffset, unit * 6, unit * 2, unit * 2)
  context.fillRect(unit * 5 + legOffset, unit * 6, unit * 2, unit * 2)
  context.restore()
}

function drawObstacle(context: CanvasRenderingContext2D, obstacle: Obstacle, index: number, time: number) {
  const y = GROUND_Y - obstacle.height
  const blink = Math.floor(time / 320 + index) % 2 === 0
  context.fillStyle = obstacle.hit ? '#665870' : '#ff6c7e'
  context.fillRect(obstacle.x, y + 10, obstacle.width, obstacle.height - 10)
  context.fillRect(obstacle.x + 5, y, obstacle.width - 10, 12)
  context.fillStyle = '#272a43'
  context.fillRect(obstacle.x + 6, y + 20, 5, 5)
  context.fillRect(obstacle.x + obstacle.width - 11, y + 20, 5, 5)
  context.fillStyle = blink ? '#ffed8b' : '#dd4561'
  context.fillRect(obstacle.x + obstacle.width / 2 - 3, y + 34, 6, 6)
}
