import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPreyScene,
  advancePreyScene,
  findPreyTarget,
  type Prey,
  type PreyScene,
  getPreyPose,
  trackPreyTarget,
} from '../src/lib/deepseek-prey.ts'
import {
  createSwimMotion,
  advanceSwimMotion,
  pursuePrey,
  finishPursuit,
  recordFeeding,
  deferAutoBreach,
  type SwimMotion,
  type Whale,
} from '../src/lib/deepseek-motion.ts'

/** 固定单个个体隔离逃逸、接触和退出契约，不伪造浏览器或计时器。 */
function encounterAt(x: number, y: number): PreyScene {
  const animal: Prey = {
    id: 1,
    kind: 'fish',
    x,
    y,
    vx: 36,
    vy: 0,
    size: 1,
    phase: 0,
    heading: 0,
    escapeUntil: 0,
    escapeReadyAt: 0,
    alarm: 0,
    pace: 'cruise',
    entered: true,
    caughtAt: null,
  }
  return {
    ...createPreyScene(527),
    clock: 1,
    nextAt: 100,
    expiresAt: 10,
    animals: [animal],
    course: {
      depth: y,
      amplitude: 16,
      wavelength: 380,
      phase: 0,
      heading: 0,
      avoidanceSide: -1,
      travelDirection: 1,
      maneuver: 'cruise',
      maneuverUntil: 0,
      nextDecisionAt: 1,
    },
  }
}

/** 同一群体的确定性位置用于验证形变、转向和回并，不依赖随机截图。 */
function schoolingAt(points: readonly (readonly [number, number])[]): PreyScene {
  const base: PreyScene = encounterAt(120, 211)
  return {
    ...base,
    expiresAt: 30,
    animals: points.map(([x, y], id: number): Prey => ({
      ...base.animals[0],
      id,
      x,
      y,
      vx: 52,
      phase: id * 1.3,
    })),
  }
}

/** 群体离散度允许整体迁移，避免将平移误判为散开。 */
function schoolRadius(scene: PreyScene): number {
  assert.ok(scene.animals.length > 0)
  const x: number =
    scene.animals.reduce((sum: number, p: Prey): number => sum + p.x, 0) / scene.animals.length
  const y: number =
    scene.animals.reduce((sum: number, p: Prey): number => sum + p.y, 0) / scene.animals.length
  return Math.sqrt(
    scene.animals.reduce(
      (sum: number, p: Prey): number => sum + (p.x - x) ** 2 + (p.y - y) ** 2,
      0,
    ) / scene.animals.length,
  )
}

test('鲱鱼沿宽弧集体转向，散开的个体调整队形后重新聚合', () => {
  let scene: PreyScene = schoolingAt(
    Array.from({ length: 12 }, (_p: unknown, i: number): readonly [number, number] => [
      100 + (i % 4) * 12 + (i % 2 ? 25 : -25),
      200 + Math.floor(i / 4) * 11 + (i % 3 ? 20 : -20),
    ]),
  )
  const before: number = schoolRadius(scene)
  const centers: number[] = []
  for (let frame: number = 0; frame < 180; frame++) {
    scene = advancePreyScene(scene, 1 / 60, null)
    centers.push(
      scene.animals.reduce((sum: number, p: Prey): number => sum + p.y, 0) / scene.animals.length,
    )
  }
  const alignment: number =
    Math.hypot(
      scene.animals.reduce(
        (sum: number, p: Prey): number => sum + p.vx / Math.hypot(p.vx, p.vy),
        0,
      ),
      scene.animals.reduce(
        (sum: number, p: Prey): number => sum + p.vy / Math.hypot(p.vx, p.vy),
        0,
      ),
    ) / scene.animals.length
  assert.ok(schoolRadius(scene) < before * 0.75)
  assert.ok(Math.max(...centers) - Math.min(...centers) > 8 && alignment > 0.95)
})

test('鲱鱼受惊后加速与短冲刺，威胁消失后逐渐恢复巡游', () => {
  let scene: PreyScene = encounterAt(170, 210)
  const paces: Set<Prey['pace']> = new Set<Prey['pace']>()
  let peak: number = 0
  for (let frame: number = 0; frame < 180; frame++) {
    scene = advancePreyScene(
      scene,
      1 / 60,
      frame < 42 ? { x: 130 + (frame / 60) * 55, y: 210, vx: 55, vy: 0, direction: 1 } : null,
    )
    assert.ok(scene.animals.length > 0)
    const fish: Prey = scene.animals[0]
    paces.add(fish.pace)
    peak = Math.max(peak, Math.hypot(fish.vx, fish.vy))
  }
  assert.ok(peak > 84 && peak < 115)
  assert.ok(paces.has('accelerate') && paces.has('burst') && paces.has('recover'))
  assert.equal(scene.animals[0].pace, 'cruise')
  assert.ok(Math.hypot(scene.animals[0].vx, scene.animals[0].vy) < 65)
})

test('鱼和磷虾根据威胁方位改变深度，前方被堵时回身或换层绕行，轨迹不跳位', () => {
  for (const kind of ['fish', 'shrimp'] as const) {
    for (const [depth, predatorY] of [
      [200, 150],
      [230, 268],
      [210, 210],
    ]) {
      const base: PreyScene = schoolingAt(
        Array.from({ length: 12 }, (_value: unknown, i: number): readonly [number, number] => [
          160 + (i % 4) * 9,
          depth + Math.floor(i / 4) * 5,
        ]),
      )
      let scene: PreyScene = {
        ...base,
        animals: base.animals.map((animal: Prey): Prey => ({
          ...animal,
          kind,
          vx: kind === 'fish' ? 52 : 27,
          alarm: 0.8,
        })),
      }
      const firstY: number = scene.animals.reduce(
        (sum: number, animal: Prey): number => sum + animal.y / 12,
        0,
      )
      let minimum: number = firstY
      let maximum: number = firstY
      let reversed: boolean = false
      for (let frame: number = 0; frame < 120; frame++) {
        const previous: PreyScene = scene
        scene = advancePreyScene(scene, 1 / 60, {
          x: predatorY === 210 ? 225 : 180,
          y: predatorY,
          vx: 0,
          vy: 0,
          direction: -1,
        })
        const centerY: number = scene.animals.reduce(
          (sum: number, animal: Prey): number => sum + animal.y / scene.animals.length,
          0,
        )
        minimum = Math.min(minimum, centerY)
        maximum = Math.max(maximum, centerY)
        for (const animal of scene.animals) {
          const before: Prey | undefined = previous.animals.find(
            (other: Prey): boolean => other.id === animal.id,
          )
          assert.ok(
            before !== undefined && Math.hypot(animal.x - before.x, animal.y - before.y) < 3,
          )
          if (animal.vx < -12) reversed = true
        }
      }
      if (predatorY === 150) assert.ok(maximum > firstY + 20)
      else if (predatorY === 268) assert.ok(minimum < firstY - 20)
      else
        assert.ok(
          reversed || maximum > firstY + 20 || minimum < firstY - 20,
          `${kind} must reverse or bypass the obstacle vertically`,
        )
    }
  }
})

test('鲸鱼选择目标考虑转向代价，预测截击也跟随猎物的垂直速度', () => {
  const whale: Whale = { x: 180, y: 210, vx: 50, vy: 0, direction: 1 }
  const base: PreyScene = schoolingAt([
    [150, 210],
    [215, 210],
  ])
  const tracked: PreyScene = trackPreyTarget(base, whale)
  assert.equal(tracked.targetId, 1)
  for (const vy of [-30, 30]) {
    const scene: PreyScene = {
      ...tracked,
      animals: tracked.animals.map((animal: Prey): Prey => ({ ...animal, vy })),
    }
    const target: readonly [number, number] | null = findPreyTarget(scene, whale)
    assert.ok(target !== null && (target[1] - 210) * vy > 0)
  }
})

test('向下逃出视野的猎物自然清理，仍在卡片内的个体不按时限消失', () => {
  for (const kind of ['fish', 'shrimp'] as const) {
    const base: PreyScene = encounterAt(180, 210)
    const outside: PreyScene = { ...base, animals: [{ ...base.animals[0], kind, y: 334, vy: 100 }] }
    const exited: PreyScene = advancePreyScene(outside, 1 / 30, null)
    assert.equal(exited.animals.length, 0)
    assert.ok(exited.nextAt >= exited.clock + 17)
    const inside: PreyScene = advancePreyScene(
      { ...outside, expiresAt: 0, animals: [{ ...outside.animals[0], y: 260 }] },
      1 / 30,
      null,
    )
    assert.equal(inside.animals.length, 1)
    assert.equal(findPreyTarget(outside, { x: 180, y: 240, vx: 0, vy: 0, direction: 1 }), null)
  }
})

test('鲸鱼堵在鱼群前方时允许回身绕行，规避选择不会逐帧来回切换', () => {
  let scene: PreyScene = schoolingAt(
    Array.from({ length: 12 }, (_p: unknown, i: number): readonly [number, number] => [
      144 + (i % 4) * 12,
      200 + Math.floor(i / 4) * 11,
    ]),
  )
  scene = { ...scene, animals: scene.animals.map((p: Prey): Prey => ({ ...p, alarm: 0.8 })) }
  let reversals: number = 0
  for (let frame: number = 0; frame < 150; frame++) {
    const previous: number = scene.course!.travelDirection
    scene = advancePreyScene(scene, 1 / 60, { x: 240, y: 215, vx: 0, vy: 0, direction: -1 })
    if (scene.course!.travelDirection !== previous) reversals++
  }
  assert.equal(scene.course!.travelDirection, -1)
  assert.equal(reversals, 1)
  assert.ok(scene.animals.reduce((sum: number, p: Prey): number => sum + p.vx, 0) < 0)
})

test('目标锁定忽略相邻个体的小幅交错，目标被吃或离开后才重新选择', () => {
  const base: PreyScene = schoolingAt([
    [130, 210],
    [131, 210],
  ])
  const whale: Whale = { x: 100, y: 210, vx: 0, vy: 0, direction: 1 }
  let scene: PreyScene = trackPreyTarget(base, whale)
  const locked: number | null = scene.targetId
  for (let frame: number = 0; frame < 120; frame++) {
    scene = trackPreyTarget(
      {
        ...scene,
        clock: scene.clock + 1 / 60,
        animals: base.animals.map((p: Prey, i: number): Prey => ({
          ...p,
          x: 130 + Math.sin(frame * 0.4 + i * Math.PI) * 2,
        })),
      },
      whale,
    )
    assert.equal(scene.targetId, locked)
  }
  scene = trackPreyTarget(
    {
      ...scene,
      animals: scene.animals.map((p: Prey): Prey =>
        p.id === locked ? { ...p, caughtAt: scene.clock } : p,
      ),
    },
    whale,
  )
  assert.notEqual(scene.targetId, locked)
})

test('鲸鱼位于左右入口时，鱼群先连续入场，不追逐出生点外的目标', () => {
  for (const direction of [1, -1]) {
    const initial: PreyScene = schoolingAt(
      Array.from({ length: 10 }, (_p: unknown, i: number): readonly [number, number] => [
        direction === 1 ? -90 + i * 9 : 450 - i * 9,
        208 + (i % 3) * 7,
      ]),
    )
    let scene: PreyScene = {
      ...initial,
      direction,
      course: {
        ...initial.course!,
        heading: direction === 1 ? 0 : Math.PI,
        travelDirection: direction,
      },
      animals: initial.animals.map((p: Prey): Prey => ({
        ...p,
        entered: false,
        vx: direction * 40,
        heading: direction === 1 ? 0 : Math.PI,
      })),
    }
    const whale: Whale = { x: direction === 1 ? 39 : 321, y: 210, vx: 0, vy: 0, direction }
    assert.equal(findPreyTarget(scene, whale), null)
    for (let frame: number = 0; frame < 150; frame++) {
      const before: PreyScene = scene
      scene = advancePreyScene(scene, 1 / 60, whale)
      for (const fish of scene.animals) {
        const previous: Prey | undefined = before.animals.find(
          (p: Prey): boolean => p.id === fish.id,
        )
        if (previous !== undefined && !previous.entered)
          assert.ok((fish.x - previous.x) * direction >= 0)
      }
    }
    assert.ok(scene.animals.some((p: Prey): boolean => p.entered))
  }
})

test('入口附近的鲸鱼会让鱼虾提前改变深度，尚未入场时也不反复左右弹动', () => {
  for (const kind of ['fish', 'shrimp'] as const) {
    for (const direction of [-1, 1]) {
      const base: PreyScene = schoolingAt([[180, 210]])
      let scene: PreyScene = {
        ...base,
        direction,
        course: {
          ...base.course!,
          heading: direction > 0 ? 0 : Math.PI,
          travelDirection: direction,
        },
        animals: [
          {
            ...base.animals[0],
            kind,
            x: direction > 0 ? -25 : 385,
            entered: false,
            vx: direction * (kind === 'fish' ? 50 : 27),
          },
        ],
      }
      let veered: boolean = false
      for (let frame: number = 0; frame < 90 && !scene.animals[0]?.entered; frame++) {
        scene = advancePreyScene(scene, 1 / 60, {
          x: direction > 0 ? 39 : 321,
          y: 210,
          vx: 0,
          vy: 0,
          direction,
        })
        const animal: Prey = scene.animals[0]
        assert.ok(animal.vx * direction > 0)
        if (Math.abs(animal.y - 210) > 8) veered = true
      }
      assert.ok(veered, kind)
    }
  }
})

test('种子可复现，但不同种子产生不同时间、种类、数量、深度和方向', () => {
  const signatures: Set<string> = new Set<string>()
  const counts: Set<number> = new Set<number>()
  const kinds: Set<string> = new Set<string>()
  const sides: Set<number> = new Set<number>()
  for (let seed: number = 1; seed <= 40; seed++) {
    let scene: PreyScene = createPreyScene(seed * 38471)
    while (scene.animals.length === 0) scene = advancePreyScene(scene, 0.1, null)
    counts.add(scene.animals.length)
    kinds.add(scene.animals[0].kind)
    sides.add(scene.direction)
    signatures.add(JSON.stringify([scene.clock, scene.animals]))
    assert.ok(
      scene.animals[0].kind === 'fish'
        ? scene.animals.length >= 20 && scene.animals.length <= 36
        : scene.animals.length >= 7 && scene.animals.length <= 17,
    )
  }
  assert.equal(signatures.size, 40)
  assert.ok(counts.size >= 8 && kinds.size === 2 && sides.size === 2)
  assert.deepEqual(
    advancePreyScene(encounterAt(120, 210), 0.1, null),
    advancePreyScene(encounterAt(120, 210), 0.1, null),
  )
})

test('暂停不推进遭遇，更新保持旧快照完整', () => {
  const scene: PreyScene = encounterAt(120, 210)
  const before: string = JSON.stringify(scene)
  assert.equal(advancePreyScene(scene, 0, null), scene)
  advancePreyScene(scene, 0.1, null)
  assert.equal(JSON.stringify(scene), before)
})

test('超过迁移时间仍在画面内的猎物继续游动，只有游出边缘才自然清理', () => {
  const overdue: PreyScene = { ...encounterAt(180, 210), clock: 20 }
  const moved: PreyScene = advancePreyScene(overdue, 0.1, null)
  assert.equal(moved.animals.length, 1)
  assert.ok(moved.animals[0].x > 180 && moved.animals[0].x < 190)
  assert.notEqual(findPreyTarget(moved, { x: 130, y: 210, vx: 0, vy: 0, direction: 1 }), null)
  assert.equal(advancePreyScene(encounterAt(506, 210), 0.1, null).animals.length, 0)
})

test('猎物接近鲸鱼会加速逃逸，只有嘴部实际接触才计入捕食', () => {
  const whale: Whale = { x: 130, y: 210, vx: 0, vy: 0, direction: 1 }
  const calm: PreyScene = advancePreyScene(encounterAt(170, 210), 0.1, null)
  const fleeing: PreyScene = advancePreyScene(encounterAt(170, 210), 0.1, whale)
  assert.ok(
    Math.hypot(fleeing.animals[0].vx, fleeing.animals[0].vy) >
      Math.hypot(calm.animals[0].vx, calm.animals[0].vy),
  )
  assert.equal(fleeing.consumed, 0)
  const caught: PreyScene = advancePreyScene(encounterAt(148, 210), 1 / 60, whale)
  assert.equal(caught.consumed, 1)
  assert.notEqual(caught.animals[0].caughtAt, null)
})

test('迎面游来的鱼优先绕开静止嘴部，群体航向不能把它持续送入嘴里', () => {
  for (const direction of [-1, 1]) {
    const whale: Whale = { x: 180, y: 210, vx: 0, vy: 0, direction }
    const base: PreyScene = encounterAt(180 + direction * 78, 210)
    let scene: PreyScene = {
      ...base,
      direction: -direction,
      course: {
        ...base.course!,
        heading: direction > 0 ? Math.PI : 0,
        travelDirection: -direction,
      },
      animals: [{ ...base.animals[0], vx: -direction * 52, heading: direction > 0 ? Math.PI : 0 }],
    }
    for (let frame: number = 0; frame < 150; frame++) {
      scene = advancePreyScene(scene, 1 / 120, whale)
      assert.equal(scene.consumed, 0)
    }
    assert.ok(scene.animals.length > 0)
    assert.ok(Math.abs(scene.animals[0].y - 210) > 15 || scene.animals[0].vx * direction > 0)
  }
})

test('鲸鱼快速上冲时，虾仍逃离当前嘴部，预测点越过猎物不会反向误导尾弹', () => {
  const base: PreyScene = encounterAt(170, 230)
  const scene: PreyScene = { ...base, animals: [{ ...base.animals[0], kind: 'shrimp', vx: 0 }] }
  const escaped: PreyScene = advancePreyScene(scene, 0.1, {
    x: 150,
    y: 260,
    vx: 0,
    vy: -180,
    direction: 1,
  })
  assert.ok(escaped.animals[0].vy < -10)
  assert.equal(escaped.consumed, 0)
})

test('磷虾受惊时腹尾收拢并短暂后退，之后恢复划游，暂停保持部件姿态', () => {
  const initial: PreyScene = encounterAt(170, 210)
  const shrimp: Prey = { ...initial.animals[0], kind: 'shrimp', size: 0.57 }
  const whale: Whale = { x: 130, y: 210, vx: 0, vy: 0, direction: 1 }
  let scene: PreyScene = advancePreyScene({ ...initial, animals: [shrimp] }, 0.1, whale)
  const escaping: Prey = scene.animals[0]
  assert.ok(escaping.escapeUntil > scene.clock)
  assert.ok(escaping.vx * Math.cos(escaping.heading) + escaping.vy * Math.sin(escaping.heading) < 0)
  const pose = getPreyPose(escaping, scene.clock)
  assert.ok(pose.tail < -5)
  assert.deepEqual(getPreyPose(escaping, scene.clock), pose)
  for (let i: number = 0; i < 4; i++) scene = advancePreyScene(scene, 0.1, whale)
  assert.ok(scene.animals[0].escapeUntil < scene.clock)
  assert.ok(Math.abs(getPreyPose(scene.animals[0], scene.clock).tail) <= 2)
  assert.equal(shrimp.heading, 0)
})

test('有猎物时加速追逐且不自动鲸跃，数次遭遇可捕到一部分也有逃脱', () => {
  let captures: number = 0
  let escaped: number = 0
  let peakHuntSpeed: number = 0
  for (let seed: number = 1; seed <= 8; seed++) {
    let motion: SwimMotion = createSwimMotion({ x: 180, y: 190, vx: 0, vy: 0, direction: 1 }, seed)
    let prey: PreyScene = createPreyScene(seed * 38471)
    for (let frame: number = 0; frame < 60 * 80; frame++) {
      const previous: PreyScene = prey
      prey = advancePreyScene(prey, 1 / 60, motion.whale)
      prey = trackPreyTarget(prey, motion.whale)
      if (prey.consumed > previous.consumed) motion = recordFeeding(motion)
      if (prey.animals.some((p: Prey): boolean => p.caughtAt === null))
        motion = deferAutoBreach(motion)
      const target: readonly [number, number] | null = findPreyTarget(prey, motion.whale)
      motion = target === null ? finishPursuit(motion) : pursuePrey(motion, target)
      motion = advanceSwimMotion(motion, 1 / 60, (): number => 147)
      if (motion.phase === 'hunt' || motion.phase === 'lunge')
        peakHuntSpeed = Math.max(peakHuntSpeed, Math.hypot(motion.whale.vx, motion.whale.vy))
      if (target !== null) assert.notEqual(motion.phase, 'gather')
      const remaining: Set<number> = new Set<number>(prey.animals.map((p: Prey): number => p.id))
      escaped += previous.animals.filter(
        (p: Prey): boolean => p.caughtAt === null && !remaining.has(p.id),
      ).length
      assert.ok(prey.animals.length <= 36)
      assert.ok(
        prey.animals.every((p: Prey): boolean => [p.x, p.y, p.vx, p.vy].every(Number.isFinite)),
      )
    }
    captures += prey.consumed
  }
  assert.ok(peakHuntSpeed > 120 && peakHuntSpeed < 150)
  assert.ok(captures > 0 && escaped > 0)
})
