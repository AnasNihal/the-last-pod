export const CONFIG = {
  width: 960, height: 540, duration: 60,
  player: { speed: 170, radius: 10, startX: 440, startY: 222, carrySpeed: .85 },
  crew: { radius: 9, recruitDistance: 25, followDelay: .24, followSpacing: 20, trailHistory: 4, trailInterval: 1 / 60, lostFade: .8 },
  tell: { distance: 130, revealAfter: 1.2, interval: 2, duration: .4 },
  sabotage: { firstAfter: 6, interval: 9, autoUnlock: 6, bannerDuration: 1.5, lightsDuration: 8, lightRadius: 100 },
  kill: { firstAfter: 16, interval: 16, warning: 1.5, retry: 2, blackout: .35 },
  vent: { duration: .7 },
  interaction: { radius: 39, door: 1.5, breaker: 1.2, pod: 1.5, fuel: .8, scan: 2 },
  prep: {
    required: 2, wiresHits: 3, wiresPeriod: 1.3, wiresZone: .24,
    stations: { wires: { x: 528, y: 172 }, fuel: { x: 342, y: 404 }, scan: { x: 702, y: 392 } },
  },
  wave: { grace: 4, targetX: 760, easing: 1.65, dangerDistance: 180 },
  feedback: { popupDuration: 2, endAnimation: 1.6, footstepsInterval: .22, maxShake: 2.5, tickFrom: 10 },
  simulationStep: 1 / 120, maxFrameDelta: .15,
  map: {
    corridor: { x: 24, y: 264, w: 904, h: 52 },
    rooms: [
      { name: 'ENGINE', x: 32, y: 144, w: 166, h: 108, color: '#302b23', cx: 115, cy: 195, neck: { x: 94, y: 244, w: 44, h: 30 } },
      { name: 'STORAGE', x: 218, y: 328, w: 156, h: 100, color: '#26303d', cx: 296, cy: 379, neck: { x: 274, y: 306, w: 44, h: 32 } },
      { name: 'CAFETERIA', x: 390, y: 144, w: 164, h: 108, color: '#203b3b', cx: 472, cy: 186, neck: { x: 450, y: 244, w: 44, h: 30 } },
      { name: 'MED BAY', x: 568, y: 328, w: 166, h: 100, color: '#263b30', cx: 650, cy: 379, neck: { x: 628, y: 306, w: 44, h: 32 } },
      { name: 'POD BAY', x: 760, y: 144, w: 168, h: 172, color: '#332c43', cx: 808, cy: 230, neck: { x: 760, y: 264, w: 44, h: 52 } },
    ],
    doorX: [207, 383, 745], doorWidth: 10,
    consoleOffset: 24, consoleY: 289, launch: { x: 873, y: 192 },
  },
}

export type Point = { x: number; y: number }
export type Rect = Point & { w: number; h: number }
export type Sound = 'step' | 'recruit' | 'lock' | 'unlock' | 'alarm' | 'static' | 'success' | 'crash' | 'kill' | 'hit' | 'tick' | 'powerdown' | 'vent' | 'blip'
export type CrewStatus = 'WAITING' | 'FOLLOWING' | 'LOST' | 'ABANDONED' | 'KILLED' | 'VENTED'
export type Crew = Point & {
  id: number; name: string; color: string; room: number; status: CrewStatus
  nearby: number; revealed: boolean; glitch: boolean; glitchOffset: number; lostAt: number; facing: number
}
export type Door = { x: number; lockedUntil: number }
export type TrailPoint = Point & { at: number }
export type PrepTask = 'wires' | 'fuel' | 'scan'
export type Interaction = { kind: 'door' | 'breaker' | 'pod' | 'fuel' | 'wires' | 'scan'; index: number; point: Point }
export type Cause = 'wave' | 'sabotage' | 'timeout' | 'unready'
export type Run = {
  phase: 'title' | 'playing' | 'won' | 'lost'; time: number; endTime: number
  player: Point & { facing: number; moving: boolean }; crew: Crew[]; impostor: number; followers: number[]
  doors: Door[]; unlocked: number; identified: boolean; wave: number; trail: TrailPoint[]; nextTrailAt: number
  nextSabotage: number | null; followedFor: number; bannerUntil: number; bannerText: string; lastSabotage: 'doors' | 'lights'
  lightsUntil: number; nextKill: number | null; killWarning: boolean; blackoutUntil: number
  kills: number; sabotages: number; scans: number; scanResult: string; scanGood: boolean
  prep: Record<PrepTask, boolean>; wiresHits: number; wiresZone: number; carrying: boolean
  popup: string; popupUntil: number; popupGood: boolean
  interaction: Interaction | null; hold: number; holdKey: string; cause: Cause | null
  sounds: Sound[]; nextStepAt: number
}
export type Input = { x: number; y: number; interact: boolean }
export const CREW = [
  { name: 'VEX', color: '#ff8a3d' }, { name: 'MOSS', color: '#35d0c4' },
  { name: 'KIRA', color: '#ff78c4' }, { name: 'TAZ', color: '#8fe04d' },
]
export const CAUSES: Record<Cause, string> = { wave: 'LOST TO THE WAVE', sabotage: 'POD SABOTAGED', timeout: 'OUT OF TIME', unready: 'POD NOT READY' }
export const STATIONS: { task: PrepTask; name: string; point: Point }[] = [
  { task: 'wires', name: 'WIRES', point: CONFIG.prep.stations.wires },
  { task: 'fuel', name: 'FUEL', point: CONFIG.prep.stations.fuel },
  { task: 'scan', name: 'BIOSCAN', point: CONFIG.prep.stations.scan },
]
export const FLOORS: Rect[] = [CONFIG.map.corridor, ...CONFIG.map.rooms.flatMap(room => [room, room.neck])]
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export const contains = (rect: Rect, point: Point) => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
export const inPodBay = (point: Point) => contains(CONFIG.map.rooms[4], point)
const shuffled = <T,>(source: T[]) => {
  const result = [...source]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
const wiresZone = () => .05 + Math.random() * (.9 - CONFIG.prep.wiresZone)
export const waveAt = (time: number) => CONFIG.wave.targetX * Math.pow(Math.max(0, Math.min(1, (time - CONFIG.wave.grace) / (CONFIG.duration - CONFIG.wave.grace))), CONFIG.wave.easing)
export const prepCount = (run: Run) => Object.values(run.prep).filter(Boolean).length
export const lightsOut = (run: Run) => run.lightsUntil > run.time
export const wiresMarker = (run: Run) => 1 - Math.abs(((run.time / CONFIG.prep.wiresPeriod) % 1) * 2 - 1)
export function createRun(phase: Run['phase'] = 'playing'): Run {
  const rooms = shuffled([0, 1, ...shuffled([2, 3, 4]).slice(0, 2)])
  const player = { x: CONFIG.player.startX, y: CONFIG.player.startY, facing: 1, moving: false }
  return {
    phase, time: 0, endTime: 0, player,
    crew: CREW.map((crew, id) => ({ ...crew, id, room: rooms[id], x: CONFIG.map.rooms[rooms[id]].cx, y: CONFIG.map.rooms[rooms[id]].cy, status: 'WAITING', nearby: 0, revealed: false, glitch: false, glitchOffset: Math.random() * CONFIG.tell.interval, lostAt: 0, facing: 1 })),
    impostor: Math.floor(Math.random() * CREW.length), followers: [],
    doors: CONFIG.map.doorX.map(x => ({ x, lockedUntil: 0 })), unlocked: 0, identified: false,
    wave: 0, trail: [{ x: player.x, y: player.y, at: 0 }], nextTrailAt: 0,
    nextSabotage: null, followedFor: 0, bannerUntil: 0, bannerText: '', lastSabotage: Math.random() < .5 ? 'doors' : 'lights',
    lightsUntil: 0, nextKill: null, killWarning: false, blackoutUntil: 0,
    kills: 0, sabotages: 0, scans: 0, scanResult: '', scanGood: true,
    prep: { wires: false, fuel: false, scan: false }, wiresHits: 0, wiresZone: wiresZone(), carrying: false,
    popup: '', popupUntil: 0, popupGood: true,
    interaction: null, hold: 0, holdKey: '', cause: null, sounds: [], nextStepAt: 0,
  }
}
export const doorLocked = (run: Run, door: Door) => door.lockedUntil > run.time
export const consoles = (door: Door): Point[] => [-1, 1].map(side => ({ x: door.x + side * CONFIG.map.consoleOffset, y: CONFIG.map.consoleY }))
export function doorConsole(run: Run, door: Door): Point {
  return { x: door.x + (run.player.x < door.x ? -CONFIG.map.consoleOffset : CONFIG.map.consoleOffset), y: CONFIG.map.consoleY }
}
function canStand(run: Run, x: number, y: number) {
  const r = CONFIG.player.radius
  const onFloor = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r], [x, y]]
    .every(([px, py]) => FLOORS.some(floor => contains(floor, { x: px, y: py })))
  return onFloor && !run.doors.some(door => doorLocked(run, door) && x + r > door.x - CONFIG.map.doorWidth / 2 && x - r < door.x + CONFIG.map.doorWidth / 2 && y + r > CONFIG.map.corridor.y && y - r < CONFIG.map.corridor.y + CONFIG.map.corridor.h)
}
function move(run: Run, input: Input, dt: number) {
  const length = Math.hypot(input.x, input.y)
  const speed = length ? CONFIG.player.speed * (run.carrying ? CONFIG.player.carrySpeed : 1) * dt / length : 0
  const before = { x: run.player.x, y: run.player.y }
  const x = run.player.x + input.x * speed
  const y = run.player.y + input.y * speed
  if (canStand(run, x, run.player.y)) run.player.x = x
  if (canStand(run, run.player.x, y)) run.player.y = y
  if (input.x) run.player.facing = Math.sign(input.x)
  run.player.moving = distance(before, run.player) > 0
  if (run.player.moving && run.time >= run.nextStepAt) {
    run.sounds.push('step')
    run.nextStepAt = run.time + CONFIG.feedback.footstepsInterval
  }
}
function popup(run: Run, text: string, good: boolean) {
  run.popup = text
  run.popupGood = good
  run.popupUntil = run.time + CONFIG.feedback.popupDuration
}
export function abandon(run: Run, id: number) {
  const crew = run.crew[id]
  if (run.phase !== 'playing' || !crew || crew.status !== 'FOLLOWING') return
  run.followers = run.followers.filter(follower => follower !== id)
  if (id === run.impostor) {
    crew.status = 'VENTED'
    crew.lostAt = run.time
    crew.glitch = false
    run.identified = true
    run.nextSabotage = null
    run.nextKill = null
    run.killWarning = false
    popup(run, 'IMPOSTOR ABANDONED! THEY FLED INTO A VENT', true)
    run.sounds.push('vent')
  } else {
    crew.status = 'ABANDONED'
    popup(run, 'THEY WERE INNOCENT...', false)
    run.sounds.push('static')
  }
}
function end(run: Run, cause: Cause | null) {
  run.cause = cause
  run.phase = cause ? 'lost' : 'won'
  run.endTime = run.time
  run.player.moving = false
  run.interaction = null
  run.sounds.push(cause ? 'crash' : 'success')
}
export function launch(run: Run) {
  if (run.phase === 'playing') end(run, run.crew[run.impostor].status === 'FOLLOWING' ? 'sabotage' : null)
}
function finalize(run: Run) {
  if (!inPodBay(run.player)) end(run, 'timeout')
  else if (prepCount(run) < CONFIG.prep.required) end(run, 'unready')
  else launch(run)
}
function triggerSabotage(run: Run) {
  run.sabotages++
  const candidates = run.doors.filter(door => !doorLocked(run, door) && Math.abs(door.x - run.player.x) > CONFIG.player.radius + CONFIG.map.doorWidth)
  const ahead = candidates.filter(door => door.x > run.player.x && door.x < CONFIG.wave.targetX)
  const door = shuffled(ahead.length ? ahead : candidates)[0]
  if (!lightsOut(run) && (run.lastSabotage === 'doors' || !door)) {
    run.lightsUntil = run.time + CONFIG.sabotage.lightsDuration
    run.lastSabotage = 'lights'
    run.bannerText = 'SABOTAGE!  LIGHTS OUT'
    run.sounds.push('powerdown')
  } else if (door) {
    door.lockedUntil = run.time + CONFIG.sabotage.autoUnlock
    run.lastSabotage = 'doors'
    run.bannerText = 'SABOTAGE!  DOOR LOCKED'
    run.sounds.push('lock')
  } else run.bannerText = 'SABOTAGE!  SYSTEMS JAMMED'
  run.bannerUntil = run.time + CONFIG.sabotage.bannerDuration
  run.sounds.push('alarm')
  run.nextSabotage = run.followedFor + CONFIG.sabotage.interval
}
function killVictim(run: Run) {
  const index = run.followers.indexOf(run.impostor)
  if (index < 0) return null
  return [run.followers[index + 1], run.followers[index - 1]].find(id => id !== undefined) ?? null
}
function murder(run: Run, id: number) {
  const victim = run.crew[id]
  victim.status = 'KILLED'
  victim.lostAt = run.time
  victim.revealed = false
  run.followers = run.followers.filter(follower => follower !== id)
  run.kills++
  run.blackoutUntil = run.time + CONFIG.kill.blackout
  run.killWarning = false
  popup(run, `${victim.name} WAS KILLED / THE KILLER WAS BESIDE THEM`, false)
  run.sounds.push('kill')
}
function trailPosition(run: Run, at: number): Point {
  let previous = run.trail[0]
  for (const point of run.trail) {
    if (point.at >= at) {
      const ratio = Math.max(0, Math.min(1, (at - previous.at) / (point.at - previous.at || 1)))
      return { x: previous.x + (point.x - previous.x) * ratio, y: previous.y + (point.y - previous.y) * ratio }
    }
    previous = point
  }
  return previous
}
function updateCrew(run: Run, dt: number) {
  const tellDistance = lightsOut(run) ? Math.min(CONFIG.tell.distance, CONFIG.sabotage.lightRadius) : CONFIG.tell.distance
  for (const crew of run.crew) {
    if (crew.status === 'LOST' || crew.status === 'KILLED' || crew.status === 'VENTED') continue
    if (crew.status === 'WAITING' && distance(crew, run.player) <= CONFIG.crew.recruitDistance) {
      crew.status = 'FOLLOWING'
      run.followers.push(crew.id)
      if (crew.id === run.impostor) {
        run.nextSabotage = run.followedFor + CONFIG.sabotage.firstAfter
        run.nextKill = run.followedFor + CONFIG.kill.firstAfter
      }
      popup(run, `${crew.name} IS WITH YOU / ${crew.id + 1} TO ABANDON`, true)
      run.sounds.push('recruit')
    }
    if (crew.status === 'FOLLOWING') {
      const index = run.followers.indexOf(crew.id)
      const point = trailPosition(run, run.time - CONFIG.crew.followDelay * (index + 1))
      const gap = distance(point, crew)
      if (gap > .01) {
        const stride = Math.min(gap, CONFIG.player.speed * 1.6 * dt)
        const next = { x: crew.x + (point.x - crew.x) / gap * stride, y: crew.y + (point.y - crew.y) / gap * stride }
        const ahead: Point[] = [run.player, ...run.followers.slice(0, index).map(id => run.crew[id])]
        const crowding = ahead.some(other => distance(next, other) < CONFIG.crew.followSpacing && distance(next, other) < distance(crew, other))
        if (!crowding) {
          if (Math.abs(point.x - crew.x) > .1) crew.facing = Math.sign(point.x - crew.x)
          crew.x = next.x
          crew.y = next.y
        }
      }
    }
    if (run.time > CONFIG.wave.grace && crew.x <= run.wave) {
      crew.status = 'LOST'
      crew.lostAt = run.time
      crew.revealed = false
      crew.glitch = false
      run.followers = run.followers.filter(id => id !== crew.id)
      if (crew.id === run.impostor) { run.nextSabotage = null; run.nextKill = null }
      popup(run, `${crew.name} WAS LOST TO THE COLLAPSE`, false)
      continue
    }
    crew.nearby = distance(crew, run.player) <= tellDistance ? crew.nearby + dt : 0
    crew.revealed = crew.nearby >= CONFIG.tell.revealAfter
    const glitch = crew.id === run.impostor && crew.revealed && (run.time + crew.glitchOffset) % CONFIG.tell.interval < CONFIG.tell.duration
    if (glitch && !crew.glitch) run.sounds.push('static')
    crew.glitch = glitch
  }
  if (run.crew[run.impostor].status !== 'FOLLOWING') { run.killWarning = false; return }
  run.followedFor += dt
  if (run.nextSabotage !== null && run.followedFor >= run.nextSabotage) triggerSabotage(run)
  const victim = killVictim(run)
  const warning = victim !== null && run.nextKill !== null && run.followedFor >= run.nextKill - CONFIG.kill.warning
  if (warning && !run.killWarning) run.sounds.push('static')
  run.killWarning = warning
  if (run.nextKill !== null && run.followedFor >= run.nextKill) {
    if (victim !== null) murder(run, victim)
    run.nextKill = run.followedFor + (victim !== null ? CONFIG.kill.interval : CONFIG.kill.retry)
  }
}
const near = (run: Run, point: Point) => distance(run.player, point) <= CONFIG.interaction.radius
function findInteraction(run: Run): Interaction | null {
  for (const [index, door] of run.doors.entries()) {
    const point = doorConsole(run, door)
    if (doorLocked(run, door) && near(run, point)) return { kind: 'door', index, point }
  }
  if (lightsOut(run)) {
    for (const [index, door] of run.doors.entries()) {
      const point = consoles(door).find(console => near(run, console))
      if (point) return { kind: 'breaker', index, point }
    }
  }
  const { stations } = CONFIG.prep
  if (!run.prep.wires && near(run, stations.wires)) return { kind: 'wires', index: 0, point: stations.wires }
  if (!run.prep.fuel && !run.carrying && near(run, stations.fuel)) return { kind: 'fuel', index: 0, point: stations.fuel }
  if (near(run, stations.scan)) return { kind: 'scan', index: 0, point: stations.scan }
  if (inPodBay(run.player) && near(run, CONFIG.map.launch)) return { kind: 'pod', index: 0, point: CONFIG.map.launch }
  return null
}
function complete(run: Run, found: Interaction) {
  if (found.kind === 'door') {
    run.doors[found.index].lockedUntil = 0
    run.unlocked++
    run.sounds.push('unlock')
    popup(run, 'DOOR OPEN / KEEP MOVING', true)
  }
  if (found.kind === 'breaker') {
    run.lightsUntil = 0
    run.sounds.push('unlock')
    popup(run, 'LIGHTS RESTORED', true)
  }
  if (found.kind === 'fuel') {
    run.carrying = true
    run.sounds.push('recruit')
    popup(run, 'FUEL CELL / CARRY IT TO THE POD', true)
  }
  if (found.kind === 'scan') {
    const count = run.followers.length
    const caught = run.followers.includes(run.impostor)
    run.prep.scan = true
    run.scans++
    run.scanGood = !caught
    run.scanResult = count === 0 ? 'BIOSCAN: NO CREW IN YOUR LINE' : caught ? `BIOSCAN: IMPOSTOR AMONG YOUR ${count} FOLLOWER${count > 1 ? 'S' : ''}` : 'BIOSCAN: YOUR LINE IS CLEAN'
    popup(run, run.scanResult, run.scanGood)
    run.sounds.push(caught ? 'alarm' : 'hit')
  }
  if (found.kind === 'pod') launch(run)
}
function interact(run: Run, input: Input, dt: number) {
  const found = findInteraction(run)
  const key = found ? `${found.kind}${found.index}` : ''
  if (key !== run.holdKey || !input.interact) run.hold = 0
  run.holdKey = key
  run.interaction = found
  if (!found || !input.interact || found.kind === 'wires') return
  if (found.kind === 'scan' && run.player.moving) { run.hold = 0; return }
  if (found.kind === 'pod' && prepCount(run) < CONFIG.prep.required) {
    if (run.popupUntil <= run.time) popup(run, `POD NOT READY / PREP ${prepCount(run)}/${CONFIG.prep.required}`, false)
    return
  }
  run.hold += dt
  if (run.hold < CONFIG.interaction[found.kind]) return
  run.hold = 0
  complete(run, found)
}
export function tap(run: Run) {
  if (run.phase !== 'playing' || run.prep.wires || findInteraction(run)?.kind !== 'wires') return
  const marker = wiresMarker(run)
  if (marker >= run.wiresZone && marker <= run.wiresZone + CONFIG.prep.wiresZone) {
    run.wiresHits++
    run.wiresZone = wiresZone()
    if (run.wiresHits >= CONFIG.prep.wiresHits) {
      run.prep.wires = true
      popup(run, `WIRES FIXED / POD PREP ${prepCount(run)}/${CONFIG.prep.required}`, true)
      run.sounds.push('recruit')
    } else run.sounds.push('hit')
  } else {
    run.wiresHits = Math.max(0, run.wiresHits - 1)
    run.sounds.push('static')
  }
}
function step(run: Run, input: Input, dt: number) {
  const previous = run.time
  run.time = Math.min(CONFIG.duration, run.time + dt)
  const remaining = CONFIG.duration - run.time
  if (remaining < CONFIG.feedback.tickFrom && Math.ceil(remaining) < Math.ceil(CONFIG.duration - previous)) run.sounds.push('tick')
  run.wave = waveAt(run.time)
  for (const door of run.doors) {
    if (door.lockedUntil > 0 && door.lockedUntil <= run.time) { door.lockedUntil = 0; run.sounds.push('unlock') }
  }
  if (run.lightsUntil > 0 && run.lightsUntil <= run.time) { run.lightsUntil = 0; popup(run, 'LIGHTS BACK ONLINE', true) }
  move(run, input, dt)
  if (run.time >= CONFIG.duration) { finalize(run); return }
  if (run.time > CONFIG.wave.grace && run.player.x <= run.wave) { end(run, 'wave'); return }
  if (run.carrying && inPodBay(run.player)) {
    run.carrying = false
    run.prep.fuel = true
    run.sounds.push('unlock')
    popup(run, `FUEL LOADED / POD PREP ${prepCount(run)}/${CONFIG.prep.required}`, true)
  }
  if (run.time >= run.nextTrailAt) {
    run.trail.push({ x: run.player.x, y: run.player.y, at: run.time })
    run.nextTrailAt = run.time + CONFIG.crew.trailInterval
    while (run.trail.length > 2 && run.trail[1].at < run.time - CONFIG.crew.trailHistory) run.trail.shift()
  }
  updateCrew(run, dt)
  interact(run, input, dt)
}
export function advance(run: Run, delta: number, input: Input) {
  let remaining = Math.max(0, delta)
  while (remaining > 0 && run.phase === 'playing') {
    const dt = Math.min(remaining, CONFIG.simulationStep, CONFIG.duration - run.time)
    if (dt <= 0) { finalize(run); break }
    step(run, input, dt)
    remaining = Math.max(0, remaining - dt)
  }
}
export function objective(run: Run): { text: string; target: Point } {
  const current = run.interaction
  if (current?.kind === 'door') return { text: 'Door locked! Hold E', target: current.point }
  const locked = run.doors.find(door => doorLocked(run, door) && door.x > run.player.x && door.x < CONFIG.wave.targetX)
  if (locked && locked.x - run.player.x < CONFIG.tell.distance) return { text: 'Door locked! Hold E', target: doorConsole(run, locked) }
  if (lightsOut(run)) {
    const breaker = run.doors.flatMap(consoles).sort((a, b) => distance(a, run.player) - distance(b, run.player))[0]
    return { text: 'Lights out! Hold E at a breaker', target: breaker }
  }
  if (current?.kind === 'wires') return { text: 'Tap E when the marker is green', target: current.point }
  if (current?.kind === 'scan') return { text: 'Stand still and hold E to scan', target: current.point }
  if (run.carrying) return { text: 'Carry the fuel to the pod', target: CONFIG.map.launch }
  const waiting = run.crew.filter(crew => crew.status === 'WAITING' && crew.x > run.wave + 40).sort((a, b) => distance(a, run.player) - distance(b, run.player))
  if (waiting.length && run.time < CONFIG.duration / 2 && !inPodBay(run.player)) return { text: 'Find the crew', target: waiting[0] }
  if (prepCount(run) < CONFIG.prep.required) {
    const station = STATIONS.filter(s => !run.prep[s.task] && s.point.x > run.wave + 40).sort((a, b) => distance(a.point, run.player) - distance(b.point, run.player))[0]
    if (station) return { text: `Prep the pod: ${station.name}`, target: station.point }
  }
  if (run.followers.length && !run.identified && !inPodBay(run.player)) {
    const scan = run.scans === 0 && run.player.x < CONFIG.prep.stations.scan.x
    return { text: scan ? 'Who’s the impostor? Try the BIOSCAN' : 'Who’s the impostor?', target: scan ? CONFIG.prep.stations.scan : CONFIG.map.launch }
  }
  return { text: prepCount(run) >= CONFIG.prep.required ? 'Get to the pod' : 'Pod not ready!', target: CONFIG.map.launch }
}
export function report(run: Run) {
  const saved = run.followers.filter(id => id !== run.impostor).length
  return { saved, rank: ['C', 'B', 'A', 'S'][saved], remaining: Math.max(0, CONFIG.duration - run.endTime), impostor: run.crew[run.impostor].name, prep: prepCount(run) }
}
