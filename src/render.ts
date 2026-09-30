import { CAUSES, CONFIG, CREW, FLOORS, STATIONS, contains, distance, doorLocked, lightsOut, objective, prepCount, report, wiresMarker, type Crew, type Point, type Rect, type Run, type Sound } from './game'
import { pixelAdvance, pixelText, pixelWidth, type PixelOptions } from './pixelfont'

type Ctx = CanvasRenderingContext2D
const TAU = Math.PI * 2
const P = {
  ink: '#0b0c1f', panel: '#171c45', panelHi: '#252d6b', cream: '#fff6e0', muted: '#a3abd8', dim: '#6a72a8',
  lime: '#c4f53a', sky: '#8fd8ff', amber: '#ffc24b', red: '#ff5465', violet: '#b69cff', yellow: '#ffd23f', green: '#6ff0a0',
}
const FONT = "ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
export const BUTTONS = {
  mute: { x: 828, y: 12, w: 108, h: 28 },
  start: { x: 350, y: 190, w: 260, h: 48 },
  again: { x: 350, y: 456, w: 260, h: 46 },
}
const ROOM_STYLE = [
  { floor: '#5a4428', accent: '#ffc27a' }, { floor: '#34405f', accent: '#b3c8ff' },
  { floor: '#1f5456', accent: '#86f2e2' }, { floor: '#225440', accent: '#93f2b8' },
  { floor: '#3f3274', accent: '#cdb8ff' },
]

const colorCache = new Map<string, number[]>()
function rgb(hex: string) {
  let value = colorCache.get(hex)
  if (!value) {
    const n = parseInt(hex.slice(1), 16)
    value = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    colorCache.set(hex, value)
  }
  return value
}
const shade = (hex: string, f: number) => { const [r, g, b] = rgb(hex).map(c => Math.max(0, Math.min(255, Math.round(c * f)))); return `rgb(${r},${g},${b})` }
const fade = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})` }
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
const back = (t: number) => { const x = clamp(t) - 1; return 1 + 2.7 * x * x * x + 1.7 * x * x }

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[] = 0) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r) }
function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[], color: string | CanvasGradient) { rr(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill() }
function sticker(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, border = P.ink, lift = 4, width = 2.5) {
  if (lift) fillRR(ctx, x, y + lift, w, h, r, P.ink)
  rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = width; ctx.strokeStyle = border; ctx.stroke()
}
function label(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y)
}
function textWidth(ctx: Ctx, text: string, size: number, weight = 800) { ctx.font = `${weight} ${size}px ${FONT}`; return ctx.measureText(text).width }
function line(ctx: Ctx, x: number, y: number, ex: number, ey: number, color: string, width = 1) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke() }
function dot(ctx: Ctx, x: number, y: number, r: number, color: string | CanvasGradient) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = color; ctx.fill() }
function glow(ctx: Ctx, x: number, y: number, r: number, hex: string, a = .35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, fade(hex, a)); g.addColorStop(1, fade(hex, 0)); dot(ctx, x, y, r, g)
}
const px = (ctx: Ctx, text: string, x: number, cy: number, scale: number, color: string, options: PixelOptions = {}) => pixelText(ctx, text, x, cy - 3.5 * scale, scale, color, options)
function keycap(ctx: Ctx, x: number, y: number, text: string, h = 18) {
  const w = Math.max(h, textWidth(ctx, text, 10) + 12)
  fillRR(ctx, x, y + 3, w, h, 5, P.ink)
  rr(ctx, x, y, w, h, 5); ctx.fillStyle = '#ecebff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = P.ink; ctx.stroke()
  label(ctx, text, x + w / 2, y + h / 2 + .5, 10, P.ink, 'center')
  return w
}
function hazard(ctx: Ctx, x: number, y: number, w: number, h: number, a = P.amber, b = P.ink, size = 7) {
  ctx.save(); rr(ctx, x, y, w, h, 2); ctx.clip(); ctx.fillStyle = b; ctx.fillRect(x, y, w, h); ctx.fillStyle = a
  for (let i = -h; i < w + h; i += size * 2) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + size, y + h); ctx.lineTo(x + i + size + h, y); ctx.lineTo(x + i + h, y); ctx.closePath(); ctx.fill() }
  ctx.restore()
}
function seeded(seed: number) {
  return () => { seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}
const rand = seeded(20260930)
const STARS = Array.from({ length: 150 }, () => ({ x: rand() * 960, y: rand() * 540, s: rand() < .12 ? 2 : 1, z: .25 + rand() * .75, p: rand() * TAU, c: rand() < .15 ? '#ffe6a8' : rand() < .35 ? '#a9d8ff' : '#ffffff' }))
const CRACKS = Array.from({ length: 30 }, () => ({ x: 16 + rand() * 920, y: 142 + rand() * 286, a: rand() * TAU, l: 10 + rand() * 20 }))

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; gravity: number }
const particles: Particle[] = []
let kick = 0
let lastVisual = 0
function emit(x: number, y: number, colors: string[], count: number, speed: number, life = .6, size = 3, gravity = 0) {
  for (let i = 0; i < count && particles.length < 320; i++) {
    const a = Math.random() * TAU, v = speed * (.35 + Math.random() * .65)
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (.6 + Math.random() * .4), max: life, color: colors[i % colors.length], size: size * (.6 + Math.random() * .6), gravity })
  }
}
function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.vx *= 1 - dt * 2.2; p.vy *= 1 - dt * 2.2
    if (p.life <= 0) particles.splice(i, 1)
  }
}
function drawParticles(ctx: Ctx) {
  for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size) }
  ctx.globalAlpha = 1
}

type Pose = { facing?: number; moving?: boolean; time?: number; wave?: boolean; glitch?: boolean; alpha?: number; scale?: number; rotate?: number; shadow?: boolean }
function crewmate(ctx: Ctx, x: number, y: number, color: string, pose: Pose = {}) {
  const { facing = 1, moving = false, time = 0, wave = false, glitch = false, alpha = 1, scale = 1, rotate = 0, shadow = true } = pose
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y)
  if (shadow) { ctx.fillStyle = 'rgba(4,5,18,.45)'; ctx.beginPath(); ctx.ellipse(0, 18 * scale, 14 * scale, 4.5 * scale, 0, 0, TAU); ctx.fill() }
  const bob = moving ? -Math.abs(Math.sin(time * 10)) * 2 : Math.sin(time * 3) * .6
  ctx.translate(0, bob * scale); ctx.rotate(rotate); ctx.scale(scale * facing, scale)
  const stride = moving ? Math.sin(time * 20) : 0
  const pack = new Path2D(); pack.roundRect(-17, -9, 10, 19, 4)
  const legs = new Path2D()
  legs.roundRect(-10 + stride * 1.5, 4 - Math.max(0, stride) * 3, 9, 14, [2, 2, 4.5, 4.5])
  legs.roundRect(2 - stride * 1.5, 4 - Math.max(0, -stride) * 3, 9, 14, [2, 2, 4.5, 4.5])
  const body = new Path2D(); body.roundRect(-11, -19, 23, 31, [11.5, 11.5, 7, 7])
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = P.ink
  ctx.stroke(pack); ctx.stroke(legs); ctx.stroke(body)
  ctx.fillStyle = shade(color, .78); ctx.fill(pack); ctx.fill(legs)
  ctx.fillStyle = color; ctx.fill(body)
  ctx.save(); ctx.clip(body)
  ctx.fillStyle = shade(color, .62); ctx.beginPath(); ctx.ellipse(-14, 6, 11, 27, 0, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(5, -16, 5, 2.4, -.3, 0, TAU); ctx.fill()
  ctx.restore()
  ctx.save(); ctx.clip(pack); ctx.fillStyle = shade(color, .55); ctx.fillRect(-17, 2, 10, 8); ctx.restore()
  if (wave) {
    ctx.save(); ctx.translate(9, -3); ctx.rotate(-1.5 + Math.sin(time * 7) * .5)
    const arm = new Path2D(); arm.roundRect(-3, -3, 15, 8, 4)
    ctx.lineWidth = 3.5; ctx.stroke(arm); ctx.fillStyle = color; ctx.fill(arm); ctx.restore()
  }
  const jx = glitch ? Math.sin(time * 90) * 1.6 : 0
  const visor = new Path2D(); visor.roundRect(-1 + jx, -14, 18, 12, 6)
  ctx.lineWidth = 3.5; ctx.stroke(visor)
  const vg = ctx.createLinearGradient(0, -14, 0, -2)
  if (glitch) { vg.addColorStop(0, '#ffc2c9'); vg.addColorStop(.5, '#ff4d6d'); vg.addColorStop(1, '#8a1030') }
  else { vg.addColorStop(0, '#e6fbff'); vg.addColorStop(.45, '#a0d9ee'); vg.addColorStop(1, '#4b87ad') }
  ctx.fillStyle = vg; ctx.fill(visor)
  ctx.save(); ctx.clip(visor); ctx.fillStyle = glitch ? 'rgba(90,0,20,.35)' : 'rgba(25,60,100,.35)'; ctx.fillRect(-2 + jx, -6, 22, 5)
  if (glitch) { ctx.fillStyle = 'rgba(255,230,235,.8)'; ctx.fillRect(-2 + jx * 2, -12 + (time * 40) % 9, 22, 1.2) }
  ctx.restore()
  fillRR(ctx, 4 + jx, -12, 8, 3, 1.5, 'rgba(255,255,255,.92)'); dot(ctx, 14 + jx, -11, 1.2, 'rgba(255,255,255,.85)')
  ctx.restore()
}
function deadBody(ctx: Ctx, crew: Crew) {
  ctx.save(); ctx.translate(crew.x, crew.y)
  ctx.fillStyle = 'rgba(160,20,45,.55)'; ctx.beginPath(); ctx.ellipse(4, 14, 21, 6, 0, 0, TAU); ctx.fill()
  const legs = new Path2D(); legs.roundRect(-10, 6, 9, 12, [2, 2, 4.5, 4.5]); legs.roundRect(2, 6, 9, 12, [2, 2, 4.5, 4.5])
  const body = new Path2D(); body.roundRect(-11, -1, 23, 13, [2, 2, 7, 7])
  const bone = new Path2D(); bone.roundRect(-2, -9, 5, 10, 2); bone.arc(.5, -9, 3.2, 0, TAU)
  ctx.lineWidth = 3.5; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'
  ctx.stroke(legs); ctx.stroke(body); ctx.stroke(bone)
  ctx.fillStyle = shade(crew.color, .78); ctx.fill(legs); ctx.fillStyle = crew.color; ctx.fill(body); ctx.fillStyle = '#f4efe2'; ctx.fill(bone)
  ctx.restore()
  const tag = `✕ ${crew.name}`
  const w = textWidth(ctx, tag, 9) + 14
  sticker(ctx, crew.x - w / 2, crew.y - 30, w, 15, 7.5, P.red, P.ink, 0, 2)
  label(ctx, tag, crew.x, crew.y - 22.2, 9, P.ink, 'center')
}
function pod(ctx: Ctx, x: number, y: number, scale: number, time: number, flame = .4, tilt = 0, broken = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(scale, scale)
  const f = flame * (18 + Math.sin(time * 30) * 4)
  if (f > 0 && !broken) {
    const fg = ctx.createLinearGradient(-32, 0, -34 - f, 0); fg.addColorStop(0, '#fff6d0'); fg.addColorStop(.35, '#ffb347'); fg.addColorStop(1, 'rgba(255,70,60,0)')
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-32, -9); ctx.quadraticCurveTo(-34 - f, 0, -32, 9); ctx.closePath(); ctx.fill()
  }
  ctx.lineJoin = 'round'
  const fins = new Path2D()
  fins.moveTo(-24, -14); fins.lineTo(-8, -14); fins.lineTo(-16, -27); fins.lineTo(-27, -27); fins.closePath()
  fins.moveTo(-24, 14); fins.lineTo(-8, 14); fins.lineTo(-16, 27); fins.lineTo(-27, 27); fins.closePath()
  const nozzle = new Path2D(); nozzle.roundRect(-38, -11, 11, 22, 3)
  const body = new Path2D(); body.roundRect(-31, -17, 64, 34, 17)
  ctx.lineWidth = 3.5; ctx.strokeStyle = P.ink
  ctx.stroke(fins); ctx.stroke(nozzle); ctx.stroke(body)
  ctx.fillStyle = '#ff6470'; ctx.fill(fins); ctx.fillStyle = '#59628f'; ctx.fill(nozzle)
  const bg = ctx.createLinearGradient(0, -17, 0, 17); bg.addColorStop(0, '#ffffff'); bg.addColorStop(.55, '#d3d6f2'); bg.addColorStop(1, '#8e95c6')
  ctx.fillStyle = bg; ctx.fill(body)
  ctx.save(); ctx.clip(body); ctx.fillStyle = P.amber; ctx.fillRect(-12, -17, 7, 34); ctx.fillStyle = 'rgba(11,12,31,.25)'; ctx.fillRect(-31, 9, 64, 8); ctx.restore()
  ctx.stroke(body)
  dot(ctx, 13, -1, 10.5, P.ink)
  const wg = ctx.createLinearGradient(0, -10, 0, 9); wg.addColorStop(0, '#e6fbff'); wg.addColorStop(1, '#3f78a3'); dot(ctx, 13, -1, 8, wg)
  fillRR(ctx, 9, -6, 6, 2.5, 1.2, 'rgba(255,255,255,.9)')
  if (broken) {
    for (let i = 0; i < 12; i++) {
      const a = i * 2.3 + time * 3, r = 18 + (time * 70 + i * 13) % 40
      line(ctx, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * (r + 7), Math.sin(a) * (r + 7), i % 2 ? P.amber : P.red, 2.5)
    }
    for (let i = 0; i < 4; i++) dot(ctx, -34 - i * 9 - (time * 30) % 9, -4 - i * 4, 5 + i * 2, `rgba(40,40,60,${.5 - i * .1})`)
  }
  ctx.restore()
}
function canister(ctx: Ctx, x: number, y: number, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale)
  const body = new Path2D(); body.roundRect(-7, -11, 14, 22, 4)
  const cap = new Path2D(); cap.roundRect(-4, -16, 8, 6, 2)
  ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke(cap); ctx.stroke(body)
  ctx.fillStyle = '#6a7394'; ctx.fill(cap)
  const g = ctx.createLinearGradient(-7, 0, 7, 0); g.addColorStop(0, '#5fc23a'); g.addColorStop(.5, '#a8f06a'); g.addColorStop(1, '#4a9a2c'); ctx.fillStyle = g; ctx.fill(body)
  ctx.save(); ctx.clip(body); hazard(ctx, -7, -2, 14, 5, P.amber, P.ink, 3); ctx.restore()
  ctx.restore()
}

function porthole(g: Ctx, x: number, y: number) {
  dot(g, x, y + 2, 16, P.ink); dot(g, x, y, 16, P.ink); dot(g, x, y, 13.5, '#5a66b8')
  const glass = g.createLinearGradient(x, y - 11, x, y + 11); glass.addColorStop(0, '#1b2a6b'); glass.addColorStop(1, '#070a24'); dot(g, x, y, 10.5, glass)
  for (let i = 0; i < 5; i++) dot(g, x - 6 + ((i * 7) % 12), y - 5 + ((i * 5) % 11), .9, '#ffffff')
  g.beginPath(); g.arc(x, y, 8, -2.6, -1.4); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.stroke()
}
function crate(g: Ctx, x: number, y: number, s: number) {
  sticker(g, x, y, s, s, 3, '#a8733f', P.ink, 3, 2.5)
  g.strokeStyle = '#6e4724'; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, s - 8, s - 8)
  line(g, x + 4, y + 4, x + s - 4, y + s - 4, '#6e4724', 2)
}
function ventProp(g: Ctx, x: number, y: number) {
  sticker(g, x - 12, y - 6, 24, 12, 3, '#3a4488', P.ink, 2, 2)
  for (let i = -7; i <= 7; i += 4.6) line(g, x + i, y - 3, x + i, y + 3, P.ink, 1.6)
}
function consoleProp(g: Ctx, x: number, y: number, screen: string) {
  sticker(g, x - 14, y - 9, 28, 18, 4, '#2d3570', P.ink, 3, 2.5)
  fillRR(g, x - 10, y - 6, 20, 8, 2, screen)
  for (let i = 0; i < 3; i++) dot(g, x - 6 + i * 6, y + 5, 1.6, [P.red, P.lime, P.amber][i])
}
function buildMap(scale: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(CONFIG.width * scale); canvas.height = Math.round(CONFIG.height * scale)
  const g = canvas.getContext('2d')!
  g.scale(scale, scale)
  fillRR(g, 6, 136, 948, 310, 36, P.ink)
  const hull = g.createLinearGradient(0, 132, 0, 440); hull.addColorStop(0, '#222a60'); hull.addColorStop(1, '#10143a')
  rr(g, 10, 132, 940, 304, 32); g.fillStyle = hull; g.fill(); g.lineWidth = 3; g.strokeStyle = P.ink; g.stroke()
  rr(g, 17, 139, 926, 290, 26); g.lineWidth = 1.5; g.strokeStyle = 'rgba(150,170,255,.16)'; g.stroke()
  for (let x = 58; x < 940; x += 72) line(g, x, 142, x, 428, 'rgba(150,170,255,.06)', 1)
  for (let x = 34; x < 930; x += 22) { dot(g, x, 145, 1.3, 'rgba(170,185,255,.3)'); dot(g, x, 424, 1.3, 'rgba(170,185,255,.3)') }
  for (const [x, y] of [[252, 196], [336, 196], [612, 196], [700, 196], [82, 384], [152, 384], [432, 384], [508, 384], [796, 384], [876, 384]]) porthole(g, x, y)
  for (const r of FLOORS) fillRR(g, r.x - 10, r.y - 16, r.w + 20, r.h + 26, 12, P.ink)
  for (const r of FLOORS) fillRR(g, r.x - 7, r.y - 13, r.w + 14, r.h + 20, 9, '#2a3274')
  for (const r of FLOORS) {
    fillRR(g, r.x - 7, r.y - 13, r.w + 14, 4, [9, 9, 2, 2], '#4a59bf')
    for (let x = r.x; x < r.x + r.w - 6; x += 18) fillRR(g, x + 3, r.y - 8, 12, 6, 2, '#20276a')
  }
  const floor = (r: Rect, color: string) => {
    g.save(); rr(g, r.x, r.y, r.w, r.h, 3); g.clip()
    g.fillStyle = color; g.fillRect(r.x, r.y, r.w, r.h)
    g.fillStyle = shade(color, 1.1)
    for (let y = Math.floor(r.y / 24) * 24; y < r.y + r.h; y += 24) for (let x = Math.floor(r.x / 24) * 24; x < r.x + r.w; x += 24) if ((x / 24 + y / 24) % 2 === 0) g.fillRect(x, y, 24, 24)
    g.strokeStyle = 'rgba(8,10,30,.3)'; g.lineWidth = 1
    for (let x = Math.floor(r.x / 24) * 24; x < r.x + r.w; x += 24) line(g, x + .5, r.y, x + .5, r.y + r.h, 'rgba(8,10,30,.28)')
    for (let y = Math.floor(r.y / 24) * 24; y < r.y + r.h; y += 24) line(g, r.x, y + .5, r.x + r.w, y + .5, 'rgba(8,10,30,.28)')
    const top = g.createLinearGradient(0, r.y, 0, r.y + 16); top.addColorStop(0, 'rgba(5,6,22,.5)'); top.addColorStop(1, 'rgba(5,6,22,0)')
    g.fillStyle = top; g.fillRect(r.x, r.y, r.w, 16)
    g.restore()
  }
  const rooms = CONFIG.map.rooms
  rooms.slice(0, 4).forEach((room, i) => { floor(room.neck, ROOM_STYLE[i].floor); floor(room, ROOM_STYLE[i].floor) })
  floor(CONFIG.map.corridor, '#2b3368')
  floor(rooms[4], ROOM_STYLE[4].floor)
  const corridor = CONFIG.map.corridor
  rooms.slice(0, 4).forEach(room => {
    const above = room.y < corridor.y
    hazard(g, room.neck.x + 3, above ? corridor.y - 7 : corridor.y + corridor.h + 3, room.neck.w - 6, 4, P.amber, P.ink, 4)
  })
  for (const x of [120, 300, 470, 610, 850]) {
    g.beginPath(); g.moveTo(x - 6, 281); g.lineTo(x + 4, 290); g.lineTo(x - 6, 299)
    g.strokeStyle = 'rgba(143,216,255,.16)'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.lineCap = 'butt'
  }
  dot(g, 60, 219, 23, P.ink); dot(g, 60, 216, 22, P.ink)
  const core = g.createRadialGradient(54, 210, 2, 60, 216, 19); core.addColorStop(0, '#fff1c2'); core.addColorStop(.35, '#ffb347'); core.addColorStop(1, '#b0521e')
  dot(g, 60, 216, 19, core)
  g.beginPath(); g.arc(60, 216, 12, 0, TAU); g.strokeStyle = 'rgba(11,12,31,.55)'; g.lineWidth = 2; g.stroke()
  for (let i = 0; i < 8; i++) dot(g, 60 + Math.cos(i / 8 * TAU) * 16, 216 + Math.sin(i / 8 * TAU) * 16, 1.4, P.ink)
  consoleProp(g, 142, 171, '#ffb347'); consoleProp(g, 174, 171, '#8fd8ff'); ventProp(g, 172, 238)
  crate(g, 228, 338, 26); crate(g, 228, 368, 26); crate(g, 257, 344, 20)
  sticker(g, 352, 334, 18, 24, 6, '#5c8fd8', P.ink, 3, 2.5); line(g, 352, 341, 370, 341, P.ink, 2); line(g, 352, 351, 370, 351, P.ink, 2)
  ventProp(g, 330, 344)
  for (const [x, y] of [[502, 214], [530, 214], [502, 240], [530, 240]]) { dot(g, x, y + 2, 6, P.ink); dot(g, x, y, 6, P.ink); dot(g, x, y, 4.2, '#ff8a3d') }
  dot(g, 516, 230, 15, P.ink); dot(g, 516, 227, 15, P.ink); dot(g, 516, 227, 12.5, '#e7e3ff')
  dot(g, 512, 224, 3, P.red); dot(g, 521, 229, 3, P.lime)
  ventProp(g, 410, 238)
  for (const y of [338, 372]) {
    sticker(g, 578, y, 44, 18, 5, '#e7ecff', P.ink, 3, 2.5)
    sticker(g, 581, y + 3, 10, 12, 3, '#ffffff', P.ink, 0, 1.5)
    fillRR(g, 594, y + 2, 26, 14, 3, '#4fcf93')
  }
  sticker(g, 693, 316, 14, 11, 2, '#ffffff', P.ink, 0, 1.5); fillRR(g, 699, 318, 2, 7, 0, P.red); fillRR(g, 696, 320.5, 8, 2, 0, P.red)
  ventProp(g, 718, 344)
  hazard(g, 828, 234, 76, 54, P.amber, P.ink, 7)
  fillRR(g, 834, 240, 64, 42, 8, '#2c2356')
  rr(g, 834, 240, 64, 42, 8); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke()
  hazard(g, 928, 184, 9, 100, P.amber, P.ink, 6)
  rooms.forEach((room, i) => {
    const below = i === 1 || i === 3
    pixelText(g, room.name, room.x + 10, below ? room.y + room.h - 18 : room.y + 8, 2, ROOM_STYLE[i].accent, { outline: P.ink })
  })
  return canvas
}
let mapLayer: HTMLCanvasElement | null = null
let mapScale = 0

function space(ctx: Ctx, t: number, drift: number, tint = '#141a46') {
  const g = ctx.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, '#070920'); g.addColorStop(1, tint)
  ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540)
  glow(ctx, 170, 120, 280, '#6b3fd6', .2); glow(ctx, 820, 400, 320, '#1fb5c9', .13)
  for (const s of STARS) {
    const x = ((s.x - t * drift * s.z * 22) % 960 + 960) % 960
    ctx.globalAlpha = .3 + .7 * (.5 + .5 * Math.sin(t * 1.6 * s.z + s.p))
    ctx.fillStyle = s.c; ctx.fillRect(x, s.y, s.s, s.s)
  }
  ctx.globalAlpha = 1
}
function hyperspace(ctx: Ctx, e: number, reduced: boolean) {
  const g = ctx.createRadialGradient(480, 250, 20, 480, 250, 620); g.addColorStop(0, '#26306e'); g.addColorStop(1, '#060818')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540)
  glow(ctx, 480, 250, 260, '#8fd8ff', .16)
  const speed = reduced ? .15 : Math.max(.2, 2.2 - e * .8)
  ctx.lineCap = 'round'
  for (const s of STARS) {
    const r = (s.x / 960 * 560 + e * 150 * s.z) % 560 + 8
    const len = 3 + speed * 34 * s.z * (r / 560)
    const cx = Math.cos(s.p), cy = Math.sin(s.p)
    ctx.globalAlpha = clamp(r / 140)
    line(ctx, 480 + cx * r, 250 + cy * r, 480 + cx * (r - len), 250 + cy * (r - len), s.c, s.s + .4)
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt'
}
function speaker(ctx: Ctx, x: number, y: number, on: boolean) {
  ctx.fillStyle = P.cream; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 3, y - 3); ctx.lineTo(x + 7, y - 7); ctx.lineTo(x + 7, y + 7); ctx.lineTo(x + 3, y + 3); ctx.lineTo(x, y + 3); ctx.closePath(); ctx.fill()
  ctx.lineCap = 'round'
  if (on) { ctx.beginPath(); ctx.arc(x + 8, y, 4.5, -.9, .9); ctx.strokeStyle = P.lime; ctx.lineWidth = 1.8; ctx.stroke() }
  else { line(ctx, x + 10, y - 3, x + 15, y + 3, P.red, 1.8); line(ctx, x + 15, y - 3, x + 10, y + 3, P.red, 1.8) }
  ctx.lineCap = 'butt'
}
function muteButton(ctx: Ctx, muted: boolean) {
  const b = BUTTONS.mute
  sticker(ctx, b.x, b.y, b.w, b.h, 14, P.panel, P.ink, 3)
  keycap(ctx, b.x + 6, b.y + 4, 'M', 17)
  speaker(ctx, b.x + 34, b.y + 14, !muted)
  label(ctx, muted ? 'MUTED' : 'SOUND', b.x + 54, b.y + 14.5, 10.5, muted ? P.muted : P.cream)
}
function startButton(ctx: Ctx, rect: typeof BUTTONS.start, text: string, t: number, reduced: boolean) {
  const pulse = reduced ? 0 : Math.max(0, Math.sin(t * 4)) * 2
  glow(ctx, rect.x + rect.w / 2, rect.y + rect.h / 2, 170, '#c4f53a', .12 + pulse * .03)
  sticker(ctx, rect.x, rect.y - pulse, rect.w, rect.h, rect.h / 2, P.cream, P.ink, 6 + pulse, 3)
  px(ctx, text, rect.x + rect.w / 2 + 10, rect.y + rect.h / 2 - pulse, 3, P.ink, { align: 'center' })
  const ay = rect.y + rect.h / 2 - pulse
  if (reduced || Math.sin(t * 7) > -.3) { ctx.beginPath(); ctx.moveTo(rect.x + 26, ay - 7); ctx.lineTo(rect.x + 36, ay); ctx.lineTo(rect.x + 26, ay + 7); ctx.closePath(); ctx.fillStyle = P.red; ctx.fill() }
}

function titleScreen(ctx: Ctx, t: number, reduced: boolean) {
  space(ctx, reduced ? 0 : t, 1)
  glow(ctx, 480, 590, 460, '#ff9a3d', .34); glow(ctx, 480, 540, 250, '#ffd23f', .28)
  pod(ctx, 480, 322 + Math.sin(t * 1.2) * 6, 2.1, t, .9, -.08 + Math.sin(t * .8) * .04)
  const floaters: [number, number, number, number, number][] = [[0, 116, 132, 2.1, -.5], [1, 846, 118, 1.9, .55], [2, 322, 482, 2.2, .35], [3, 640, 486, 2.1, -.4]]
  for (const [i, x, y, s, r] of floaters) {
    crewmate(ctx, x + Math.sin(t * .7 + i) * 8, y + Math.cos(t * .9 + i) * 7, CREW[i].color, { scale: s, rotate: r + Math.sin(t * .5 + i) * .12, shadow: false, time: t + i, glitch: i === 2 && t % 3.4 < .35, wave: i % 2 === 0 })
  }
  crewmate(ctx, 480, 522, P.yellow, { scale: 6.4, shadow: false, time: t })
  const s = 8
  const width = pixelWidth('THE LAST POD', s, true)
  const left = 480 - width / 2
  const title: PixelOptions = { shadow: '#2c1f78', depth: 8, outline: P.ink, outlineWidth: 3, bold: true }
  pixelText(ctx, 'THE LAST ', left, 56, s, P.cream, title)
  pixelText(ctx, 'POD', left + 9 * pixelAdvance(s, true), 56, s, P.yellow, title)
  px(ctx, 'FOUR CREW. ONE POD. ONE OF THEM IS LYING.', 480, 160, 2, P.sky, { align: 'center', outline: P.ink })
  startButton(ctx, BUTTONS.start, 'PRESS ENTER', t, reduced)
  label(ctx, 'SPACE OR CLICK ALSO STARTS · 60 SECONDS · KEYBOARD', 480, 257, 10, P.muted, 'center')
  sticker(ctx, 30, 276, 236, 162, 16, 'rgba(20,24,64,.92)', P.ink, 5)
  px(ctx, 'HOW TO SURVIVE', 46, 296, 2, P.amber, { outline: P.ink })
  const rules = [['RESCUE THE CREW', 'Touch them. They follow you.'], ['PREP THE POD', '2 of 3 tasks before launch.'], ['EXPOSE THE LIAR', 'Glitches, kills, bioscan.']]
  rules.forEach(([head, body], i) => {
    const y = 330 + i * 38
    sticker(ctx, 44, y - 11, 22, 22, 11, P.lime, P.ink, 2, 2)
    px(ctx, String(i + 1), 55, y, 2, P.ink, { align: 'center' })
    label(ctx, head, 76, y - 6, 12, P.cream)
    label(ctx, body, 76, y + 9, 10, P.muted, 'left', 700)
  })
  sticker(ctx, 694, 276, 236, 162, 16, 'rgba(20,24,64,.92)', P.ink, 5)
  px(ctx, 'CONTROLS', 710, 296, 2, P.amber, { outline: P.ink })
  const keys: [string, string][] = [['WASD', 'MOVE'], ['E', 'HOLD · TAP'], ['1–4', 'ABANDON CREW'], ['M', 'MUTE'], ['R', 'RESTART']]
  keys.forEach(([key, action], i) => {
    const y = 314 + i * 24
    keycap(ctx, 710, y, key, 17)
    label(ctx, action, 772, y + 9, 11, P.cream)
  })
}

function header(ctx: Ctx, run: Run) {
  pixelText(ctx, 'THE LAST', 24, 17, 2, P.cream, { outline: P.ink })
  pixelText(ctx, 'POD', 24 + 9 * 12, 17, 2, P.yellow, { outline: P.ink })
  dot(ctx, 176, 24, 3.5, run.phase === 'playing' ? P.lime : P.muted)
  label(ctx, 'LIVE', 184, 24.5, 9, P.muted)
}
function timerPanel(ctx: Ctx, run: Run, reduced: boolean) {
  const remaining = Math.max(0, CONFIG.duration - run.time)
  const secs = Math.ceil(remaining)
  const critical = remaining < 10
  const pulse = critical && !reduced ? (Math.sin(run.time * 10) + 1) / 2 : 0
  const g = ctx.createLinearGradient(0, 22, 0, 96)
  g.addColorStop(0, critical ? '#5a1426' : P.panelHi); g.addColorStop(1, critical ? '#2a0a18' : P.panel)
  if (critical) glow(ctx, 480, 60, 150, '#ff5465', .18 + pulse * .15)
  sticker(ctx, 386, 22, 188, 74, 18, g, P.ink, 5, 3)
  label(ctx, 'COLLAPSE IN', 480, 35, 9, critical ? '#ffb3bd' : P.muted, 'center')
  const text = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  px(ctx, text, 480, 66 - pulse, 5, critical ? P.red : P.cream, { align: 'center', shadow: P.ink, depth: 3 })
}
function objectiveCard(ctx: Ctx, run: Run) {
  const hint = objective(run)
  const urgent = /locked|Lights out|not ready/i.test(hint.text)
  sticker(ctx, 24, 48, 334, 52, 14, P.panel, P.ink, 4)
  sticker(ctx, 36, 60, 28, 28, 14, urgent ? P.red : P.lime, P.ink, 0, 2.5)
  px(ctx, urgent ? '!' : '→', 50, 74, 2, P.ink, { align: 'center' })
  label(ctx, hint.text, 74, 67, 14, P.cream)
  const sub = run.time < CONFIG.wave.grace ? 'Move now — four safe seconds.' : run.scanResult || 'Watch nameplates for the glitch.'
  label(ctx, sub, 74, 86, 10.5, run.scanResult ? run.scanGood ? P.green : P.red : P.muted, 'left', 700)
}
function prepCard(ctx: Ctx, run: Run) {
  const done = prepCount(run), ready = done >= CONFIG.prep.required
  sticker(ctx, 602, 48, 334, 52, 14, P.panel, P.ink, 4)
  label(ctx, 'POD PREP', 616, 62, 10, P.muted)
  label(ctx, ready ? 'READY TO LAUNCH' : `${done}/${CONFIG.prep.required} NEEDED`, 922, 62, 10, ready ? P.lime : P.amber, 'right')
  STATIONS.forEach((station, i) => {
    const complete = run.prep[station.task]
    const x = 614 + i * 106
    sticker(ctx, x, 73, 98, 19, 9.5, complete ? '#1d5a3c' : '#1c2254', complete ? P.lime : '#3c4592', 0, 2)
    label(ctx, `${complete ? '✓' : '•'}  ${station.name}`, x + 49, 83, 9.5, complete ? P.lime : P.muted, 'center')
  })
}
function progressTrack(ctx: Ctx, run: Run) {
  sticker(ctx, 24, 108, 900, 12, 6, '#0e1234', P.ink, 0, 2)
  const w = 900 * clamp(run.wave / CONFIG.wave.targetX)
  if (w > 2) {
    const g = ctx.createLinearGradient(24, 0, 24 + w, 0); g.addColorStop(0, '#7a1430'); g.addColorStop(1, '#ff5465')
    fillRR(ctx, 26, 110, w - 2, 8, 4, g)
    glow(ctx, 24 + w, 114, 14, '#ff8a5c', .6)
  }
  const pxX = 24 + 900 * clamp(run.player.x / CONFIG.wave.targetX)
  dot(ctx, pxX, 114, 6.5, P.ink); dot(ctx, pxX, 114, 4.5, P.yellow)
  pod(ctx, 936, 114, .3, run.time, .6)
}
function roster(ctx: Ctx, run: Run) {
  const colors: Record<string, string> = { WAITING: P.amber, FOLLOWING: P.lime, LOST: P.red, KILLED: P.red, ABANDONED: P.dim, VENTED: P.violet }
  run.crew.forEach(crew => {
    const x = 24 + crew.id * 230, y = 448, w = 220, h = 50
    const following = crew.status === 'FOLLOWING'
    const gone = crew.status === 'LOST' || crew.status === 'KILLED' || crew.status === 'VENTED'
    sticker(ctx, x, y, w, h, 14, following ? '#202a66' : P.panel, P.ink, 4)
    if (following) fillRR(ctx, x + 14, y + 2, w - 28, 3, 2, P.lime)
    ctx.save(); ctx.beginPath(); ctx.arc(x + 27, y + 25, 17, 0, TAU); ctx.fillStyle = shade(crew.color, .32); ctx.fill(); ctx.clip()
    crewmate(ctx, x + 27, y + 33, crew.color, { scale: .74, shadow: false, alpha: gone ? .4 : 1, time: run.time + crew.id })
    ctx.restore()
    ctx.beginPath(); ctx.arc(x + 27, y + 25, 17, 0, TAU); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke()
    label(ctx, crew.name, x + 52, y + 17, 14, gone ? P.dim : P.cream)
    const tw = textWidth(ctx, crew.status, 8.5) + 14
    sticker(ctx, x + 52, y + 27, tw, 15, 7.5, colors[crew.status], P.ink, 0, 2)
    label(ctx, crew.status, x + 52 + tw / 2, y + 35, 8.5, P.ink, 'center')
    keycap(ctx, x + w - 34, y + 13, String(crew.id + 1), 20)
    if (following) label(ctx, 'LEAVE', x + w - 24, y + 42, 7.5, P.muted, 'center')
  })
}
function legend(ctx: Ctx) {
  const items: [string, string][] = [['WASD', 'MOVE'], ['E', 'HOLD · TAP WIRES'], ['1–4', 'ABANDON'], ['M', 'MUTE'], ['R', 'RESTART']]
  const widths = items.map(([key, text]) => Math.max(17, textWidth(ctx, key, 10) + 12) + 7 + textWidth(ctx, text, 10, 700))
  let x = 480 - (widths.reduce((a, b) => a + b, 0) + (items.length - 1) * 22) / 2
  items.forEach(([key, text], i) => {
    const w = keycap(ctx, x, 508, key, 17)
    label(ctx, text, x + w + 7, 517, 10, P.muted, 'left', 700)
    x += widths[i] + 22
  })
}
function plate(ctx: Ctx, crew: Crew, t: number) {
  if (!crew.revealed || crew.status === 'LOST' || crew.status === 'KILLED' || crew.status === 'VENTED') return
  const scramble = crew.name.split('').map((letter, i) => (Math.floor(t * 20) + i) % 2 ? String.fromCharCode(65 + (Math.floor(t * 27) + i * 7) % 26) : letter).join('')
  const text = `${crew.id + 1} ${crew.glitch ? scramble : crew.name}`
  const w = textWidth(ctx, text, 10) + 16
  const jx = crew.glitch ? Math.sin(t * 80) * 2 : 0
  const x = crew.x - w / 2 + jx, y = crew.y - 46
  sticker(ctx, x, y, w, 17, 8.5, 'rgba(11,12,31,.92)', crew.glitch ? P.red : crew.color, 0, 2)
  if (crew.glitch) { label(ctx, text, crew.x + jx - 1.5, y + 9, 10, '#ff3050', 'center'); label(ctx, text, crew.x + jx + 1.5, y + 9, 10, '#30e0ff', 'center') }
  label(ctx, text, crew.x + jx, y + 9, 10, P.cream, 'center')
}
function marker(ctx: Ctx, x: number, y: number, done: boolean, t: number, color: string) {
  const bob = Math.sin(t * 4 + x) * 2
  sticker(ctx, x - 9, y - 9 + bob, 18, 18, 9, done ? P.green : color, P.ink, 2, 2)
  px(ctx, done ? '✓' : '!', x + .5, y + bob, 2, P.ink, { align: 'center' })
}
function drawStations(ctx: Ctx, run: Run) {
  const { wires, fuel, scan } = CONFIG.prep.stations
  const t = run.time
  if (!run.prep.wires) glow(ctx, wires.x, wires.y, 40, P.amber, .28 + Math.sin(t * 4) * .1)
  sticker(ctx, wires.x - 16, wires.y - 12, 32, 24, 5, '#1b2350', P.ink, 3, 2.5)
  ;[P.red, P.amber, P.sky].forEach((color, i) => {
    const target = run.prep.wires ? i : (i + 1) % 3
    ctx.lineCap = 'round'; line(ctx, wires.x - 10, wires.y - 6 + i * 6, wires.x + 10, wires.y - 6 + target * 6, color, 2.6); ctx.lineCap = 'butt'
  })
  marker(ctx, wires.x, wires.y - 30, run.prep.wires, t, P.amber)
  if (!run.prep.fuel && !run.carrying) {
    glow(ctx, fuel.x, fuel.y, 40, P.lime, .26 + Math.sin(t * 4) * .1)
    canister(ctx, fuel.x, fuel.y, 1.05)
  }
  if (!run.carrying) marker(ctx, fuel.x, fuel.y - 32, run.prep.fuel, t, P.lime)
  const scanning = run.interaction?.kind === 'scan' && run.hold > 0
  if (!run.prep.scan || scanning) glow(ctx, scan.x, scan.y, 44, P.green, .22 + Math.sin(t * 4) * .08)
  ctx.beginPath(); ctx.ellipse(scan.x, scan.y + 2, 21, 10.5, 0, 0, TAU); ctx.fillStyle = P.ink; ctx.fill()
  ctx.beginPath(); ctx.ellipse(scan.x, scan.y, 20, 10, 0, 0, TAU); ctx.fillStyle = '#153a2e'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke()
  const ring = (t * .9) % 1
  ctx.beginPath(); ctx.ellipse(scan.x, scan.y, 6 + ring * 12, 3 + ring * 6, 0, 0, TAU); ctx.strokeStyle = fade('#6ff0a0', 1 - ring); ctx.lineWidth = 2; ctx.stroke()
  marker(ctx, scan.x, scan.y - 30, run.prep.scan, t, P.green)
  STATIONS.forEach(station => label(ctx, station.name, station.point.x, station.point.y + (station.task === 'scan' ? 20 : 22), 8, run.prep[station.task] ? P.green : P.cream, 'center'))
}
function kiosk(ctx: Ctx, x: number, y: number, state: 'idle' | 'locked' | 'breaker', t: number) {
  sticker(ctx, x - 7, y - 10, 14, 20, 4, '#1b2350', P.ink, 2, 2)
  const blink = Math.sin(t * 10) > 0
  fillRR(ctx, x - 4, y - 7, 8, 8, 2, state === 'locked' ? blink ? P.red : '#6a1a2a' : state === 'breaker' ? blink ? P.amber : '#6a4a10' : '#3f7fb0')
  if (state !== 'idle') glow(ctx, x, y - 3, 18, state === 'locked' ? P.red : P.amber, .35)
}
function drawDoors(ctx: Ctx, run: Run) {
  const dark = lightsOut(run)
  for (const door of run.doors) {
    const locked = doorLocked(run, door), x = door.x
    sticker(ctx, x - 9, 254, 18, 12, 3, '#5a64a8', P.ink, 0, 2.5)
    sticker(ctx, x - 9, 314, 18, 12, 3, '#5a64a8', P.ink, 0, 2.5)
    if (locked) {
      glow(ctx, x, 290, 34, P.red, .3)
      hazard(ctx, x - 6, 263, 12, 54, P.red, P.ink, 5)
      rr(ctx, x - 6, 263, 12, 54, 2); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke()
      const text = `LOCKED ${Math.ceil(door.lockedUntil - run.time)}S`
      const w = textWidth(ctx, text, 9) + 14
      sticker(ctx, x - w / 2, 232, w, 16, 8, P.red, P.ink, 2, 2)
      label(ctx, text, x, 240.5, 9, P.ink, 'center')
    } else { ctx.globalAlpha = .4; line(ctx, x, 270, x, 310, P.sky, 1.5); ctx.globalAlpha = 1 }
    for (const side of [-1, 1]) kiosk(ctx, x + side * CONFIG.map.consoleOffset, CONFIG.map.consoleY, locked ? 'locked' : dark ? 'breaker' : 'idle', run.time)
  }
}
function corridorLights(ctx: Ctx, run: Run) {
  const dark = lightsOut(run)
  for (let x = 44; x < 920; x += 44) {
    const behind = run.time > CONFIG.wave.grace && x < run.wave
    ctx.globalAlpha = behind ? .35 + .3 * Math.abs(Math.sin(run.time * 9 + x)) : dark ? .12 : .85
    const c = behind ? P.red : P.sky
    fillRR(ctx, x - 7, 266, 14, 3, 1.5, c); fillRR(ctx, x - 7, 311, 14, 3, 1.5, c)
  }
  ctx.globalAlpha = 1
}
function launchConsole(ctx: Ctx, run: Run) {
  const ready = prepCount(run) >= CONFIG.prep.required
  const { x, y } = CONFIG.map.launch
  glow(ctx, x, y, 44, ready ? P.lime : P.red, ready ? .3 + Math.sin(run.time * 5) * .1 : .15)
  sticker(ctx, x - 16, y - 11, 32, 22, 5, '#1b2350', P.ink, 3, 2.5)
  dot(ctx, x, y + 1, 7.5, P.ink); dot(ctx, x, y, 6, ready ? P.lime : P.red); dot(ctx, x - 2, y - 2, 1.8, 'rgba(255,255,255,.7)')
  const text = ready ? 'LAUNCH' : `PREP ${prepCount(run)}/${CONFIG.prep.required}`
  const w = textWidth(ctx, text, 8.5) + 12
  sticker(ctx, x - w / 2, y + 16, w, 14, 7, ready ? P.lime : P.red, P.ink, 0, 2)
  label(ctx, text, x, y + 23.5, 8.5, P.ink, 'center')
}
function vented(ctx: Ctx, crew: Crew, time: number) {
  const progress = clamp((time - crew.lostAt) / CONFIG.vent.duration)
  sticker(ctx, crew.x - 15, crew.y + 9, 30, 10, 3, '#3a4488', progress < 1 ? P.red : P.ink, 0, 2.5)
  for (let i = -9; i <= 9; i += 4.5) line(ctx, crew.x + i, crew.y + 11, crew.x + i, crew.y + 17, P.ink, 1.6)
  if (progress >= 1) return
  ctx.save(); ctx.beginPath(); ctx.rect(crew.x - 34, crew.y - 70, 68, 82); ctx.clip()
  crewmate(ctx, crew.x, crew.y + progress * 34, crew.color, { facing: crew.facing, time, glitch: true, shadow: false })
  ctx.restore()
}
function collapse(ctx: Ctx, run: Run) {
  if (run.time <= CONFIG.wave.grace || run.wave <= 0) return
  const w = run.wave, top = 132, bottom = 440, t = run.time
  const pts: Point[] = []
  for (let y = top; y <= bottom; y += 10) pts.push({ x: w + Math.sin(y * .13 + t * 9) * 5 + Math.sin(y * .047 - t * 5) * 7, y })
  const front = (from: number) => { ctx.beginPath(); ctx.moveTo(from, top); for (const p of pts) ctx.lineTo(p.x, p.y); ctx.lineTo(from, bottom); ctx.closePath() }
  ctx.save(); front(0); ctx.clip()
  ctx.fillStyle = 'rgba(14,3,12,.9)'; ctx.fillRect(0, top, w + 20, bottom - top)
  ctx.fillStyle = `rgba(255,40,70,${.08 + .06 * Math.sin(t * 6)})`; ctx.fillRect(0, top, w + 20, bottom - top)
  ctx.lineCap = 'round'
  for (const c of CRACKS) {
    if (c.x > w) continue
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(c.a) * c.l, c.y + Math.sin(c.a) * c.l); ctx.lineTo(c.x + Math.cos(c.a + .8) * c.l * 1.5, c.y + Math.sin(c.a + .8) * c.l * 1.5)
    ctx.strokeStyle = 'rgba(255,90,100,.4)'; ctx.lineWidth = 1.6; ctx.stroke()
  }
  ctx.lineCap = 'butt'
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(255,90,110,.13)'; ctx.fillRect(0, top + (i * 53 + Math.floor(t * 20) * 37) % 300, w, 2 + i % 3) }
  ctx.restore()
  const edge = ctx.createLinearGradient(w - 56, 0, w + 8, 0)
  edge.addColorStop(0, 'rgba(255,60,70,0)'); edge.addColorStop(.7, 'rgba(255,80,60,.45)'); edge.addColorStop(1, 'rgba(255,200,130,.85)')
  front(w - 56); ctx.fillStyle = edge; ctx.fill()
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
  ctx.strokeStyle = 'rgba(255,90,60,.4)'; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = '#ffe2b0'; ctx.lineWidth = 2.5; ctx.stroke()
  for (let i = 0; i < 34; i++) {
    const y = top + (i * 29 + t * 140 * (1 + i % 3)) % 308
    ctx.fillStyle = i % 3 ? '#ffd08a' : '#ff5a4f'
    ctx.fillRect(w + Math.sin(i * 12.9 + t * 20) * 10 - (i % 5) * 4, y, 2 + i % 3, 2)
  }
  for (let i = 0; i < 8; i++) {
    const phase = (t * .6 + i * .13) % 1
    ctx.save(); ctx.globalAlpha = 1 - phase; ctx.translate(w - phase * 130, top + 20 + (i * 83) % 270 - phase * 24); ctx.rotate(phase * 5 + i)
    const s = 4 + i % 4; rr(ctx, -s / 2, -s / 2, s, s, 1); ctx.fillStyle = '#3a1422'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#ff6b6b'; ctx.stroke(); ctx.restore()
  }
}
function interactionUI(ctx: Ctx, run: Run) {
  const current = run.interaction
  if (!current) return
  if (current.kind === 'wires') {
    const x = run.player.x - 86, y = run.player.y + 28
    sticker(ctx, x, y, 172, 46, 12, P.panel, P.ink, 4)
    label(ctx, 'TAP  E  IN THE GREEN', x + 12, y + 12, 9, P.amber)
    for (let i = 0; i < CONFIG.prep.wiresHits; i++) { dot(ctx, x + 132 + i * 12, y + 12, 4.5, P.ink); dot(ctx, x + 132 + i * 12, y + 12, 3.2, i < run.wiresHits ? P.lime : '#3a4480') }
    sticker(ctx, x + 12, y + 23, 148, 13, 6.5, '#0e1234', P.ink, 0, 2)
    fillRR(ctx, x + 13 + run.wiresZone * 146, y + 24, CONFIG.prep.wiresZone * 146, 11, 5, P.lime)
    sticker(ctx, x + 9 + wiresMarker(run) * 146, y + 19, 6, 21, 3, P.cream, P.ink, 0, 2)
    return
  }
  const ready = prepCount(run) >= CONFIG.prep.required
  const labels = { door: 'HOLD E · UNLOCK', breaker: 'HOLD E · BREAKER', pod: ready ? 'HOLD E · LAUNCH' : 'POD NOT READY', fuel: 'HOLD E · PICK UP', scan: 'STAND STILL · HOLD E' }
  const progress = clamp(run.hold / CONFIG.interaction[current.kind])
  const { x, y } = current.point
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(x, y, 23, 0, TAU); ctx.strokeStyle = P.ink; ctx.lineWidth = 9; ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 4.5; ctx.stroke()
  if (progress > 0) { ctx.beginPath(); ctx.arc(x, y, 23, -Math.PI / 2, -Math.PI / 2 + progress * TAU); ctx.strokeStyle = P.lime; ctx.lineWidth = 5; ctx.stroke() }
  ctx.lineCap = 'butt'
  const text = labels[current.kind]
  const w = textWidth(ctx, text, 9.5) + 18
  const bad = current.kind === 'pod' && !ready
  sticker(ctx, x - w / 2, y - 50, w, 19, 9.5, bad ? P.red : P.lime, P.ink, 3, 2.5)
  label(ctx, text, x, y - 40.5, 9.5, P.ink, 'center')
  if (current.kind === 'scan' && progress > 0) {
    const beam = ctx.createLinearGradient(0, y - 50, 0, y + 10); beam.addColorStop(0, 'rgba(111,240,160,0)'); beam.addColorStop(1, 'rgba(111,240,160,.4)')
    ctx.fillStyle = beam; ctx.fillRect(x - 18, y - 50, 36, 60)
    const sy = run.player.y + 14 - (Math.sin(run.time * 8) + 1) * 18
    line(ctx, run.player.x - 17, sy, run.player.x + 17, sy, '#b8ffd0', 2.5)
  }
}
function popupBanner(ctx: Ctx, run: Run, reduced: boolean) {
  if (run.bannerUntil > run.time) {
    const text = run.bannerText
    const w = pixelWidth(text, 3) + 70
    const jx = reduced ? 0 : Math.sin(run.time * 60) * 2
    const x = 480 - w / 2 + jx
    sticker(ctx, x, 138, w, 40, 12, P.red, P.ink, 5, 3)
    hazard(ctx, x + 8, 146, 18, 24, P.amber, P.ink, 5); hazard(ctx, x + w - 26, 146, 18, 24, P.amber, P.ink, 5)
    px(ctx, text, 480 + jx, 158, 3, P.cream, { align: 'center', shadow: P.ink, depth: 2 })
  } else if (run.popupUntil > run.time) {
    const w = pixelWidth(run.popup, 2) + 40
    sticker(ctx, 480 - w / 2, 140, w, 28, 14, run.popupGood ? '#173f30' : '#48162a', P.ink, 4, 2.5)
    px(ctx, run.popup, 480, 154, 2, run.popupGood ? P.lime : '#ff8a96', { align: 'center' })
  }
}
function edgeArrow(ctx: Ctx, run: Run, target: Point, reduced: boolean) {
  if (distance(target, run.player) < 70) return
  const left = target.x < run.player.x
  const x = left ? 20 : 940, y = clamp(target.y, 152, 424)
  const s = reduced ? 1 : 1 + Math.sin(run.time * 6) * .12
  ctx.save(); ctx.translate(x, y); ctx.scale(left ? -s : s, s)
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, 0); ctx.lineTo(-8, 10); ctx.lineTo(-4, 0); ctx.closePath()
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.fillStyle = P.lime; ctx.fill()
  ctx.restore()
}
function react(run: Run, fired: Sound[], reduced: boolean) {
  const p = run.player
  const n = reduced ? .4 : 1
  for (const sound of fired) {
    if (sound === 'recruit') emit(p.x, p.y - 10, [P.lime, P.yellow, P.sky, '#ff78c4'], 22 * n, 220, .8, 4, 260)
    if (sound === 'hit') emit(p.x, p.y - 10, [P.lime, P.cream], 10 * n, 160, .45, 3)
    if (sound === 'unlock') { emit(p.x, p.y - 6, [P.sky, P.cream], 12 * n, 170, .5, 3); kick = Math.max(kick, 1.5) }
    if (sound === 'step') emit(p.x, p.y + 16, ['rgba(200,210,255,.35)'], 2, 30, .35, 4, -20)
    if (sound === 'alarm') kick = Math.max(kick, 4)
    if (sound === 'powerdown') kick = Math.max(kick, 3)
    if (sound === 'lock') {
      const door = run.doors.find(d => doorLocked(run, d) && d.lockedUntil - run.time > CONFIG.sabotage.autoUnlock - .1)
      if (door) emit(door.x, 290, [P.red, P.amber], 18 * n, 220, .6, 3)
      kick = Math.max(kick, 5)
    }
    if (sound === 'kill') {
      const victim = run.crew.filter(c => c.status === 'KILLED').sort((a, b) => b.lostAt - a.lostAt)[0]
      if (victim) emit(victim.x, victim.y, [P.red, '#8a1030', P.cream], 28 * n, 240, .8, 4, 200)
      kick = Math.max(kick, 9)
    }
    if (sound === 'vent') {
      const imp = run.crew[run.impostor]
      emit(imp.x, imp.y + 10, [P.violet, P.cream, P.red], 20 * n, 200, .7, 3, 150)
      kick = Math.max(kick, 3)
    }
    if (sound === 'crash') kick = Math.max(kick, 12)
  }
  if (run.interaction && run.hold > 0 && Math.random() < .5 * n) emit(run.interaction.point.x, run.interaction.point.y, [P.yellow, P.lime], 1, 120, .35, 2.5)
}
function gameScreen(ctx: Ctx, run: Run, reduced: boolean) {
  const t = run.time
  space(ctx, reduced ? 0 : t, .15)
  const danger = run.time <= CONFIG.wave.grace ? 0 : clamp(1 - (run.player.x - run.wave) / CONFIG.wave.dangerDistance)
  const shakeAmount = reduced ? 0 : kick + danger * CONFIG.feedback.maxShake
  ctx.save()
  ctx.translate(Math.sin(t * 57) * shakeAmount, Math.cos(t * 43) * shakeAmount * .7)
  ctx.drawImage(mapLayer!, 0, 0, CONFIG.width, CONFIG.height)
  glow(ctx, 60, 216, 46, '#ffb347', .22 + Math.sin(t * 3) * .07)
  corridorLights(ctx, run)
  drawStations(ctx, run)
  pod(ctx, 866, 261, .92, t, prepCount(run) >= CONFIG.prep.required ? .7 : .25)
  launchConsole(ctx, run)
  drawDoors(ctx, run)
  glow(ctx, run.player.x, run.player.y, 120, P.yellow, .1)
  const actors: { y: number; draw: () => void }[] = run.crew.map(crew => ({
    y: crew.y,
    draw: () => {
      if (crew.status === 'KILLED') return deadBody(ctx, crew)
      if (crew.status === 'VENTED') return vented(ctx, crew, t)
      const alpha = crew.status === 'LOST' ? Math.max(0, 1 - (t - crew.lostAt) / CONFIG.crew.lostFade) : 1
      if (alpha > 0) crewmate(ctx, crew.x, crew.y, crew.status === 'LOST' ? P.red : crew.color, { facing: crew.facing, moving: crew.status === 'FOLLOWING' && run.player.moving, time: t + crew.id, wave: crew.status === 'WAITING', glitch: crew.glitch, alpha })
    },
  }))
  actors.push({
    y: run.player.y + .01,
    draw: () => {
      if (run.carrying) canister(ctx, run.player.x - run.player.facing * 15, run.player.y - 4, .72)
      crewmate(ctx, run.player.x, run.player.y, P.yellow, { facing: run.player.facing, moving: run.player.moving, time: t })
    },
  })
  actors.sort((a, b) => a.y - b.y).forEach(actor => actor.draw())
  for (const crew of run.crew) plate(ctx, crew, t)
  const my = run.player.y - 38 + Math.sin(t * 5) * 2
  ctx.beginPath(); ctx.moveTo(run.player.x - 6, my); ctx.lineTo(run.player.x + 6, my); ctx.lineTo(run.player.x, my + 7); ctx.closePath()
  ctx.fillStyle = P.lime; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = P.ink; ctx.stroke()
  interactionUI(ctx, run)
  collapse(ctx, run)
  drawParticles(ctx)
  if (lightsOut(run)) {
    const r = CONFIG.sabotage.lightRadius
    const dark = ctx.createRadialGradient(run.player.x, run.player.y, r * .5, run.player.x, run.player.y, r)
    dark.addColorStop(0, 'rgba(3,4,14,0)'); dark.addColorStop(1, 'rgba(3,4,14,.95)')
    ctx.fillStyle = dark; ctx.fillRect(-20, 128, 1000, 318)
    for (const door of run.doors) for (const side of [-1, 1]) { glow(ctx, door.x + side * CONFIG.map.consoleOffset, CONFIG.map.consoleY, 16, P.amber, .5); dot(ctx, door.x + side * CONFIG.map.consoleOffset, CONFIG.map.consoleY - 3, 3.5, P.amber) }
    px(ctx, `LIGHTS OUT · ${Math.ceil(run.lightsUntil - t)}S · FIND A YELLOW BREAKER`, 480, 424, 2, P.amber, { align: 'center', outline: P.ink })
  }
  if (run.killWarning && !reduced && Math.sin(t * 37) > .2) { ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(-20, 128, 1000, 318) }
  if (run.blackoutUntil > t) { ctx.fillStyle = 'rgba(2,3,8,.9)'; ctx.fillRect(-20, 128, 1000, 318) }
  ctx.restore()
  if (danger > 0) {
    const v = ctx.createRadialGradient(480, 285, 180, 480, 285, 560)
    v.addColorStop(0, 'rgba(255,40,70,0)'); v.addColorStop(1, `rgba(200,20,50,${danger * .45})`)
    ctx.fillStyle = v; ctx.fillRect(0, 0, 960, 540)
  }
  header(ctx, run)
  timerPanel(ctx, run, reduced)
  objectiveCard(ctx, run)
  prepCard(ctx, run)
  progressTrack(ctx, run)
  popupBanner(ctx, run, reduced)
  edgeArrow(ctx, run, objective(run).target, reduced)
  roster(ctx, run)
  legend(ctx)
}
function fate(run: Run, crew: Crew) {
  if (crew.id === run.impostor) return { text: 'IMPOSTOR', color: P.red }
  if (crew.status === 'FOLLOWING') return run.phase === 'won' ? { text: 'SAVED', color: P.lime } : { text: run.cause === 'sabotage' ? 'DOOMED' : 'LOST', color: P.red }
  if (crew.status === 'KILLED') return { text: 'KILLED', color: P.red }
  if (crew.status === 'LOST') return { text: 'LOST', color: P.red }
  return { text: 'LEFT BEHIND', color: P.dim }
}
function lineup(ctx: Ctx, run: Run, y: number, t: number) {
  run.crew.forEach((crew, i) => {
    const x = 480 + (i - 1.5) * 128
    const f = fate(run, crew)
    const bright = f.text === 'SAVED' || crew.id === run.impostor
    glow(ctx, x, y, 48, crew.id === run.impostor ? P.red : crew.color, bright ? .22 : .08)
    crewmate(ctx, x, y, crew.color, { scale: 1.35, time: t + i, alpha: bright ? 1 : .42, glitch: crew.id === run.impostor && t % 1.6 < .3, wave: f.text === 'SAVED' })
    label(ctx, crew.name, x, y + 38, 12, P.cream, 'center')
    const w = textWidth(ctx, f.text, 9) + 16
    sticker(ctx, x - w / 2, y + 48, w, 16, 8, f.color, P.ink, 0, 2)
    label(ctx, f.text, x, y + 56.5, 9, P.ink, 'center')
  })
}
function rankBadge(ctx: Ctx, x: number, y: number, rank: string, t: number, k: number) {
  if (k <= 0) return
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(Math.sin(t * 1.2) * .05)
  const burst = new Path2D()
  for (let i = 0; i < 24; i++) { const r = i % 2 ? 52 : 64, a = i / 24 * TAU + t * .25; burst.lineTo(Math.cos(a) * r, Math.sin(a) * r) }
  burst.closePath()
  ctx.save(); ctx.translate(0, 6); ctx.fillStyle = P.ink; ctx.fill(burst); ctx.restore()
  ctx.fillStyle = rank === 'S' ? P.amber : rank === 'A' ? P.lime : rank === 'B' ? P.sky : P.violet; ctx.fill(burst)
  ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke(burst)
  dot(ctx, 0, 0, 40, P.ink); dot(ctx, 0, 0, 36, '#1d2360')
  px(ctx, rank, 0, 0, 8, P.cream, { align: 'center', shadow: P.ink, depth: 4 })
  ctx.restore()
}
function winScreen(ctx: Ctx, run: Run, e: number, reduced: boolean) {
  const result = report(run)
  hyperspace(ctx, e, reduced)
  if (e < 1.8 && !reduced) {
    const k = Math.pow(e / 1.8, 1.7)
    pod(ctx, -90 + k * 1160, 250 - k * 40, 1.8, e, 1.6, -.05)
    for (let i = 0; i < 6; i++) line(ctx, -90 + k * 1160 - 70 - i * 18, 238 - k * 40 + i * 5, -90 + k * 1160 - 180 - i * 30, 238 - k * 40 + i * 5, 'rgba(143,216,255,.6)', 2)
  }
  const pop = reduced ? 1 : back(e * 2.2)
  ctx.save(); ctx.translate(480, 72); ctx.scale(pop, pop)
  pixelText(ctx, 'POD AWAY', 0, -28, 8, P.lime, { align: 'center', bold: true, shadow: '#1e4a1a', depth: 7, outline: P.ink, outlineWidth: 3 })
  ctx.restore()
  label(ctx, result.saved === 0 ? 'Lone survivor. The silence in this pod is yours.' : 'The ship is gone. Your people are not.', 480, 136, 15, P.cream, 'center')
  rankBadge(ctx, 236, 236, result.rank, e, reduced ? 1 : back((e - .35) * 2.4))
  label(ctx, result.saved === 0 ? 'LONE SURVIVOR' : 'RESCUE RANK', 236, 318, 10, P.muted, 'center')
  const stats: [string, string][] = [['INNOCENTS SAVED', `${result.saved}/3`], ['TIME LEFT', `${result.remaining.toFixed(1)}S`], ['POD TASKS', `${result.prep}/3`], ['DOORS FORCED', String(run.unlocked)]]
  stats.forEach(([name, value], i) => {
    const x = 374 + (i % 2) * 280, y = 170 + Math.floor(i / 2) * 72
    const k = reduced ? 1 : ease((e - .5 - i * .1) * 3)
    ctx.globalAlpha = k
    sticker(ctx, x, y + (1 - k) * 12, 264, 58, 14, P.panel, P.ink, 4)
    label(ctx, name, x + 16, y + 20 + (1 - k) * 12, 10, P.muted)
    px(ctx, value, x + 16, y + 40 + (1 - k) * 12, 3, P.cream, { shadow: P.ink, depth: 2 })
    ctx.globalAlpha = 1
  })
  lineup(ctx, run, 360, e)
  label(ctx, `${run.identified ? `IMPOSTOR ${result.impostor} EXPOSED & VENTED` : `IMPOSTOR ${result.impostor} STAYED ON THE SHIP`}  ·  ${run.kills} KILLED  ·  ${run.sabotages} SABOTAGES  ·  ${run.scans} SCANS`, 480, 438, 10, run.identified ? P.green : P.muted, 'center')
  startButton(ctx, BUTTONS.again, 'PLAY AGAIN', e, reduced)
}
function loseScreen(ctx: Ctx, run: Run, e: number, reduced: boolean) {
  const result = report(run)
  space(ctx, reduced ? 0 : e, .3, '#2a0c24')
  glow(ctx, 480, 280, 420, '#ff3050', .16)
  const imp = run.crew[run.impostor]
  const tx = reduced ? 700 : -80 + ((e * 90) % 1120)
  crewmate(ctx, tx, 214 + Math.sin(e * .8) * 16, imp.color, { scale: 2.1, rotate: reduced ? .3 : e * 1.3, shadow: false, time: e, glitch: e % 1.4 < .35 })
  const heading = run.cause ? CAUSES[run.cause] : 'SHIP LOST'
  const jitter = reduced ? 0 : e < 1 ? Math.sin(e * 90) * 4 : Math.sin(e * 30) > .96 ? 3 : 0
  const opts: PixelOptions = { align: 'center', bold: true }
  pixelText(ctx, heading, 480 - 3 + jitter, 40, 7, 'rgba(48,224,255,.7)', opts)
  pixelText(ctx, heading, 480 + 3 - jitter, 40, 7, 'rgba(255,48,80,.8)', opts)
  pixelText(ctx, heading, 480, 40, 7, P.cream, { ...opts, outline: P.ink, outlineWidth: 3 })
  const lines = { sabotage: 'You escaped the ship. You brought the danger with you.', timeout: 'The last pod launched without you.', wave: 'The collapse caught you before the pod could.', unready: 'The pod was never prepped. It never left the bay.' }
  label(ctx, lines[run.cause ?? 'wave'], 480, 124, 15, '#ffc9cf', 'center')
  const reveal = `${imp.name} WAS THE IMPOSTOR.`
  const shown = reduced ? reveal.length : Math.max(0, Math.floor((e - .6) * 26))
  const visible = reveal.slice(0, shown)
  const w = pixelWidth(reveal, 3)
  const left = 480 - w / 2
  pixelText(ctx, visible.slice(0, imp.name.length), left, 262, 3, imp.color, { outline: P.ink })
  pixelText(ctx, visible.slice(imp.name.length), left + imp.name.length * 18, 262, 3, P.cream, { outline: P.ink })
  const chips: [string, string][] = [['SURVIVED', `${run.endTime.toFixed(1)}S`], ['KILLED', String(run.kills)], ['POD PREP', `${result.prep}/${CONFIG.prep.required}`]]
  chips.forEach(([name, value], i) => {
    const x = 480 + (i - 1) * 150 - 66
    sticker(ctx, x, 298, 132, 30, 15, P.panel, P.ink, 3)
    label(ctx, name, x + 14, 313, 9, P.muted)
    label(ctx, value, x + 118, 313, 12, P.cream, 'right')
  })
  lineup(ctx, run, 368, e)
  startButton(ctx, BUTTONS.again, 'PLAY AGAIN', e, reduced)
}

export function render(ctx: Ctx, run: Run, muted: boolean, paused: boolean, visualTime: number, endElapsed: number, reduced: boolean, fired: Sound[] = []) {
  const scale = ctx.getTransform().a || 1
  if (!mapLayer || mapScale !== scale) { mapLayer = buildMap(scale); mapScale = scale }
  const dt = clamp(visualTime - lastVisual, 0, .05)
  lastVisual = visualTime
  kick *= Math.exp(-dt * 7)
  if (run.phase === 'playing') react(run, fired, reduced)
  else if (fired.includes('crash')) kick = 12
  updateParticles(dt)
  ctx.clearRect(0, 0, CONFIG.width, CONFIG.height)
  if (run.phase === 'title') titleScreen(ctx, visualTime, reduced)
  else if (run.phase === 'playing') gameScreen(ctx, run, reduced)
  else {
    ctx.save()
    if (!reduced && kick > .1) ctx.translate(Math.sin(visualTime * 57) * kick, Math.cos(visualTime * 43) * kick * .7)
    if (run.phase === 'won') winScreen(ctx, run, endElapsed, reduced)
    else loseScreen(ctx, run, endElapsed, reduced)
    ctx.restore()
  }
  muteButton(ctx, muted)
  if (paused && run.phase === 'playing') {
    ctx.fillStyle = 'rgba(6,8,24,.84)'; ctx.fillRect(0, 0, 960, 540)
    px(ctx, 'PAUSED', 480, 240, 7, P.yellow, { align: 'center', shadow: P.ink, depth: 5, outline: P.ink, outlineWidth: 3 })
    label(ctx, 'Return to this tab to resume. No time is lost.', 480, 300, 14, P.cream, 'center')
  }
}
export function hitButton(point: Point, name: keyof typeof BUTTONS) { return contains(BUTTONS[name], point) }
export function dangerLevel(run: Run) { return run.time <= CONFIG.wave.grace ? 0 : clamp(1 - (run.player.x - run.wave) / CONFIG.wave.dangerDistance) }
