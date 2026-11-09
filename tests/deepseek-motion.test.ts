import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createSwimMotion,
  advanceSwimMotion,
  releaseWhale,
  grabWhale,
  tossWhale,
  requestBreach,
  pursuePrey,
  recordFeeding,
  deferAutoBreach,
  swimEffort,
  type Whale,
  type SwimMotion,
} from '../src/lib/deepseek-motion.ts'
import { chooseSolo, soloPose } from '../src/lib/deepseek-solo.ts'
import { waterImpactShape } from '../src/lib/deepseek-water.ts'

test('不同起点在起伏海面持续巡游、鲸跃和回稳，坐标有界且路径连续', () => {
  const actions: Set<string> = new Set<string>()
  for (let k: number = 0; k < 12; k++) {
    const initial: Whale = { x: 45 + k * 22, y: 185, vx: 0, vy: 0, direction: k % 2 ? 1 : -1 }
    let motion: SwimMotion = releaseWhale(createSwimMotion(initial, k + 1), initial)
    const phases: Set<string> = new Set<string>()
    let highest: number = 300
    let deepest: number = 0
    let landings: number = 0
    for (let i: number = 0; i < 60 * 180; i++) {
      const previous: SwimMotion = motion
      motion = advanceSwimMotion(
        motion,
        1 / 60,
        (x: number): number => 146 + 7 * Math.sin(x * 0.026 - i / 60),
      )
      const fish: Whale = motion.whale
      phases.add(motion.phase)
      if (motion.solo.duration > 0) actions.add(motion.solo.action)
      highest = Math.min(highest, fish.y)
      deepest = Math.max(deepest, fish.y)
      if (motion.phase === 'recover' && previous.phase === 'breach') landings++
      assert.ok(Object.values(fish).every(Number.isFinite))
      assert.ok(fish.x > 38 && fish.x < 322 && fish.y > 46 && fish.y < 268)
      assert.ok(Math.hypot(fish.x - previous.whale.x, fish.y - previous.whale.y) < 7)
      assert.ok(Math.hypot(fish.vx - previous.whale.vx, fish.vy - previous.whale.vy) < 24)
    }
    assert.ok(
      phases.has('breach') && phases.has('dive') && phases.has('rise') && phases.has('recover'),
    )
    assert.ok(highest < 115 && deepest > 235)
    assert.ok(landings >= 3)
    assert.deepEqual(initial, { x: 45 + k * 22, y: 185, vx: 0, vy: 0, direction: k % 2 ? 1 : -1 })
  }
  assert.ok(actions.size >= 6)
})

test('暂停和抓取不推进运动，松手保留当前位置和速度', () => {
  const fish: Whale = { x: 180, y: 190, vx: 35, vy: 12, direction: 1 }
  const initial: SwimMotion = createSwimMotion(fish, 527)
  assert.equal(
    advanceSwimMotion(initial, 0, (): number => 146),
    initial,
  )
  const grabbed: SwimMotion = grabWhale(initial, { ...fish, x: 78, y: 210 })
  assert.equal(
    advanceSwimMotion(grabbed, 0.1, (): number => 146),
    grabbed,
  )
  const released: SwimMotion = releaseWhale(grabbed, grabbed.whale)
  assert.deepEqual(released.whale, grabbed.whale)
  const advanced: SwimMotion = advanceSwimMotion(released, 1 / 60, (): number => 146)
  assert.ok(Math.hypot(advanced.whale.x - 78, advanced.whale.y - 210) < 2)
})

test('连续鲸跃请求不重置蓄力，腾空时也不覆盖原始轨迹', () => {
  const fish: Whale = { x: 180, y: 190, vx: 0, vy: 0, direction: 1 }
  let motion: SwimMotion = requestBreach(createSwimMotion(fish, 527))
  assert.equal(requestBreach(motion), motion)
  let jumped: boolean = false
  for (let i: number = 0; i < 300; i++) {
    if (i % 15 === 0) motion = requestBreach(motion)
    motion = advanceSwimMotion(motion, 1 / 60, (): number => 146)
    if (motion.phase === 'breach') {
      jumped = true
      assert.equal(requestBreach(motion), motion)
    }
  }
  assert.ok(jumped)
})

test('甩动方向与力度被保留，边缘投掷的飞行也有界', () => {
  const fish: Whale = { x: 180, y: 135, vx: 0, vy: 0, direction: 1 }
  const motion: SwimMotion = createSwimMotion(fish, 527)
  const left: SwimMotion = tossWhale(motion, { ...fish, vx: -80, vy: -90 })
  const right: SwimMotion = tossWhale(motion, { ...fish, vx: 80, vy: -180 })
  assert.ok(left.whale.vx < 0 && right.whale.vx > 0)
  assert.ok(right.whale.vy < left.whale.vy)
  for (const x of [39, 321]) {
    let thrown: SwimMotion = tossWhale(motion, { ...fish, x, vx: x < 180 ? -500 : 500, vy: -500 })
    for (let i: number = 0; i < 180; i++) {
      thrown = advanceSwimMotion(thrown, 1 / 60, (): number => 146)
      assert.ok(thrown.whale.x >= 38 && thrown.whale.x <= 322 && thrown.whale.y >= 46)
    }
  }
})

test('相同总时间在 20、60、120Hz 下运动一致，不因帧率低而变慢', () => {
  const fish: Whale = { x: 180, y: 190, vx: 0, vy: 0, direction: 1 }
  const poses: Whale[] = [20, 60, 120].map((fps: number): Whale => {
    let motion: SwimMotion = releaseWhale(createSwimMotion(fish, 527), fish)
    for (let i: number = 0; i < fps * 4; i++)
      motion = advanceSwimMotion(motion, 1 / fps, (): number => 146)
    return motion.whale
  })
  for (const pose of poses) assert.ok(Math.hypot(pose.x - poses[0].x, pose.y - poses[0].y) < 0.1)
})

test('鲸跃入水后由浮力与水阻减速，保留下潜惯性，不强制向上回游', () => {
  let motion: SwimMotion = requestBreach(
    createSwimMotion({ x: 180, y: 190, vx: 0, vy: 0, direction: 1 }, 527),
  )
  let maximumDepth: number = 0
  let recoveryStarted: boolean = false
  let recoveryVelocity: number = 0
  for (let i: number = 0; i < 600; i++) {
    motion = advanceSwimMotion(motion, 1 / 60, (): number => 147)
    if (motion.phase === 'recover') {
      recoveryStarted = true
      maximumDepth = Math.max(maximumDepth, motion.whale.y - 147)
      recoveryVelocity = motion.whale.vy
    } else if (recoveryStarted) break
  }
  assert.ok(recoveryStarted)
  assert.ok(maximumDepth > 35 && maximumDepth < 70)
  assert.ok(recoveryVelocity > 0 && recoveryVelocity < 75)
  assert.equal(motion.phase, 'dive')
})

test('鲸跃的空中段短促，猛烈轻甩也不会横跨整张卡片', () => {
  let motion: SwimMotion = requestBreach(
    createSwimMotion({ x: 180, y: 201, vx: 0, vy: 0, direction: 1 }, 527),
  )
  let firstAirX: number | null = null
  let lastAirX: number = 0
  let flightAge: number = 0
  for (let i: number = 0; i < 600; i++) {
    motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
    if (motion.phase === 'breach' && motion.airborne) {
      if (firstAirX === null) firstAirX = motion.whale.x
      lastAirX = motion.whale.x
      flightAge = motion.flightAge
    } else if (firstAirX !== null) break
  }
  assert.notEqual(firstAirX, null)
  assert.ok(Math.abs(lastAirX - firstAirX!) < 40 && flightAge < 1.1)
  for (const y of [67, 100, 135]) {
    const fish: Whale = { x: 180, y, vx: 900, vy: -900, direction: 1 }
    let thrown: SwimMotion = tossWhale(createSwimMotion(fish, 527), fish)
    for (let i: number = 0; i < 300 && thrown.phase === 'breach'; i++) {
      thrown = advanceSwimMotion(thrown, 1 / 120, (): number => 147)
      assert.ok(Math.abs(thrown.whale.x - 180) <= 29)
    }
  }
})

test('接近固定猎物时减速停稳，左右边缘均不反复切换朝向', () => {
  for (const [x, target] of [
    [39, 51],
    [321, 309],
    [180, 205],
  ]) {
    let motion: SwimMotion = pursuePrey(
      createSwimMotion({ x, y: 210, vx: 0, vy: 0, direction: target > x ? 1 : -1 }, 527),
      [target, 210],
    )
    let turns: number = 0
    const latePositions: number[] = []
    for (let frame: number = 0; frame < 600; frame++) {
      const direction: number = motion.whale.direction
      motion = advanceSwimMotion(motion, 1 / 60, (): number => 147)
      if (motion.whale.direction !== direction) turns++
      if (frame > 300) latePositions.push(motion.whale.x)
    }
    assert.ok(turns <= 2)
    assert.ok(Math.max(...latePositions) - Math.min(...latePositions) < 0.5)
    assert.ok(Math.abs(motion.whale.vx) < 1)
  }
})

test('鲸跃保留水下蓄力和逐步加速上冲，完全离水后才进入弹道段', () => {
  let motion: SwimMotion = requestBreach(
    createSwimMotion({ x: 180, y: 225, vx: 0, vy: 0, direction: 1 }, 527),
  )
  const poweredVelocities: number[] = []
  let gatherTime: number = 0
  let leftWater: boolean = false
  for (let frame: number = 0; frame < 360; frame++) {
    motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
    if (motion.phase === 'gather') gatherTime = motion.age
    if (motion.phase === 'breach' && !motion.airborne) poweredVelocities.push(motion.whale.vy)
    if (motion.phase === 'breach' && motion.airborne) {
      leftWater = true
      break
    }
  }
  assert.ok(gatherTime > 0.6 && poweredVelocities.length > 12 && leftWater)
  assert.ok(poweredVelocities.at(-1)! < poweredVelocities[0] - 60)
})

test('捕食先加速穿过猎物，吞食后逐步减速并继续向前滑行', () => {
  let motion: SwimMotion = pursuePrey(
    createSwimMotion({ x: 120, y: 210, vx: 45, vy: 0, direction: 1 }, 527),
    [180, 210],
  )
  let accelerated: boolean = false
  for (let frame: number = 0; frame < 240; frame++) {
    motion = pursuePrey(motion, [180 + (frame / 120) * 12, 210])
    motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
    if (motion.phase === 'lunge' && motion.whale.vx > 120) {
      accelerated = true
      break
    }
  }
  assert.ok(accelerated)
  const before = motion.whale
  motion = recordFeeding(motion)
  assert.deepEqual(motion.whale, before)
  for (let frame: number = 0; frame < 48; frame++)
    motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
  assert.equal(motion.phase, 'feed')
  assert.ok(motion.whale.x > before.x + 12)
  assert.ok(motion.whale.vx > 20 && motion.whale.vx < before.vx * 0.65)
})

test('同一口连续捕到多个个体不延长恢复，吞食期间仍更新下一条攻击目标', () => {
  const fish: Whale = { x: 160, y: 210, vx: 120, vy: 0, direction: 1 }
  let motion: SwimMotion = recordFeeding({
    ...createSwimMotion(fish, 527),
    phase: 'lunge',
    nextLungeAt: 2,
  })
  const until: number = motion.feedingUntil
  for (let bite: number = 0; bite < 6; bite++) {
    motion = advanceSwimMotion(motion, 0.05, (): number => 147)
    motion = recordFeeding(motion)
    motion = pursuePrey(motion, [245, 215])
    assert.equal(motion.feedingUntil, until)
    assert.deepEqual(motion.target, [245, 215])
  }
  for (let frame: number = 0; frame < 24; frame++)
    motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
  assert.equal(motion.phase, 'hunt')
  assert.ok(motion.whale.vx > 20 && motion.nextLungeAt <= 0.75)
})

test('上浮换气阶段先有力摆尾，到位后减弱推进，不要求持续猛烈摆动', () => {
  const fish: Whale = { x: 180, y: 225, vx: 25, vy: -20, direction: 1 }
  const base: SwimMotion = {
    ...createSwimMotion(fish, 527),
    phase: 'rise',
    target: [240, 175],
    clock: 2,
    solo: { action: 'surface', startedAt: 0, duration: 6, origin: [180, 225], direction: 1 },
  }
  const ascending: number = swimEffort(base)
  const arrived: number = swimEffort({ ...base, whale: { ...fish, y: 177, vy: 0 } })
  assert.ok(ascending > 0.6 && arrived < ascending && arrived > 0.1)
})

test('换气、露背滑行和俯头下潜构成同一航段，结束后顺势深潜而非切回浅游', () => {
  const fish: Whale = { x: 180, y: 200, vx: 28, vy: 0, direction: 1 }
  let motion: SwimMotion = {
    ...releaseWhale(createSwimMotion(fish, 527), fish),
    phase: 'cruise',
    nextBreach: 100,
    nextSoloAt: 100,
    solo: { action: 'surface', startedAt: 0, duration: 4, origin: [180, 200], direction: 1 },
  }
  assert.equal(soloPose(motion.solo, 0).surface, 0)
  assert.equal(soloPose(motion.solo, 4).surface, 0)
  assert.ok(soloPose(motion.solo, 3.3).pitch < -15)
  for (let frame: number = 0; frame < 500; frame++) {
    const previous: Whale = motion.whale
    motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
    assert.ok(Math.hypot(motion.whale.x - previous.x, motion.whale.y - previous.y) < 3)
  }
  assert.equal(motion.phase, 'dive')
  assert.equal(motion.solo.duration, 0)
})

test('先下潜再鲸跃，更高起跳产生更强且更持久的入水余波，空中只受重力', () => {
  const impacts: { height: number; radius: number; life: number }[] = []
  for (const launchSpeed of [190, 280]) {
    let motion: SwimMotion = requestBreach(
      createSwimMotion({ x: 180, y: 200, vx: 0, vy: 0, direction: 1 }, 527),
    )
    motion = { ...motion, launchSpeed }
    let height: number = 300
    let preparationDepth: number = 0
    for (let i: number = 0; i < 1200; i++) {
      const previous: SwimMotion = motion
      motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
      if (motion.phase === 'prepare') preparationDepth = Math.max(preparationDepth, motion.whale.y)
      if (previous.airborne && motion.phase === 'breach')
        assert.ok(Math.abs(motion.whale.vy - previous.whale.vy - 510 / 120) < 0.0001)
      height = Math.min(height, motion.whale.y)
      if (motion.impact !== null) {
        const shape = waterImpactShape(motion.impact.speed, motion.impact.area)
        impacts.push({ height, radius: shape.radius, life: shape.life })
        break
      }
    }
    assert.ok(preparationDepth > 224)
  }
  assert.equal(impacts.length, 2)
  assert.ok(impacts[1].height < impacts[0].height - 20)
  assert.ok(impacts[1].radius > impacts[0].radius && impacts[1].life > impacts[0].life)
})

test('浮休按呼吸节奏进出，追逐与手动鲸跃接管时保留位置和速度', () => {
  const fish: Whale = { x: 180, y: 178, vx: 7, vy: 0, direction: 1 }
  const resting: SwimMotion = {
    ...releaseWhale(createSwimMotion(fish, 527), fish),
    clock: 4,
    solo: { action: 'rest', startedAt: 0, duration: 8, origin: [180, 190], direction: 1 },
  }
  assert.equal(soloPose(resting.solo, 0).rest, 0)
  assert.equal(soloPose(resting.solo, 4).rest, 1)
  assert.equal(soloPose(resting.solo, 8).rest, 0)
  for (const interrupted of [pursuePrey(resting, [240, 210]), requestBreach(resting)]) {
    assert.deepEqual(interrupted.whale, resting.whale)
    const advanced: SwimMotion = advanceSwimMotion(interrupted, 1 / 120, (): number => 147)
    assert.ok(Math.hypot(advanced.whale.x - fish.x, advanced.whale.y - fish.y) < 1)
  }
})

test('动作按水深与动量选择，水下不能从静止滑行，浮休必须先到达水面', () => {
  const actions: Set<string> = new Set<string>()
  for (let seed: number = 1; seed <= 300; seed++) {
    const fish: Whale = { x: 180, y: 185, vx: 36, vy: 0, direction: 1 }
    const [shallow] = chooseSolo(fish, 0, seed, 'swim', 147)
    actions.add(shallow.action)
    const [deep] = chooseSolo({ ...fish, y: 245, vx: 0 }, 0, seed, 'swim', 147)
    assert.ok(!['rest', 'spyhop', 'tailSlap', 'glide'].includes(deep.action))
  }
  assert.equal(actions.size, 8)
  const fish: Whale = { x: 180, y: 205, vx: 32, vy: 0, direction: 1 }
  let motion: SwimMotion = {
    ...releaseWhale(createSwimMotion(fish, 527), fish),
    nextBreach: 100,
    solo: { action: 'rest', startedAt: 0, duration: 6, origin: [180, 205], direction: 1 },
  }
  let surfaced: boolean = false
  for (let frame: number = 0; frame < 600; frame++) {
    motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
    if (motion.whale.y < 171) surfaced = true
    if (motion.whale.y > 175 && motion.clock < 2.5) assert.ok(motion.whale.vx > 15)
  }
  assert.ok(surfaced)
})

test('猎物刚入场尚不可追踪时，也要退出独处动作和自动蓄力，保留当前动量', () => {
  const fish: Whale = { x: 270, y: 180, vx: -24, vy: 4, direction: -1 }
  const base: SwimMotion = releaseWhale(createSwimMotion(fish, 527), fish)
  for (const action of [
    'rest',
    'glide',
    'dash',
    'surface',
    'sound',
    'spyhop',
    'roll',
    'tailSlap',
  ] as const) {
    const motion: SwimMotion = {
      ...base,
      solo: { action, startedAt: 0, duration: 5, origin: [270, 180], direction: -1 },
    }
    const interrupted: SwimMotion = deferAutoBreach(motion)
    assert.equal(interrupted.solo.duration, 0)
    assert.deepEqual(interrupted.whale, motion.whale)
    assert.ok(interrupted.nextBreach >= interrupted.clock + 4)
  }
  for (const phase of ['prepare', 'gather'] as const) {
    for (const breachIntent of ['auto', 'manual'] as const) {
      const motion: SwimMotion = { ...base, phase, breachIntent }
      assert.equal(deferAutoBreach(motion).phase, 'cruise')
    }
  }
})

test('八种独处动作在两侧完整进入、执行和退出，接回巡游时坐标与速度连续', () => {
  for (const action of [
    'glide',
    'dash',
    'surface',
    'sound',
    'spyhop',
    'roll',
    'tailSlap',
    'rest',
  ] as const) {
    for (const direction of [-1, 1]) {
      const fish: Whale = {
        x: direction > 0 ? 70 : 290,
        y: 190,
        vx: direction * 32,
        vy: 0,
        direction,
      }
      let motion: SwimMotion = {
        ...releaseWhale(createSwimMotion(fish, 527), fish),
        phase: 'cruise',
        nextBreach: 100,
        nextSoloAt: 100,
        solo: {
          action,
          startedAt: 0,
          duration: action === 'glide' ? 2 : action === 'rest' ? 6 : 4,
          origin: [fish.x, fish.y],
          direction,
        },
      }
      let completed: boolean = false
      for (let frame: number = 0; frame < 1440; frame++) {
        const previous: Whale = motion.whale
        motion = advanceSwimMotion(
          motion,
          1 / 120,
          (x: number): number => 147 + Math.sin(x * 0.02 - frame / 120) * 7,
        )
        if (motion.solo.duration === 0 && motion.clock > 0.5) completed = true
        assert.ok(
          motion.whale.x > 38 &&
            motion.whale.x < 322 &&
            motion.whale.y > 46 &&
            motion.whale.y < 268,
          action,
        )
        assert.ok(Math.hypot(motion.whale.x - previous.x, motion.whale.y - previous.y) < 3, action)
        assert.ok(
          Math.hypot(motion.whale.vx - previous.vx, motion.whale.vy - previous.vy) < 15,
          action,
        )
      }
      assert.ok(completed, action)
      assert.ok(['dive', 'rise', 'cruise'].includes(motion.phase), action)
    }
  }
})

test('左右均能建立捕食冲刺，鲸跃准备期保持同一个发射方向', () => {
  for (const direction of [-1, 1]) {
    const fish: Whale = { x: 180, y: 210, vx: direction * 45, vy: 0, direction }
    let motion: SwimMotion = pursuePrey(createSwimMotion(fish, 527), [180 + direction * 60, 210])
    let peak: number = 0
    for (let i: number = 0; i < 90; i++) {
      motion = pursuePrey(motion, [180 + direction * 60, 210])
      motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
      if (motion.phase === 'lunge') peak = Math.max(peak, Math.abs(motion.whale.vx))
    }
    assert.ok(peak > 120)
    motion = requestBreach({ ...motion, phase: 'cruise' })
    const heading: number = motion.launchDirection
    for (let i: number = 0; i < 480; i++) {
      motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
      if (motion.airborne) break
      assert.equal(motion.launchDirection, heading)
      assert.equal(motion.whale.direction, heading)
    }
  }
})

test('猎物在身后时沿有厚度的弧线掉头，保持前进而非原地刹停倒车', () => {
  for (const direction of [-1, 1]) {
    const initial: Whale = {
      x: direction > 0 ? 220 : 140,
      y: 210,
      vx: direction * 65,
      vy: 0,
      direction,
    }
    const target: readonly [number, number] = [180 - direction * 60, 210]
    let motion: SwimMotion = pursuePrey(createSwimMotion(initial, 527), target)
    let deepest: number = 0
    let turned: boolean = false
    for (let i: number = 0; i < 240; i++) {
      motion = pursuePrey(motion, target)
      motion = advanceSwimMotion(motion, 1 / 120, (): number => 147)
      deepest = Math.max(deepest, motion.whale.y)
      if (motion.turnSide !== 0) assert.ok(Math.hypot(motion.whale.vx, motion.whale.vy) > 25)
      if (motion.whale.vx * direction < -20) turned = true
      assert.ok(motion.whale.x > 38 && motion.whale.x < 322)
      assert.ok(motion.whale.y > 171 && motion.whale.y < 253)
    }
    assert.ok(turned && deepest > 230)
  }
})
