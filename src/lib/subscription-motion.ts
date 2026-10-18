const poses = [
  [-13, 17, -7],
  [0, 5, 0],
  [12, -5, 7],
  [24, -15, 14],
]
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * t * (t * (t * 6 - 15) + 10)
}
export const mixPose = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)

export const DECK_CYCLE_MS = 5770
type DeckPhase = 'hold' | 'prepare' | 'extract' | 'lower' | 'return' | 'settle' | 'hide'
export function deckTimeline(elapsed: number): { progress: number; phase: DeckPhase } {
  if (elapsed < 3000) return { progress: 0, phase: 'hold' }
  if (elapsed < 3180) return { progress: 0, phase: 'prepare' }
  if (elapsed < 5430) {
    const progress = (elapsed - 3180) / 2250
    return { progress, phase: progress < 0.4 ? 'extract' : progress < 0.62 ? 'lower' : 'return' }
  }
  return { progress: 1, phase: elapsed < 5590 ? 'settle' : 'hide' }
}

export function deckFrame(
  index: number,
  progress: number,
  width: number,
  phase: DeckPhase = 'hold',
) {
  const half = (angle: number) =>
    (width * Math.abs(Math.cos((angle * Math.PI) / 180)) +
      110 * Math.abs(Math.sin((angle * Math.PI) / 180))) /
    2
  const exit = Math.min(...poses.map((p) => p[0] - half(p[2]))) - half(-7) - 18
  return poses.map((_, i) => {
    const slot = (i - index + 4) % 4,
      a = poses[slot],
      b = poses[(slot + 3) % 4]
    const outside = [exit, 17, -7],
      below = [exit, 26, -7]
    const position = slot
      ? mixPose(a, b, ease((progress - 0.4) / 0.22))
      : progress < 0.4
        ? mixPose(a, outside, ease(progress / 0.4))
        : progress < 0.62
          ? mixPose(outside, below, ease((progress - 0.4) / 0.22))
          : mixPose(below, b, ease((progress - 0.62) / 0.38))
    // A stacked deck has one readable face at a time. Revealing the next
    // Once the outgoing card starts returning to the stack, slot 1 is already
    // the front card. Keep its copy visible from that same geometry transition
    // so text never stays on a card that has moved behind the stack.
    // Exactly one copy is visible in every phase, preventing white/blank
    // fronts and price/title overlap during the handoff.
    const nextCardAtFront = phase === 'return' || phase === 'settle' || phase === 'hide'
    const visible = slot === (nextCardAtFront ? 1 : 0)
    return { position, scale: 1, z: progress < 0.4 ? 4 - slot : slot === 0 ? 1 : 5 - slot, visible }
  })
}

export function fanFrame(deckWidth: number, cardWidth: number, deckHeight = 185) {
  const angle = (4 * Math.PI) / 180
  const width = cardWidth * Math.cos(angle) + 110 * Math.sin(angle)
  const height = 110 * Math.cos(angle) + cardWidth * Math.sin(angle)
  const gap = 12
  // Fit the rotated cards into the existing deck without moving its footer or neighbours.
  const scale = Math.min(
    0.7,
    (deckWidth - 24 - gap) / (2 * width),
    (deckHeight - 8 - gap) / (2 * height),
  )
  const spread = (width * scale + gap) / 2
  const row = (height * scale + gap) / 2
  return poses.map((_, i) => ({
    position: [8 + (i % 2 ? spread : -spread), i < 2 ? -row : row, i % 2 ? 4 : -4],
    scale,
    z: 4 - i,
    visible: true,
  }))
}
