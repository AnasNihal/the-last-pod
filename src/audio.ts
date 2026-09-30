import type { Sound } from './game'

type Mode = 'none' | 'title' | 'game'
const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12)
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
const ROOTS = [45, 41, 48, 43]

class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicBus!: GainNode
  private sfxBus!: GainNode
  private noise!: AudioBuffer
  private rumbleFilter!: BiquadFilterNode
  private rumbleGain!: GainNode
  private sub!: OscillatorNode
  private subGain!: GainNode
  private silent = false
  private paused = false
  private mode: Mode = 'none'
  private intensity = 0
  private step = 0
  private nextNote = 0
  private voices = new Set<AudioScheduledSourceNode>()

  get muted() { return this.silent }
  set muted(value: boolean) { this.silent = value; this.updateMaster() }

  unlock() {
    if (!this.ctx) {
      const ctx = this.ctx = new AudioContext()
      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = -16; compressor.ratio.value = 4; compressor.attack.value = .004; compressor.release.value = .2
      this.master = ctx.createGain(); this.master.connect(compressor); compressor.connect(ctx.destination)
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = .5; this.musicBus.connect(this.master)
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 1; this.sfxBus.connect(this.master)
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      const rumble = ctx.createBufferSource(); rumble.buffer = this.noise; rumble.loop = true
      this.rumbleFilter = ctx.createBiquadFilter(); this.rumbleFilter.type = 'lowpass'; this.rumbleFilter.frequency.value = 90
      this.rumbleGain = ctx.createGain(); this.rumbleGain.gain.value = 0
      rumble.connect(this.rumbleFilter).connect(this.rumbleGain).connect(this.sfxBus); rumble.start()
      this.sub = ctx.createOscillator(); this.sub.type = 'sine'; this.sub.frequency.value = 38
      this.subGain = ctx.createGain(); this.subGain.gain.value = 0
      this.sub.connect(this.subGain).connect(this.sfxBus); this.sub.start()
      this.updateMaster()
      window.setInterval(() => this.schedule(), 25)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
  }

  setPaused(value: boolean) { this.paused = value; this.updateMaster() }
  private updateMaster() {
    if (this.ctx) this.master.gain.setTargetAtTime(this.silent || this.paused ? 0 : .85, this.ctx.currentTime, .02)
  }
  setMusic(mode: Mode) {
    if (mode === this.mode) return
    this.mode = mode
    this.step = 0
    if (this.ctx) this.nextNote = this.ctx.currentTime + .08
  }
  setIntensity(value: number) { this.intensity = Math.max(0, Math.min(1, value)) }

  engine(progress: number, danger: number, active: boolean) {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.rumbleFilter.frequency.setTargetAtTime(80 + progress * 140 + danger * 520, now, .2)
    this.rumbleGain.gain.setTargetAtTime(active ? .04 + progress * .05 + danger * .22 : 0, now, .15)
    this.sub.frequency.setTargetAtTime(34 + progress * 22 + danger * 18, now, .2)
    this.subGain.gain.setTargetAtTime(active ? .03 + danger * .09 : 0, now, .15)
  }

  reset() {
    for (const voice of this.voices) { try { voice.stop() } catch { /* already stopped */ } }
    this.voices.clear()
    this.engine(0, 0, false)
  }

  private track(node: AudioScheduledSourceNode, ...connected: AudioNode[]) {
    this.voices.add(node)
    node.onended = () => { this.voices.delete(node); node.disconnect(); for (const n of connected) n.disconnect() }
  }
  private tone(freq: number, at: number, length: number, volume: number, type: OscillatorType, bus: AudioNode, end?: number, cutoff?: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, at)
    if (end) osc.frequency.exponentialRampToValueAtTime(end, at + length)
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(volume, at + .006)
    gain.gain.exponentialRampToValueAtTime(.0008, at + length)
    let tail: AudioNode = osc
    const nodes: AudioNode[] = [gain]
    if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; osc.connect(f); tail = f; nodes.push(f) }
    tail.connect(gain); gain.connect(bus)
    osc.start(at); osc.stop(at + length + .03)
    this.track(osc, ...nodes)
  }
  private hiss(at: number, length: number, volume: number, type: BiquadFilterType, freq: number, bus: AudioNode, end?: number, q = .8) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain()
    src.buffer = this.noise
    filter.type = type; filter.Q.value = q
    filter.frequency.setValueAtTime(freq, at)
    if (end) filter.frequency.exponentialRampToValueAtTime(end, at + length)
    gain.gain.setValueAtTime(volume, at)
    gain.gain.exponentialRampToValueAtTime(.0008, at + length)
    src.connect(filter).connect(gain).connect(bus)
    src.start(at, Math.random() * Math.max(0, 1.9 - length), length + .05)
    this.track(src, filter, gain)
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running' || this.mode === 'none' || this.paused || this.silent) {
      if (ctx) this.nextNote = ctx.currentTime + .08
      return
    }
    const bpm = this.mode === 'title' ? 92 : 112 + this.intensity * 46
    const sixteenth = 60 / bpm / 4
    if (this.nextNote < ctx.currentTime - .1) this.nextNote = ctx.currentTime + .05
    while (this.nextNote < ctx.currentTime + .14) {
      this.playStep(this.step, this.nextNote, sixteenth)
      this.nextNote += sixteenth
      this.step = (this.step + 1) % 64
    }
  }
  private playStep(step: number, at: number, len: number) {
    const bar = Math.floor(step / 16) % 4, s = step % 16
    const chord = CHORDS[bar], root = ROOTS[bar], bus = this.musicBus
    if (this.mode === 'title') {
      if (s === 0) chord.forEach(n => this.tone(midi(n), at, len * 16, .018, 'triangle', bus))
      if (s % 2 === 0) this.tone(midi(chord[(s / 2) % 3] + 12 + (s >= 8 ? 12 : 0)), at, .28, .032, 'triangle', bus)
      if (s === 0 || s === 8) this.tone(midi(root), at, .5, .07, 'sine', bus)
      if (s === 14 && bar === 3) this.tone(midi(chord[2] + 24), at, .6, .02, 'sine', bus)
      return
    }
    const k = this.intensity
    if (s % 4 === 0) this.tone(150, at, .14, .2, 'sine', bus, 42)
    if (s % 2 === 0) this.tone(midi(root + (s % 4 === 2 ? 12 : 0)), at, len * 1.7, .065, 'square', bus, undefined, 500 + k * 1200)
    if (s % 2 === 1 || k > .6) this.hiss(at, .035, .025 + k * .03, 'highpass', 7000, bus)
    if (k > .4 && (s === 4 || s === 12)) { this.hiss(at, .13, .08, 'bandpass', 1800, bus); this.tone(190, at, .08, .05, 'triangle', bus, 120) }
    if (k > .22 && (s % 2 === 0 || k > .83)) this.tone(midi(chord[s % 3] + 24), at, len * .9, .016 + k * .01, 'square', bus, undefined, 3200)
    if (k > .83 && s === 0) this.tone(midi(root + 36), at, len * 8, .014, 'sawtooth', bus, undefined, 2400)
  }

  play(kind: Sound) {
    if (this.silent || this.paused || !this.ctx || this.ctx.state !== 'running') return
    const t = this.ctx.currentTime, bus = this.sfxBus
    switch (kind) {
      case 'step': this.hiss(t, .04, .05, 'highpass', 2200, bus); this.tone(120, t, .05, .05, 'sine', bus, 60); break
      case 'blip': this.tone(660, t, .06, .07, 'square', bus, undefined, 3000); this.tone(990, t + .06, .1, .07, 'square', bus, undefined, 3000); break
      case 'recruit': [784, 988, 1319].forEach((f, i) => this.tone(f, t + i * .07, .16, .06, 'square', bus, undefined, 4200)); this.hiss(t + .1, .2, .03, 'highpass', 6000, bus); break
      case 'hit': this.tone(880, t, .08, .06, 'square', bus, 1760, 4000); this.tone(1320, t + .05, .1, .04, 'triangle', bus); break
      case 'lock': this.hiss(t, .25, .25, 'lowpass', 900, bus, 200); this.tone(170, t, .2, .11, 'square', bus, 48, 900); this.tone(70, t, .3, .14, 'sine', bus); break
      case 'unlock': [330, 495, 660].forEach((f, i) => this.tone(f, t + i * .06, .12, .06, 'triangle', bus)); this.hiss(t, .18, .05, 'highpass', 3500, bus); break
      case 'alarm': for (let i = 0; i < 2; i++) { this.tone(520, t + i * .5, .25, .075, 'sawtooth', bus, 900, 2200); this.tone(900, t + i * .5 + .25, .25, .075, 'sawtooth', bus, 520, 2200) } break
      case 'static': this.hiss(t, .12, .07, 'bandpass', 3200, bus, undefined, 1.2); this.hiss(t + .05, .04, .05, 'highpass', 5000, bus); break
      case 'powerdown': this.tone(440, t, .75, .1, 'sawtooth', bus, 38, 2500); this.hiss(t, .06, .12, 'highpass', 2000, bus); break
      case 'vent': this.tone(220, t, .3, .06, 'square', bus, 110, 1800); this.tone(233, t, .3, .05, 'square', bus, 116, 1800); this.hiss(t, .35, .12, 'bandpass', 1200, bus, 300); break
      case 'tick': { const urgent = this.intensity > .95; this.tone(urgent ? 1480 : 1040, t, .07, .07, 'square', bus, undefined, 5000); if (urgent) this.tone(740, t, .09, .05, 'sine', bus); break }
      case 'kill': this.hiss(t, .09, .22, 'highpass', 4000, bus); this.tone(988, t + .02, .38, .05, 'square', bus, undefined, 3000); this.tone(1047, t + .02, .38, .05, 'square', bus, undefined, 3000); this.tone(62, t, .6, .22, 'sine', bus, 30); break
      case 'success':
        [72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), t + i * .1, .24, .06, 'square', bus, undefined, 4200))
        ;[72, 76, 79, 88].forEach(n => this.tone(midi(n), t + .42, 1.1, .04, 'triangle', bus))
        this.hiss(t, .7, .06, 'highpass', 800, bus, 9000)
        break
      case 'crash': this.hiss(t, 1.3, .35, 'lowpass', 2600, bus, 90); this.tone(95, t, 1.2, .26, 'sine', bus, 26); this.tone(160, t, .5, .08, 'square', bus, 40, 800); break
    }
  }
}
export const audio = new AudioEngine()
