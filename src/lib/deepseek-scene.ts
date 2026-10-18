import { createSwimMotion } from './deepseek-motion'
import {
  clamp,
  createWater,
  sampleWater,
  disturbWater,
  advanceWater,
  surfaceSplashPower,
} from './deepseek-water'

type Drop = {
  el: SVGEllipseElement
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
}
type Bubble = { el: SVGCircleElement; x: number; y: number; age: number; life: number; r: number }
type Splash = { el: SVGPathElement; x: number; y: number; age: number; life: number; power: number }

/** 每个实例独立持有时钟、粒子和事件；暂停与恢复保留当前姿态。 */
export function createDeepSeekScene(root: HTMLElement, reduced: boolean) {
  const abort = new AbortController()
  function q<T extends Element = SVGElement>(selector: string): T {
    const el = root.querySelector<T>(selector)
    if (!el) throw new Error(`Missing DeepSeek scene element: ${selector}`)
    return el
  }
  function listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) {
    target.addEventListener(type, listener, { signal: abort.signal })
  }

  const scene = q<HTMLElement>('.ds-scene')
  const handle = q<HTMLButtonElement>('.ds-whale-handle')
  const whale = q('.ds-whale')
  const facing = q('.ds-facing')
  const tail = q('.ds-tail')
  const back = q('.ds-water-back')
  const water = q('.ds-water-main')
  const front = q('.ds-water-front')
  const veil = q('.ds-water-veil')
  const surface = q('.ds-surface')
  const foam = q('.ds-foam')
  const flows = [...root.querySelectorAll<SVGPathElement>('.ds-flow')]
  const wakes = [...root.querySelectorAll<SVGPathElement>('.ds-wake')]
  const dropGroup = q('.ds-droplets')
  const bubbleGroup = q('.ds-bubbles')
  const splashGroup = q('.ds-splashes')
  const note = q<HTMLElement>('.ds-note')
  const label = q<HTMLElement>('.ds-state')
  const hint = q<HTMLElement>('.ds-hint')
  const media = { matches: reduced }
  const ns = 'http://www.w3.org/2000/svg'

  const options = { wave: 1, splash: 1 }
  const waterState = createWater()
  const { heights } = waterState
  const fish = {
    x: 180,
    y: 116,
    vx: 0,
    vy: 0,
    angle: 0,
    flip: 1,
    targetX: 180,
    targetY: 116,
    direction: -1,
  }
  const drops: Drop[] = [],
    bubbles: Bubble[] = [],
    splashes: Splash[] = []
  let frame = 0,
    last: number | null = null,
    time = 0,
    dragId: number | null = null,
    grabX = 0,
    grabY = 0
  let playing = false,
    disposed = false
  let swimming = false,
    tailPhase = 0,
    splashCooldown = 0,
    bubbleClock = 0
  let lastMode = '',
    lastWet = false,
    keyboardMove = false,
    inputAt = 0
  let seed = 527
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  function node<K extends keyof SVGElementTagNameMap>(tag: K, parent: Element) {
    const el = document.createElementNS(ns, tag)
    parent.appendChild(el)
    return el
  }
  function baseY(x: number, layer = 0) {
    const phase = media.matches ? 0 : time
    return (
      146 +
      layer * 10 +
      options.wave *
        (Math.sin(x * 0.026 - phase * 1.35 + layer * 0.9) * 5.4 +
          Math.sin(x * 0.053 + phase * 0.85 + layer) * 2.2)
    )
  }
  function waterY(x: number) {
    return baseY(x) + sampleWater(waterState, x)
  }
  function wavePath(layer = 0) {
    const points = []
    for (let i = 0; i < 73; i++)
      points.push([i * 5, baseY(i * 5, layer) + heights[i] * (layer === 0 ? 1 : 0.4)])
    let d = `M${points[0][0]} ${points[0][1].toFixed(2)}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)],
        p1 = points[i],
        p2 = points[i + 1],
        p3 = points[Math.min(i + 2, points.length - 1)]
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(2)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(2)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2)} ${p2[0]} ${p2[1].toFixed(2)}`
    }
    return d
  }
  function impulse(x: number, strength: number) {
    if (media.matches) return
    disturbWater(waterState, x, strength)
  }
  function burst(x: number, power: number, direction = 0) {
    if (!playing || media.matches || drops.length >= 96) return
    const y = waterY(x) - 2,
      p = clamp(power * options.splash, 0.2, 2.5)
    const count = Math.min(96 - drops.length, Math.round(7 + p * 9))
    for (let i = 0; i < count; i++) {
      const el = node('ellipse', dropGroup)
      el.setAttribute('class', 'ds-drop')
      if (i % 3 !== 0) el.style.fill = 'var(--ds-white)'
      const spread = (random() - 0.5) * (95 + p * 95)
      drops.push({
        el,
        x: x + (random() - 0.5) * 14,
        y,
        vx: spread + direction * 0.1,
        vy: -(48 + random() * 105) * Math.sqrt(p),
        age: 0,
        life: 0.5 + random() * 0.45,
        size: 0.7 + random() * 1.6,
      })
    }
    const el = node('path', splashGroup)
    el.setAttribute('class', 'ds-splash')
    splashes.push({ el, x, y, age: 0, life: 0.52, power: p })
    impulse(x, -38 - p * 32)
  }
  const swimmer = createSwimMotion(fish, random, waterY, burst)
  function setMode(mode: string) {
    if (mode === lastMode) return
    lastMode = mode
    const states: Record<string, string[]> = {
      idle: ['拖动 · 双击鲸跃', 'DRAG INTO THE BLUE', '拖入水中看它巡游，双击小鲸，邀它跃出水面。'],
      air: ['准备入水', 'A LITTLE DEEPER', '向上轻甩再松手，也可以邀请小鲸起跳。'],
      surface: ['水面嬉游', 'MAKE A LITTLE SPLASH', '贴着水面划过，会甩出更大的浪花。'],
      deep: ['深浅巡游', 'FOLLOW THE CURRENT', '它会深潜、绕弯、上浮，偶尔跃出水面。'],
      gather: ['蓄力上浮', 'READY TO TAKE FLIGHT', '小鲸正在蓄力，准备冲出水面。'],
      breach: ['鲸跃', 'A MOMENT ABOVE', '起跳、舒展、落水，再潜回蓝色里。'],
    }
    const s = states[mode]
    label.textContent = s[0]
    hint.textContent = s[1]
    note.textContent = s[2]
  }
  function updatePhysics(dt: number) {
    advanceWater(waterState, dt)
  }
  function positionHandle() {
    handle.style.left = `${(fish.x / 360) * 100}%`
    handle.style.top = `${(fish.y / 300) * 100}%`
  }
  function draw(now: number) {
    if (disposed) return
    frame = 0
    const dt = playing && !reduced && last !== null ? Math.min((now - last) / 1000, 0.033) : 0
    last = now
    if (!media.matches) time += dt
    updatePhysics(dt)
    if (dragId !== null || keyboardMove) {
      fish.vx *= Math.exp(-dt * 3)
      fish.vy *= Math.exp(-dt * 3)
      keyboardMove = false
    } else if (swimming && !media.matches) {
      swimmer.update(dt)
    } else {
      fish.vx *= 0.8
      fish.vy *= 0.8
    }
    const sy = waterY(fish.x),
      depth = fish.y - sy
    const wet = depth > -11,
      nearSurface = Math.abs(depth) < 29
    const speed = Math.hypot(fish.vx, fish.vy)
    splashCooldown = Math.max(0, splashCooldown - dt)
    if (wet !== lastWet && (dragId !== null || swimming) && splashCooldown === 0) {
      burst(fish.x, 0.45 + clamp(speed / 230, 0, 1.7), fish.vx)
      splashCooldown = 0.12
    }
    if (dragId !== null && surfaceSplashPower(depth, speed) > 0 && splashCooldown === 0) {
      burst(fish.x, surfaceSplashPower(depth, speed), fish.vx)
      splashCooldown = 0.1
    }
    if (nearSurface && speed > 15) impulse(fish.x, clamp(fish.vy, -120, 120) * dt * 2.3)
    lastWet = wet
    if (wet) {
      swimming = swimming || dragId !== null
      if (!media.matches)
        tailPhase +=
          dt *
          (6.2 +
            clamp(speed / 55, 0, 5) +
            (swimmer.state.phase === 'gather' ? Math.min(swimmer.state.age, 1.5) * 3 : 0))
      bubbleClock += dt
      if (bubbleClock > 0.24 && bubbles.length < 22 && !media.matches) {
        bubbleClock = 0
        const el = node('circle', bubbleGroup)
        el.setAttribute('class', 'ds-bubble')
        bubbles.push({
          el,
          x: fish.x + fish.flip * 25,
          y: fish.y - 7,
          age: 0,
          life: 1.4 + random(),
          r: 1 + random() * 1.5,
        })
      }
    }
    if (Math.abs(fish.vx) > 12) fish.direction = fish.vx > 0 ? 1 : -1
    const facingTarget = fish.direction === 1 ? -1 : 1
    fish.flip += (facingTarget - fish.flip) * (media.matches ? 1 : 1 - Math.exp(-dt * 10))
    const airborne = swimmer.state.phase === 'breach'
    const trajectoryAngle =
      ((Math.atan2(fish.vy, Math.max(12, Math.abs(fish.vx))) * 180) / Math.PI) * fish.direction
    const tilt =
      swimming && dragId === null
        ? clamp(trajectoryAngle, airborne ? -80 : -38, airborne ? 80 : 38) +
          (airborne ? Math.sin(swimmer.state.flightAge * 3) * 8 : Math.sin(tailPhase) * 1.8)
        : clamp(-fish.vy * fish.direction * 0.1, -25, 25)
    fish.angle += (tilt - fish.angle) * (1 - Math.exp(-dt * (airborne ? 12 : 7)))
    const restingBob =
      !swimming && dragId === null && !media.matches ? Math.sin(time * 1.3) * 1.2 : 0
    whale.setAttribute(
      'transform',
      `translate(${fish.x.toFixed(2)} ${(fish.y + restingBob).toFixed(2)}) rotate(${fish.angle.toFixed(2)})`,
    )
    facing.setAttribute('transform', `scale(${fish.flip.toFixed(3)} 1)`)
    const tailStroke = Math.sin(tailPhase) + 0.22 * Math.sin(tailPhase * 2)
    const tailAngle = !media.matches
      ? wet
        ? tailStroke * (13 + Math.min(speed / 40, 10) + (swimmer.state.phase === 'gather' ? 4 : 0))
        : airborne
          ? Math.sin(swimmer.state.flightAge * 4) * 5
          : 0
      : 0
    tail.setAttribute('transform', `rotate(${tailAngle.toFixed(2)} 40 15)`)
    const path = wavePath(0),
      closed = `${path}L360 305H0Z`
    water.setAttribute('d', closed)
    veil.setAttribute('d', closed)
    surface.setAttribute('d', path)
    foam.setAttribute('d', path)
    back.setAttribute('d', `${wavePath(-1)}L360 305H0Z`)
    front.setAttribute('d', `${wavePath(1.8)}L360 305H0Z`)
    foam.setAttribute('stroke-dashoffset', String(-time * 15))
    flows.forEach((el, i) => {
      let d = ''
      for (let x = 0; x <= 360; x += 6) {
        const y =
          172 +
          i * 21 +
          Math.sin(x * 0.029 - time * (0.75 + i * 0.14) + i * 1.4) * (6 + i) +
          Math.sin(x * 0.055 + time * 0.75) * 2
        d += `${x ? 'L' : 'M'}${x} ${y.toFixed(2)}`
      }
      el.setAttribute('d', d)
      el.setAttribute('stroke-dasharray', `${38 + i * 9} ${22 + i * 5}`)
      el.setAttribute('stroke-dashoffset', String(time * (13 + i * 4)))
    })
    wakes.forEach((el, i) => {
      const start = fish.x + fish.flip * (25 + i * 3),
        y = fish.y + 5 + i * 6
      el.setAttribute(
        'd',
        `M${start} ${y}q${fish.flip * 22} ${-9 - i * 2} ${fish.flip * (40 + i * 9)} ${-3 + i * 2}`,
      )
      el.style.opacity =
        wet && !media.matches ? String(clamp(speed / 160, 0, 0.65) * (1 - i * 0.2)) : '0'
    })
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i]
      p.age += dt
      p.vy += 260 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.age > p.life || (p.age > 0.12 && p.y > waterY(p.x) + 4)) {
        p.el.remove()
        drops.splice(i, 1)
        continue
      }
      p.el.setAttribute('cx', p.x.toFixed(2))
      p.el.setAttribute('cy', p.y.toFixed(2))
      p.el.setAttribute('rx', p.size.toFixed(2))
      p.el.setAttribute('ry', (p.size * (1.5 + Math.min(Math.abs(p.vy) / 140, 1.5))).toFixed(2))
      p.el.setAttribute(
        'transform',
        `rotate(${(Math.atan2(p.vy, p.vx) * 180) / Math.PI - 90} ${p.x} ${p.y})`,
      )
      p.el.style.opacity = String(0.85 * (1 - p.age / p.life))
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const p = bubbles[i]
      p.age += dt
      p.y -= 19 * dt
      p.x += Math.sin(time * 2 + p.r) * 6 * dt
      if (p.age > p.life || p.y < waterY(p.x) + 2) {
        p.el.remove()
        bubbles.splice(i, 1)
        continue
      }
      p.el.setAttribute('cx', p.x.toFixed(2))
      p.el.setAttribute('cy', p.y.toFixed(2))
      p.el.setAttribute('r', p.r.toFixed(2))
      p.el.style.opacity = String(0.8 * (1 - p.age / p.life))
    }
    for (let i = splashes.length - 1; i >= 0; i--) {
      const p = splashes[i]
      p.age += dt
      const a = p.age / p.life
      if (a >= 1) {
        p.el.remove()
        splashes.splice(i, 1)
        continue
      }
      const w = 9 + a * 20 * p.power,
        h = Math.sin(a * Math.PI) * (10 + p.power * 11)
      p.el.setAttribute(
        'd',
        `M${p.x - w} ${p.y + 2}Q${p.x - w * 1.2} ${p.y - h} ${p.x - 4} ${p.y + 3}M${p.x + 4} ${p.y + 3}Q${p.x + w * 1.2} ${p.y - h * 1.25} ${p.x + w} ${p.y + 2}`,
      )
      p.el.style.opacity = String((1 - a) * 0.95)
    }
    positionHandle()
    scene.dataset.swimPhase = swimmer.state.phase
    scene.dataset.mode =
      swimming &&
      dragId === null &&
      (swimmer.state.phase === 'breach' || swimmer.state.phase === 'gather')
        ? swimmer.state.phase
        : wet
          ? nearSurface
            ? 'surface'
            : 'deep'
          : dragId !== null
            ? 'air'
            : 'idle'
    setMode(scene.dataset.mode)
    if (playing && !disposed && !document.hidden) frame = requestAnimationFrame(draw)
  }
  function wake() {
    if (disposed) return
    if (!playing) {
      draw(performance.now())
      return
    }
    if (!frame && !document.hidden) {
      last = null
      frame = requestAnimationFrame(draw)
    }
  }
  function point(e: PointerEvent) {
    const r = scene.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 360, y: ((e.clientY - r.top) / r.height) * 300 }
  }
  listen(handle, 'pointerdown', (e) => {
    if (e.button !== 0 || dragId !== null) return
    e.preventDefault()
    const p = point(e)
    grabX = p.x - fish.x
    grabY = p.y - fish.y
    dragId = e.pointerId
    handle.setPointerCapture(e.pointerId)
    handle.setAttribute('aria-pressed', 'true')
    swimmer.grab()
    fish.targetX = fish.x
    fish.targetY = fish.y
    inputAt = performance.now()
    wake()
  })
  listen(handle, 'pointermove', (e) => {
    if (e.pointerId !== dragId) return
    const p = point(e),
      now = performance.now(),
      dt = Math.max(0.008, (now - inputAt) / 1000)
    inputAt = now
    fish.targetX = clamp(p.x - grabX, 39, 321)
    fish.targetY = clamp(p.y - grabY, 67, 235)
    const wasWet = fish.y > waterY(fish.x) - 11
    fish.vx = clamp((fish.targetX - fish.x) / dt, -900, 900)
    fish.vy = clamp((fish.targetY - fish.y) / dt, -900, 900)
    fish.x = fish.targetX
    fish.y = fish.targetY
    const wet = fish.y > waterY(fish.x) - 11
    if (wet !== wasWet) {
      burst(fish.x, 0.8 + Math.min(Math.hypot(fish.vx, fish.vy) / 300, 1.6), fish.vx)
      splashCooldown = 0.1
    }
    if (Math.abs(fish.y - waterY(fish.x)) < 29 && splashCooldown === 0) {
      burst(fish.x, clamp(Math.hypot(fish.vx, fish.vy) / 180, 0.4, 2.4), fish.vx)
      splashCooldown = 0.1
    }
    if (wet) swimming = true
    positionHandle()
    wake()
  })
  function release(e?: PointerEvent) {
    if (dragId === null || (e && e.pointerId !== dragId)) return
    dragId = null
    handle.setAttribute('aria-pressed', 'false')
    if (fish.y > waterY(fish.x) - 27) swimming = true
    const toss = fish.vy < -70 && fish.y < 180
    fish.vx = clamp(fish.vx, -130, 130)
    fish.vy = clamp(fish.vy, -100, 100)
    if (swimming && !media.matches) swimmer.release(toss)
    wake()
  }
  listen(handle, 'pointerup', release)
  listen(handle, 'pointercancel', release)
  listen(handle, 'lostpointercapture', release)
  listen(handle, 'dblclick', (e) => {
    e.preventDefault()
    if (media.matches) return
    swimming = true
    swimmer.requestBreach()
    wake()
  })
  listen(handle, 'keydown', (e) => {
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [-20, 0],
      ArrowRight: [20, 0],
      ArrowUp: [0, -18],
      ArrowDown: [0, 18],
    }
    const key = e.code || e.key
    if (offsets[key]) {
      e.preventDefault()
      const [x, y] = offsets[key]
      fish.targetX = clamp(fish.x + x, 39, 321)
      fish.targetY = clamp(fish.y + y, 67, 235)
      fish.x = fish.targetX
      fish.y = fish.targetY
      fish.vx = x * 5
      fish.vy = y * 5
      keyboardMove = true
      swimming = fish.y > 146
      if (swimming) swimmer.release()
      wake()
    } else if (key === 'Space' || key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (e.repeat) return
      if (media.matches) {
        fish.y = fish.y < 160 ? 185 : 124
        swimming = fish.y > 160
      } else {
        swimming = true
        swimmer.requestBreach()
      }
      wake()
    }
  })
  listen(handle, 'blur', () => {
    if (dragId !== null) release()
  })
  function pause() {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    last = null
  }

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        release()
        pause()
      } else wake()
    },
    { signal: abort.signal },
  )
  draw(performance.now())
  return {
    setPlaying(next: boolean) {
      playing = next && !reduced
      handle.disabled = !next && !reduced
      if (!playing) {
        pause()
        release()
        draw(performance.now())
      } else wake()
    },
    dispose() {
      disposed = true
      abort.abort()
      pause()
      if (dragId !== null && handle.hasPointerCapture(dragId)) handle.releasePointerCapture(dragId)
      dragId = null
      for (const group of [dropGroup, bubbleGroup, splashGroup]) group.replaceChildren()
    },
  }
}
