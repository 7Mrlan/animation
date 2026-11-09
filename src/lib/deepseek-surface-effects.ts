import { clamp, oceanCurrent, type ImpactShape } from './deepseek-water.ts'

/** 有寿命的局部水面痕迹；负年龄表示尾水从水下传到水面的短暂延迟。 */
export type SurfaceMark = Readonly<{
  /** 用于复用渲染节点，不依赖数组位置。 */
  id: number
  /** 随表层水流漂移的位置。 */
  x: number
  /** 当前年龄，单位为秒。 */
  age: number
  /** 到期后自然消退。 */
  life: number
  /** 初始横向尺度。 */
  radius: number
  /** 来自风浪、入水或尾鳍的强度。 */
  strength: number
}>

/** 泡沫与平滑水印分别持有，冲击波不会被水印的光滑表象吞掉。 */
export type SurfaceEffects = Readonly<{
  /** 与场景共用的播放时钟。 */
  clock: number
  /** 下一个节点标识。 */
  nextId: number
  /** 仅在风浪破碎或实际冲击后生成。 */
  foam: readonly SurfaceMark[]
  /** 尾鳍近水面下潜后留下的平滑斑。 */
  footprints: readonly SurfaceMark[]
}>

/** 初始海面没有预置白色泡沫或水印。 */
export function createSurfaceEffects(): SurfaceEffects {
  return { clock: 0, nextId: 1, foam: [], footprints: [] }
}

/** 使用同一流场推进痕迹，暂停不消耗年龄或修改旧快照。 */
export function advanceSurfaceEffects(state: SurfaceEffects, delta: number): SurfaceEffects {
  if (delta <= 0) return state
  const clock: number = state.clock + delta
  const drift = (mark: SurfaceMark): SurfaceMark => ({
    ...mark,
    age: mark.age + delta,
    x: mark.x + oceanCurrent(mark.x, 150, clock).x * delta,
  })
  const alive = (mark: SurfaceMark): boolean => mark.age < mark.life && mark.x > -65 && mark.x < 425
  return {
    ...state,
    clock,
    foam: state.foam.map(drift).filter(alive),
    footprints: state.footprints.map(drift).filter(alive),
  }
}

/** 痕迹先形成再消退，不在出生或回收时闪现。 */
export function surfaceMarkStrength(mark: SurfaceMark): number {
  return (
    mark.strength *
    clamp(mark.age / 0.25, 0, 1) *
    Math.pow(clamp(1 - mark.age / mark.life, 0, 1), 1.3)
  )
}

/** 重叠水印只取最强局部作用，不能叠加成一整片静水。 */
export function footprintCalm(state: SurfaceEffects, x: number): number {
  return state.footprints.reduce(
    (calm: number, mark: SurfaceMark): number =>
      Math.max(
        calm,
        Math.exp(-Math.pow((x - mark.x) / mark.radius, 2)) * surfaceMarkStrength(mark) * 0.65,
      ),
    0,
  )
}

/** 只有较强风浪中尖锐的局部浪峰才达到破碎条件。 */
export function breakingCrests(samples: readonly number[], gust: number): readonly number[] {
  if (gust < 0.55) return []
  return samples.flatMap((height: number, index: number): readonly number[] => {
    if (index < 2 || index > samples.length - 3) return []
    const curvature: number = samples[index - 1] + samples[index + 1] - height * 2
    const slope: number = Math.max(samples[index - 1] - height, samples[index + 1] - height) / 6
    return height < samples[index - 1] &&
      height <= samples[index + 1] &&
      curvature > 0.65 &&
      slope > 0.16
      ? [index * 6]
      : []
  })
}

/** 风吹碎的浪峰只留少量短寿命浮沫。 */
export function addWindFoam(state: SurfaceEffects, x: number, strength: number): SurfaceEffects {
  const mark: SurfaceMark = {
    id: state.nextId,
    x,
    age: 0,
    life: 2.4 + strength * 0.6,
    radius: 7 + strength * 6,
    strength: clamp(strength, 0, 1),
  }
  return { ...state, nextId: state.nextId + 1, foam: [...state.foam, mark].slice(-18) }
}

/** 冲击点与两侧排水共用同一能量预算，泡沫不会铺满整条海面。 */
export function addImpactFoam(
  state: SurfaceEffects,
  x: number,
  shape: ImpactShape,
): SurfaceEffects {
  const marks: readonly SurfaceMark[] = [-1, 0, 1].map(
    (side: number, index: number): SurfaceMark => ({
      id: state.nextId + index,
      x: x + side * shape.width * 0.7,
      age: index * -0.035,
      life: 2 + shape.power * 0.45,
      radius: 7 + shape.power * 5,
      strength: clamp(shape.power * 0.45, 0.12, 1),
    }),
  )
  return { ...state, nextId: state.nextId + 3, foam: [...state.foam, ...marks].slice(-18) }
}

/** 水下尾水稍后抵达表面，留下有限范围的平滑水斑。 */
export function addFlukePrint(state: SurfaceEffects, x: number, strength: number): SurfaceEffects {
  const power: number = clamp(strength, 0.2, 1)
  const mark: SurfaceMark = {
    id: state.nextId,
    x,
    age: -0.28,
    life: 3.6 + power * 0.9,
    radius: 23 + power * 19,
    strength: power,
  }
  return { ...state, nextId: state.nextId + 1, footprints: [...state.footprints, mark].slice(-4) }
}
