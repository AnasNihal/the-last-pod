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
  const joystickRef = useRef<HTMLDivElement>(null)
  const joystickKnobRef = useRef<HTMLSpanElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const tapRef = useRef<HTMLButtonElement>(null)
  const muteRef = useRef<HTMLButtonElement>(null)
  const restartRef = useRef<HTMLButtonElement>(null)
  const runRef = useRef<Run>(createRun('title'))

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const scale = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = CONFIG.width * scale
    canvas.height = CONFIG.height * scale
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const held = new Set<string>()
    const touchVector = { x: 0, y: 0 }
    let touchInteract = false
    let joystickPointer: number | null = null
    let actionPointer: number | null = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let paused = document.hidden
    let previous = performance.now()
    let visualTime = 0
    let endElapsed = 0
    let frame = 0
    let lastAnnouncement = ''

    const joystick = joystickRef.current!
    const joystickKnob = joystickKnobRef.current!
    const action = actionRef.current!
    const tapButton = tapRef.current!
    const muteButton = muteRef.current!
    const restartButton = restartRef.current!
    const resetJoystick = () => {
      joystickPointer = null
      touchVector.x = 0
      touchVector.y = 0
      joystickKnob.style.transform = 'translate(-50%, -50%)'
    }
    const updateJoystick = (event: PointerEvent) => {
      const rect = joystick.getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      const radius = rect.width * .34
      const length = Math.hypot(dx, dy)
      const amount = length ? Math.min(1, length / radius) : 0
      const nx = length ? dx / length : 0
      const ny = length ? dy / length : 0
      touchVector.x = nx * amount
      touchVector.y = ny * amount
      const knobX = nx * radius * amount
      const knobY = ny * radius * amount
      joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`
    }
    const joystickDown = (event: PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      joystickPointer = event.pointerId
      joystick.setPointerCapture(event.pointerId)
      updateJoystick(event)
    }
    const joystickMove = (event: PointerEvent) => {
      if (event.pointerId === joystickPointer) { event.preventDefault(); updateJoystick(event) }
    }
    const joystickUp = (event: PointerEvent) => {
      if (event.pointerId === joystickPointer) { event.preventDefault(); resetJoystick() }
    }
    const actionDown = (event: PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      actionPointer = event.pointerId
      touchInteract = true
      action.setPointerCapture(event.pointerId)
      audio.unlock()
    }
    const actionUp = (event: PointerEvent) => {
      if (event.pointerId === actionPointer) { event.preventDefault(); actionPointer = null; touchInteract = false }
    }
    const tapWire = (event: PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      audio.unlock()
      if (runRef.current.phase === 'playing') tap(runRef.current)
    }
    const mobileMute = () => toggleMute()
    const mobileRestart = () => start()
    const abandonTouch = (event: PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const id = Number((event.currentTarget as HTMLButtonElement).dataset.crew)
      if (runRef.current.phase === 'playing') abandon(runRef.current, id)
    }

    const start = () => {
      held.clear()
      touchInteract = false
      resetJoystick()
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
      touchInteract = false
      resetJoystick()
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
            x: Math.max(-1, Math.min(1, touchVector.x + Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft')))),
            y: Math.max(-1, Math.min(1, touchVector.y + Number(held.has('KeyS') || held.has('ArrowDown')) - Number(held.has('KeyW') || held.has('ArrowUp')))),
            interact: touchInteract || held.has('KeyE'),
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
    joystick.addEventListener('pointerdown', joystickDown)
    joystick.addEventListener('pointermove', joystickMove)
    joystick.addEventListener('pointerup', joystickUp)
    joystick.addEventListener('pointercancel', joystickUp)
    joystick.addEventListener('lostpointercapture', resetJoystick)
    action.addEventListener('pointerdown', actionDown)
    action.addEventListener('pointerup', actionUp)
    action.addEventListener('pointercancel', actionUp)
    action.addEventListener('lostpointercapture', () => { actionPointer = null; touchInteract = false })
    tapButton.addEventListener('pointerdown', tapWire)
    muteButton.addEventListener('click', mobileMute)
    restartButton.addEventListener('click', mobileRestart)
    const abandonButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-crew]'))
    abandonButtons.forEach(button => button.addEventListener('pointerdown', abandonTouch))
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', keydown, { capture: true })
      window.removeEventListener('keyup', keyup, { capture: true })
      window.removeEventListener('blur', blur)
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('pointerdown', pointer)
      joystick.removeEventListener('pointerdown', joystickDown)
      joystick.removeEventListener('pointermove', joystickMove)
      joystick.removeEventListener('pointerup', joystickUp)
      joystick.removeEventListener('pointercancel', joystickUp)
      joystick.removeEventListener('lostpointercapture', resetJoystick)
      action.removeEventListener('pointerdown', actionDown)
      action.removeEventListener('pointerup', actionUp)
      action.removeEventListener('pointercancel', actionUp)
      tapButton.removeEventListener('pointerdown', tapWire)
      muteButton.removeEventListener('click', mobileMute)
      restartButton.removeEventListener('click', mobileRestart)
      abandonButtons.forEach(button => button.removeEventListener('pointerdown', abandonTouch))
      audio.reset()
    }
  }, [])

  return <main className="stage">
    <div className="screen">
      <canvas ref={canvasRef} width={CONFIG.width} height={CONFIG.height} tabIndex={0} role="application" aria-label="THE LAST POD" aria-describedby="controls">
        THE LAST POD requires a browser with HTML canvas support.
      </canvas>
    </div>
    <div className="touch-controls" aria-label="Touch controls">
      <div ref={joystickRef} className="joystick" role="group" aria-label="Move">
        <span ref={joystickKnobRef} className="joystick-knob" />
      </div>
      <div className="touch-right">
        <div className="touch-actions">
          <button ref={tapRef} className="touch-button touch-tap" type="button">TAP E</button>
          <button ref={actionRef} className="touch-button touch-hold" type="button">HOLD E</button>
        </div>
        <div className="touch-utility">
          <button ref={muteRef} className="touch-button touch-small" type="button">SOUND</button>
          <button ref={restartRef} className="touch-button touch-small" type="button">RESTART</button>
        </div>
      </div>
      <div className="touch-abandon" aria-label="Abandon crew">
        {[0, 1, 2, 3].map(id => <button key={id} className="touch-button touch-crew" type="button" data-crew={id} aria-label={`Abandon crew ${id + 1}`}>{id + 1}</button>)}
      </div>
    </div>
    <p id="controls" className="sr-only">WASD or arrows or the touch joystick to move. Touch crew to recruit them. Prep 2 of 3 pod tasks: tap E at the Cafeteria wires, carry Storage fuel to the pod, or stand still holding E on the Med Bay bioscan, which also reports whether the impostor is in your line. Hold E or the touch HOLD E button to unlock doors, reset breakers during lights out, or launch the pod. Use TAP E for wires. Keys 1 through 4 or the crew buttons abandon followers. Watch for the impostor’s glitching nameplate. M or SOUND mutes, R or RESTART restarts, Enter or Space starts or plays again. The game pauses when it loses focus.</p>
    <p ref={statusRef} className="sr-only" role="status" aria-live="polite" />
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
