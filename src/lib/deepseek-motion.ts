/** 曲线巡游与重力鲸跃。坐标使用 360 × 300 的舞台单位。 */
export type Whale = { x: number; y: number; vx: number; vy: number; direction: number }
type Point = [number, number]
type SwimLegKind = 'dive' | 'rise' | 'cruise' | 'gather'
type SwimPhase = SwimLegKind | 'idle' | 'drag' | 'breach'
type Leg = {
  p0: Point
  p1: Point
  p2: Point
  p3: Point
  elapsed: number
  duration: number
  kind: SwimLegKind
}
type MotionState = {
  phase: SwimPhase
  leg: Leg | null
  clock: number
  age: number
  nextBreach: number
  flightAge: number
  route: number
  wasAir: boolean
}

export function createSwimMotion(
  fish: Whale,
  random: () => number,
  surfaceY: (x: number) => number,
  onSplash: (x: number, power: number, direction: number) => void,
) {
  const motion: MotionState = {
    phase: 'idle',
    leg: null,
    clock: 0,
    age: 0,
    nextBreach: 5.1,
    flightAge: 0,
    route: 0,
    wasAir: false,
  }
  const bound = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
  function makeLeg(kind: SwimLegKind) {
    const direction = fish.x > 245 ? -1 : fish.x < 115 ? 1 : fish.direction
    let x, y, duration
    if (kind === 'gather') {
      const launchDirection = fish.x > 180 ? -1 : 1
      x = launchDirection > 0 ? 108 : 252
      y = 174
      duration = 1.45
    } else if (kind === 'dive') {
      x = bound(fish.x + direction * (85 + random() * 50), 65, 295)
      y = 210 + random() * 15
      duration = 2.2 + random() * 0.5
    } else if (kind === 'rise') {
      x = direction > 0 ? 272 : 88
      y = 157 + random() * 9
      duration = 2.6 + random() * 0.6
    } else {
      x = direction > 0 ? 286 : 74
      y = 180 + random() * 33
      duration = 2.8 + random() * 0.8
    }
    const dx = x - fish.x,
      dy = y - fish.y,
      len = Math.max(35, Math.hypot(dx, dy))
    const speed = Math.hypot(fish.vx, fish.vy)
    let ux = speed > 12 ? fish.vx / speed : direction,
      uy = speed > 12 ? fish.vy / speed : 0
    if (kind === 'gather') {
      ux = direction
      uy = 0.25
    }
    const control = len * 0.42
    const p0: Point = [fish.x, fish.y]
    const p1: Point = [
      bound(fish.x + ux * control, 40, 320),
      bound(fish.y + uy * control, 153, 237),
    ]
    const endDirection = Math.sign(dx) || direction
    const p2: Point = [
      bound(x - endDirection * control * 0.75, 44, 316),
      bound(y + (kind === 'rise' ? 28 : kind === 'dive' ? -24 : 20), 153, 237),
    ]
    motion.leg = { p0, p1, p2, p3: [x, y], elapsed: 0, duration, kind }
    motion.phase = kind
    motion.age = 0
  }
  function launch() {
    motion.phase = 'breach'
    motion.leg = null
    motion.flightAge = 0
    motion.wasAir = false
    fish.direction = fish.x > 205 ? -1 : fish.x < 155 ? 1 : fish.direction
    fish.vx = fish.direction * (63 + random() * 8)
    fish.vy = -Math.sqrt(2 * 345 * Math.max(0, fish.y - 64))
    onSplash(fish.x, 0.65, fish.vx)
  }
  function update(dt: number) {
    if (dt <= 0) return
    dt = Math.min(dt, 0.033)
    motion.clock += dt
    motion.age += dt
    if (motion.phase === 'breach') {
      motion.flightAge += dt
      fish.x += fish.vx * dt
      fish.y += fish.vy * dt + 0.5 * 345 * dt * dt
      fish.vy += 345 * dt
      const sea = surfaceY(fish.x)
      if (fish.y < sea - 27) motion.wasAir = true
      if (motion.wasAir && fish.vy > 0 && fish.y >= sea + 19) {
        onSplash(fish.x, 2.5, fish.vx)
        motion.nextBreach = motion.clock + 8.5 + random() * 4
        makeLeg('dive')
      }
      return
    }
    if (motion.clock >= motion.nextBreach && motion.phase !== 'gather') makeLeg('gather')
    if (!motion.leg) makeLeg('dive')
    const leg = motion.leg!
    const pulse = 0.95 + 0.09 * Math.sin(motion.clock * 7)
    leg.elapsed += dt * pulse
    const t = bound(leg.elapsed / leg.duration, 0, 1),
      u = 1 - t
    const { p0, p1, p2, p3 } = leg
    fish.x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
    fish.y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
    fish.vx =
      ((3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])) /
        leg.duration) *
      pulse
    fish.vy =
      ((3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])) /
        leg.duration) *
      pulse
    if (Math.abs(fish.vx) > 3) fish.direction = Math.sign(fish.vx)
    if (t >= 1) {
      if (leg.kind === 'gather') {
        launch()
        return
      }
      motion.route++
      const kinds: SwimLegKind[] = ['rise', 'cruise', 'dive', 'cruise']
      makeLeg(kinds[motion.route % kinds.length])
    }
  }
  return {
    state: motion,
    update,
    grab() {
      motion.leg = null
      motion.phase = 'drag'
    },
    release(toss = false) {
      if (toss && fish.y < 180) {
        launch()
        return
      }
      makeLeg(fish.y > 200 ? 'rise' : 'dive')
      motion.nextBreach = Math.max(motion.clock + 3.2, motion.nextBreach)
    },
    requestBreach() {
      if (motion.phase !== 'breach') makeLeg('gather')
    },
  }
}
