'use client'

/**
 * Background sound for the focus room, made in the browser (Web Audio): no
 * files to load, nothing streamed. Off by default; the choice is remembered
 * in this browser.
 *
 *   rain   bright noise, softened, over a low rumble
 *   brown  deep, even noise (the "brown noise" people focus to)
 *   cafe   a muffled room murmur that swells and settles, and now and then
 *          a cup set down somewhere
 */
export type Ambience = 'off' | 'rain' | 'brown' | 'cafe'

const KEY = 'guildbot:focus:sound'

export function savedAmbience(): Ambience {
  const v = typeof window === 'undefined' ? null : localStorage.getItem(KEY)
  return v === 'rain' || v === 'brown' || v === 'cafe' ? v : 'off'
}

export function saveAmbience(a: Ambience) {
  if (a === 'off') localStorage.removeItem(KEY); else localStorage.setItem(KEY, a)
}

/** Start a sound; returns a stop function that fades it out. */
export function playAmbience(kind: Exclude<Ambience, 'off'>): () => void {
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5)
  master.connect(ctx.destination)
  const timers: ReturnType<typeof setTimeout>[] = []

  const loop = (buffer: AudioBuffer) => {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.start()
    return src
  }

  if (kind === 'brown') {
    const gain = ctx.createGain()
    gain.gain.value = 0.5
    loop(brownNoise(ctx)).connect(gain).connect(master)
  }

  if (kind === 'rain') {
    const hiss = ctx.createBiquadFilter()
    hiss.type = 'bandpass'
    hiss.frequency.value = 2400
    hiss.Q.value = 0.5
    const hissGain = ctx.createGain()
    hissGain.gain.value = 0.09
    loop(whiteNoise(ctx)).connect(hiss).connect(hissGain).connect(master)
    const rumble = ctx.createBiquadFilter()
    rumble.type = 'lowpass'
    rumble.frequency.value = 500
    const rumbleGain = ctx.createGain()
    rumbleGain.gain.value = 0.35
    loop(brownNoise(ctx)).connect(rumble).connect(rumbleGain).connect(master)
  }

  if (kind === 'cafe') {
    const murmur = ctx.createBiquadFilter()
    murmur.type = 'bandpass'
    murmur.frequency.value = 450
    murmur.Q.value = 0.8
    const murmurGain = ctx.createGain()
    murmurGain.gain.value = 0.3
    // The room swells and settles, slowly.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.08
    const depth = ctx.createGain()
    depth.gain.value = 0.12
    lfo.connect(depth).connect(murmurGain.gain)
    lfo.start()
    loop(brownNoise(ctx)).connect(murmur).connect(murmurGain).connect(master)
    // A cup set down somewhere, every few seconds.
    const clink = () => {
      const at = ctx.currentTime
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 1800 + Math.random() * 1400
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.025, at + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25)
      osc.connect(g).connect(master)
      osc.start(at)
      osc.stop(at + 0.3)
      timers.push(setTimeout(clink, 2500 + Math.random() * 6000))
    }
    timers.push(setTimeout(clink, 2000))
  }

  // Browsers start audio suspended until a tap; resume on the first one.
  const resume = () => { ctx.resume().catch(() => {}) }
  window.addEventListener('pointerdown', resume, { once: true })

  return () => {
    timers.forEach(clearTimeout)
    window.removeEventListener('pointerdown', resume)
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
    setTimeout(() => ctx.close().catch(() => {}), 500)
  }
}

function whiteNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function brownNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    data[i] = last * 3.5
  }
  return buffer
}
