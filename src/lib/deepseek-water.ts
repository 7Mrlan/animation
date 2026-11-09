/** 舞台坐标约束，供水面和输入共用。 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/** 流速使用舞台单位/秒；所有水下对象共享同一世界时钟。 */
export type WaterCurrent = Readonly<{
  /** 缓慢变化的主流，远弱于主动游动。 */
  x: number
  /** 随深度衰减的小幅垂直分量。 */
  y: number
}>

/** 流场不逐帧抽随机数，避免小动物、气泡和浮沫突然各自反向。 */
export function oceanCurrent(x: number, y: number, time: number): WaterCurrent {
  const depth: number = Math.max(0, y - 145)
  return {
    x:
      (3.6 + Math.sin(time * 0.065) * 1.4) * (0.75 + 0.25 * Math.exp(-depth / 100)) +
      Math.sin(x * 0.012 + time * 0.04) * 0.4,
    y: Math.sin(x * 0.016 + time * 0.075) * 0.55 * Math.exp(-depth / 120),
  }
}

/** 局部扰动与环境涌浪分离，暂停和回归测试可独立保存能量快照。 */
export type Water = Readonly<{
  /** 以 6 个舞台单位采样的相对水位。 */
  heights: Float64Array
  /** 采样点的垂直速度，端点具有吸收阻尼。 */
  velocities: Float64Array
}>

/** 61 个弹簧节点足以覆盖小卡片，避免按像素计算流体。 */
export function createWater(): Water {
  return { heights: new Float64Array(61), velocities: new Float64Array(61) }
}

/** 平滑增强后再消退的阵风，不使用每帧随机强度。 */
export function windGust(time: number): number {
  return Math.pow(Math.max(0, Math.sin(time * 0.43 - 0.7)), 4)
}

/** 长涌浪、短风浪和阵风浪群共同构成背景海面，无随机噪声跳变。 */
export function oceanHeight(x: number, time: number): number {
  const swell: number = x * 0.022 - time * 1.12
  const group: number = 0.76 + 0.24 * Math.sin(x * 0.009 - time * 0.31)
  const gust: number = windGust(time)
  return (
    147 +
    (Math.sin(swell) + 0.2 * Math.sin(swell * 2 + 0.5)) * 10.5 * group * (0.85 + gust * 0.35) +
    oceanRipples(x, time)
  )
}

/** 水印只削弱短风纹，不抹平长涌浪或鲸跃产生的传播波。 */
export function oceanRipples(x: number, time: number): number {
  return (
    Math.sin(x * 0.047 + time * 1.74 + 1.8) * 4.3 +
    Math.sin(x * 0.091 - time * 2.42 + 0.7) * (1.8 + windGust(time) * 1.5)
  )
}

/** 返回新的冲击快照，保留输入；有限能量约束连续猛拖造成的累积。 */
export function disturbWater(water: Water, x: number, strength: number): Water {
  const velocities: Float64Array = water.velocities.map((v: number, i: number): number =>
    clamp(v + strength * Math.exp(-Math.pow((i * 6 - x) / 16, 2)), -280, 280),
  )
  return { heights: water.heights.slice(), velocities }
}

/** 同一冲击预算约束水面、水冠和余波。 */
export type ImpactShape = Readonly<{
  /** 水冠和粒子的相对强度。 */
  power: number
  /** 冲击宽度随动量增大。 */
  width: number
  /** 扩散水纹的可见范围。 */
  radius: number
  /** 较大冲击留下更长余波。 */
  life: number
  /** 传给水面节点的速度冲量。 */
  impulse: number
}>

/** 入水能量按法向速度平方增长，软限幅仍保留高低鲸跃的差别。 */
export function waterImpactShape(speed: number, area: number): ImpactShape {
  const energy: number = Math.max(0, area) * Math.pow(Math.max(0, speed) / 170, 2)
  const power: number = 3.2 * (1 - Math.exp(-energy / 1.6))
  return {
    power,
    width: 12 + power * 7,
    radius: 30 + power * 34,
    life: 1.3 + power * 0.8,
    impulse: 55 + power * 85,
  }
}

/** 中央下压、两侧抬升近似守恒排水，冲击宽度和幅度共同变化。 */
export function strikeWater(water: Water, x: number, speed: number, area: number): Water {
  const impact: ImpactShape = waterImpactShape(speed, area)
  const velocities: Float64Array = water.velocities.map(
    (velocity: number, index: number): number => {
      const delta: number = (index * 6 - x) / impact.width
      const kernel: number =
        Math.exp(-delta * delta) -
        0.5 * Math.exp(-Math.pow(delta - 1.55, 2)) -
        0.5 * Math.exp(-Math.pow(delta + 1.55, 2))
      return clamp(velocity + impact.impulse * kernel, -340, 340)
    },
  )
  return { heights: water.heights.slice(), velocities }
}

/** 子步传播局部浪；边缘吸收能量，避免像封闭水箱持续反射。 */
export function advanceWater(water: Water, delta: number): Water {
  if (delta <= 0) return water
  const heights: Float64Array = water.heights.slice()
  const velocities: Float64Array = water.velocities.slice()
  const steps: number = Math.max(1, Math.ceil(Math.min(delta, 0.1) / 0.008))
  const dt: number = Math.min(delta, 0.1) / steps
  for (let step: number = 0; step < steps; step++) {
    for (let i: number = 0; i < heights.length; i++) {
      const left: number = heights[Math.max(0, i - 1)]
      const right: number = heights[Math.min(heights.length - 1, i + 1)]
      const edge: number = Math.max(0, 5 - Math.min(i, heights.length - 1 - i))
      velocities[i] +=
        (195 * (left + right - 2 * heights[i]) -
          10 * heights[i] -
          (2.1 + edge * 1.8) * velocities[i]) *
        dt
    }
    for (let i: number = 0; i < heights.length; i++)
      heights[i] = clamp(heights[i] + velocities[i] * dt, -32, 32)
  }
  return { heights, velocities }
}

/** 连续横坐标插值；拖出舞台时读取边界，不产生 NaN。 */
export function sampleWater(water: Water, x: number): number {
  const n: number = clamp(x / 6, 0, water.heights.length - 1)
  const i: number = Math.floor(n)
  const t: number = n - i
  return water.heights[i] * (1 - t) + water.heights[Math.min(i + 1, water.heights.length - 1)] * t
}

/** 小动作不喷溅；更快的水面拖动产生更强但有上限的反馈。 */
export function surfaceSplashPower(depth: number, speed: number): number {
  return Math.abs(depth) < 27 && speed > 48 ? clamp((speed - 40) / 190, 0.12, 2.4) : 0
}
