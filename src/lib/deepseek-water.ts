/** 一维弹簧水面：相邻采样点传递冲击，阻尼让浪逐渐平息。 */
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export function createWater() {
  return { heights: new Float64Array(73), velocities: new Float64Array(73) }
}
export type Water = ReturnType<typeof createWater>

export function disturbWater(water: Water, x: number, strength: number) {
  for (let i = 0; i < water.heights.length; i++) {
    water.velocities[i] += strength * Math.exp(-Math.pow((i * 5 - x) / 15, 2))
  }
}

export function advanceWater({ heights, velocities }: Water, delta: number) {
  if (delta <= 0) return
  const dt = Math.min(delta, 0.1)
  const steps = Math.max(1, Math.ceil(dt / 0.008)),
    h = dt / steps
  for (let step = 0; step < steps; step++) {
    for (let i = 0; i < 73; i++) {
      const left = heights[i ? i - 1 : 1],
        right = heights[i < 72 ? i + 1 : 71]
      velocities[i] +=
        (170 * (left + right - 2 * heights[i]) - 15 * heights[i] - 2.7 * velocities[i]) * h
    }
    for (let i = 0; i < 73; i++) heights[i] = clamp(heights[i] + velocities[i] * h, -20, 20)
  }
}

export function sampleWater({ heights }: Water, x: number) {
  const n = clamp(x / 5, 0, 72),
    i = Math.floor(n),
    t = n - i
  return heights[i] * (1 - t) + heights[Math.min(i + 1, 72)] * t
}

export function surfaceSplashPower(depth: number, speed: number) {
  return Math.abs(depth) < 29 && speed > 42 ? clamp(speed / 180, 0.35, 2.4) : 0
}
