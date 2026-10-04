import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { CAUSES, CONFIG, abandon, advance, createRun, prepCount, report, tap, type Run } from './game'
import { audio } from './audio'
import { dangerLevel, hitButton, render } from './render'
import './styles.css'

const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'KeyE', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyM', 'KeyR', 'Enter', 'Space'])

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const runRef = useRef<Run>(createRun('title'))

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = CONFIG.width * scale
    canvas.height = CONFIG.height * scale
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const held = new Set<string>()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let paused = document.hidden
    let previous = performance.now()
    let visualTime = 0
    let endElapsed = 0
    let frame = 0
    let lastAnnouncement = ''

    const start = () => {
      held.clear()
      audio.unlock()
      audio.reset()
      audio.play('blip')
      runRef.current = createRun()
      endElapsed = 0
      previous = performance.now()
      canvas.focus({ preventScroll: true })
    }
    const toggleMute = () => {
      audio.unlock()
      audio.muted = !audio.muted
    }
    const keydown = (event: KeyboardEvent) => {
      if (!controls.has(event.code) || event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      audio.unlock()
      const first = !held.has(event.code) && !event.repeat
      held.add(event.code)
      if (!first) return
      if (event.code === 'KeyM') { toggleMute(); return }
      if (paused) return
      const run = runRef.current
      if (event.code === 'KeyR' || (run.phase !== 'playing' && (event.code === 'Enter' || event.code === 'Space'))) { start(); return }
      if (run.phase === 'playing' && /^Digit[1-4]$/.test(event.code)) abandon(run, Number(event.code.slice(-1)) - 1)
      if (run.phase === 'playing' && event.code === 'KeyE') tap(run)
    }
    const keyup = (event: KeyboardEvent) => {
      if (controls.has(event.code)) { event.preventDefault(); held.delete(event.code) }
    }
    const setPaused = (value: boolean) => {
      paused = value
      held.clear()
      runRef.current.player.moving = false
      previous = performance.now()
      audio.setPaused(value)
    }
    const visibility = () => setPaused(document.hidden || !document.hasFocus())
    const blur = () => setPaused(true)
    const focus = () => setPaused(document.hidden)
    const pointer = (event: PointerEvent) => {
      canvas.focus({ preventScroll: true })
      audio.unlock()
      const rect = canvas.getBoundingClientRect()
      const point = { x: (event.clientX - rect.left) / rect.width * CONFIG.width, y: (event.clientY - rect.top) / rect.height * CONFIG.height }
      if (hitButton(point, 'mute')) toggleMute()
      else if (runRef.current.phase === 'title' && hitButton(point, 'start')) start()
      else if (['won', 'lost'].includes(runRef.current.phase) && hitButton(point, 'again')) start()
    }
    const tick = (now: number) => {
      const dt = Math.min(CONFIG.maxFrameDelta, Math.max(0, (now - previous) / 1000))
      previous = now
      const run = runRef.current
      if (!paused) {
        visualTime += dt
        if (run.phase === 'playing') {
          advance(run, dt, {
            x: Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft')),
            y: Number(held.has('KeyS') || held.has('ArrowDown')) - Number(held.has('KeyW') || held.has('ArrowUp')),
            interact: held.has('KeyE'),
          })
        } else if (run.phase !== 'title') endElapsed += dt
      }
      const fired = run.sounds.splice(0)
      for (const sound of fired) audio.play(sound)
      audio.engine(run.time / CONFIG.duration, dangerLevel(run), run.phase === 'playing' && !paused)
      if (run.phase === 'playing') { audio.setMusic('game'); audio.setIntensity(run.time / CONFIG.duration) }
      else audio.setMusic(run.phase === 'title' || endElapsed > 3 ? 'title' : 'none')
      render(ctx, run, audio.muted, paused, visualTime, endElapsed, reducedMotion.matches, fired)
      canvas.dataset.phase = run.phase
      canvas.dataset.x = run.player.x.toFixed(2)
      canvas.dataset.y = run.player.y.toFixed(2)
      canvas.dataset.time = run.time.toFixed(2)
      const result = report(run)
      const announcement = run.phase === 'title' ? 'THE LAST POD. Press Enter or Space to start.'
        : run.phase === 'won' ? `POD AWAY. ${result.saved} of 3 innocents saved. Rank ${result.rank}. Press Enter or Space to play again.`
        : run.phase === 'lost' ? `${CAUSES[run.cause ?? 'wave']}. ${result.impostor} was the impostor. Press Enter or Space to play again.`
        : paused ? 'Paused. Return to the game to resume.'
        : `Rescue in progress. Pod prep ${prepCount(run)} of ${CONFIG.prep.required}. ${run.crew.map(crew => `${crew.id + 1}: ${crew.name}, ${crew.status.toLowerCase()}`).join('. ')}. ${run.popup}`
      if (announcement !== lastAnnouncement) {
        statusRef.current!.textContent = announcement
        canvas.setAttribute('aria-label', announcement)
        lastAnnouncement = announcement
      }
      frame = requestAnimationFrame(tick)
    }
    window.addEventListener('keydown', keydown, { capture: true })
    window.addEventListener('keyup', keyup, { capture: true })
    window.addEventListener('blur', blur)
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visibility)
    canvas.addEventListener('pointerdown', pointer)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', keydown, { capture: true })
      window.removeEventListener('keyup', keyup, { capture: true })
      window.removeEventListener('blur', blur)
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('pointerdown', pointer)
      audio.reset()
    }
  }, [])

  return <main className="stage">
    <div className="screen">
      <canvas ref={canvasRef} width={CONFIG.width} height={CONFIG.height} tabIndex={0} role="application" aria-label="THE LAST POD" aria-describedby="controls">
        THE LAST POD requires a browser with HTML canvas support.
      </canvas>
    </div>
    <p id="controls" className="sr-only">WASD or arrows to move. Touch crew to rescue them. Prep 2 of 3 pod tasks: tap E at the Cafeteria wires, carry Storage fuel to the pod, or stand still holding E on the Med Bay bioscan, which also reports whether the impostor is in your line. Hold E to unlock doors, reset breakers during lights out, or launch the pod. Keys 1 through 4 abandon followers. Watch for the impostor’s glitching nameplate. M mutes, R restarts, Enter or Space starts or plays again. The game pauses when it loses focus.</p>
    <p ref={statusRef} className="sr-only" role="status" aria-live="polite" />
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
