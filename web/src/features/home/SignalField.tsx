import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import * as THREE from 'three'
import type { SignalPointer } from './usePointerOrbit'

type SignalFieldProps = {
  pointerRef: RefObject<SignalPointer | null>
  reducedMotion: boolean
}

type SignalPoint = {
  angle: number
  radius: number
  height: number
  color: string
}

const lime = '#b8ff3d'
const coral = '#ff6542'

function SignalScene({ pointerRef, reducedMotion }: SignalFieldProps) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const scanRef = useRef<THREE.Mesh>(null)
  const elapsedRef = useRef(0)
  const points = useMemo<SignalPoint[]>(
    () => [
      { angle: 0.15, radius: 2.05, height: 0.22, color: lime },
      { angle: 1.1, radius: 1.9, height: -0.18, color: coral },
      { angle: 2.1, radius: 2.15, height: 0.1, color: lime },
      { angle: 3.2, radius: 1.95, height: -0.25, color: coral },
      { angle: 4.35, radius: 2.1, height: 0.18, color: lime },
      { angle: 5.35, radius: 1.85, height: -0.08, color: coral },
    ],
    [],
  )

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return

    const pointer = pointerRef.current ?? { x: 0, y: 0 }
    const targetRotationX = pointer.y * -0.14
    const targetRotationY = pointer.x * 0.18
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetRotationX, 0.045)
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, targetRotationY, 0.045)

    if (reducedMotion) return

    elapsedRef.current += delta
    const time = elapsedRef.current
    group.rotation.z = time * 0.035

    if (coreRef.current) {
      coreRef.current.rotation.x = time * 0.14
      coreRef.current.rotation.y = time * 0.2
      const pulse = 1 + Math.sin(time * 1.7) * 0.025
      coreRef.current.scale.setScalar(pulse)
    }
    if (scanRef.current) {
      scanRef.current.rotation.z = time * 0.65
      scanRef.current.position.z = Math.sin(time * 0.8) * 0.35
    }
  })

  return (
    <group ref={groupRef} rotation={[0.18, -0.2, 0]}>
      <ambientLight intensity={0.35} />
      <pointLight color={lime} intensity={1.3} distance={7} position={[2, 2, 3]} />
      <pointLight color={coral} intensity={0.8} distance={6} position={[-2, -1, 2]} />

      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshBasicMaterial color={lime} transparent opacity={0.72} wireframe />
      </mesh>
      <mesh scale={0.55}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial color={coral} transparent opacity={0.08} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh rotation={[0.5, 0.15, 0.2]}>
        <torusGeometry args={[1.75, 0.012, 8, 96]} />
        <meshBasicMaterial color={lime} transparent opacity={0.48} />
      </mesh>
      <mesh rotation={[-0.35, 0.45, -0.55]}>
        <torusGeometry args={[2.05, 0.009, 8, 96]} />
        <meshBasicMaterial color={coral} transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[1.1, -0.2, 0.65]}>
        <torusGeometry args={[2.32, 0.007, 8, 96]} />
        <meshBasicMaterial color={lime} transparent opacity={0.28} />
      </mesh>

      {points.map((point) => (
        <mesh
          key={`${point.angle}-${point.radius}`}
          position={[Math.cos(point.angle) * point.radius, point.height, Math.sin(point.angle) * point.radius]}
        >
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshBasicMaterial color={point.color} />
        </mesh>
      ))}

      <mesh ref={scanRef} rotation={[0.4, 0.2, 0]}>
        <planeGeometry args={[3.4, 0.018]} />
        <meshBasicMaterial
          color={coral}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

export function SignalField({ pointerRef, reducedMotion }: SignalFieldProps) {
  return (
    <div
      className="signal-field"
      data-testid="signal-field"
      data-signal-field-mode={reducedMotion ? 'static' : 'interactive'}
      aria-hidden="true"
    >
      <Canvas
        className="signal-field-canvas"
        camera={{ position: [0, 0, 7], fov: 42 }}
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? 'demand' : 'always'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        fallback={<div className="signal-field-fallback" />}
      >
        <SignalScene pointerRef={pointerRef} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  )
}
