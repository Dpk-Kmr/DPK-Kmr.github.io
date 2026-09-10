import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { WalkPosition } from '../lib/walkthrough';

export interface AvatarPose {
  position: WalkPosition;
  yaw: number;
  moving: boolean;
  seated: boolean;
  seatY: number;
  height: number;
  visible: boolean;
}
function Limb({
  length,
  radius,
  color,
}: {
  length: number;
  radius: number;
  color: string;
}) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow>
      <capsuleGeometry
        args={[radius, Math.max(0.001, length - radius * 2), 5, 10]}
      />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  );
}
export function WalkAvatar({ pose }: { pose: React.RefObject<AvatarPose> }) {
  const root = useRef<Group>(null),
    leftArm = useRef<Group>(null),
    rightArm = useRef<Group>(null),
    leftLeg = useRef<Group>(null),
    rightLeg = useRef<Group>(null),
    leftShin = useRef<Group>(null),
    rightShin = useRef<Group>(null);
  const phase = useRef(0);
  useFrame((_, delta) => {
    const p = pose.current;
    if (!root.current) return;
    root.current.visible = p.visible;
    root.current.scale.setScalar(p.height);
    root.current.position.set(
      p.position.x,
      p.seated ? p.seatY - 0.5 * p.height : p.position.y,
      p.position.z,
    );
    root.current.rotation.y = p.yaw;
    Object.assign(root.current.userData, {
      walkthroughAvatar: true,
      height: p.height,
      seated: p.seated,
      levelId: p.position.levelId,
    });
    if (p.moving) phase.current += delta * 9;
    const stride = p.moving && !p.seated ? Math.sin(phase.current) * 0.55 : 0;
    if (leftArm.current)
      leftArm.current.rotation.x = p.seated ? -0.28 : -stride * 0.7;
    if (rightArm.current)
      rightArm.current.rotation.x = p.seated ? -0.28 : stride * 0.7;
    if (leftLeg.current)
      leftLeg.current.rotation.x = p.seated ? Math.PI / 2 : stride;
    if (rightLeg.current)
      rightLeg.current.rotation.x = p.seated ? Math.PI / 2 : -stride;
    if (leftShin.current)
      leftShin.current.rotation.x = p.seated
        ? -Math.PI / 2
        : Math.max(0, -stride) * -0.45;
    if (rightShin.current)
      rightShin.current.rotation.x = p.seated
        ? -Math.PI / 2
        : Math.max(0, stride) * -0.45;
  });
  return (
    <group ref={root} name="walkthrough-person">
      <mesh position={[0, 0.69, 0]} castShadow>
        <capsuleGeometry args={[0.115, 0.19, 6, 12]} />
        <meshStandardMaterial color="#386f89" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.19, 0.09, 0.13]} />
        <meshStandardMaterial color="#334354" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.905, 0]} scale={[0.83, 1, 0.87]} castShadow>
        <sphereGeometry args={[0.095, 16, 12]} />
        <meshStandardMaterial color="#c99876" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.942, 0.008]} scale={[0.88, 0.58, 0.91]} castShadow>
        <sphereGeometry args={[0.094, 16, 10]} />
        <meshStandardMaterial color="#49362e" roughness={1} />
      </mesh>
      <mesh position={[0, 0.895, -0.086]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshStandardMaterial color="#c99876" />
      </mesh>
      {[-0.034, 0.034].map((x) => (
        <mesh key={x} position={[x, 0.92, -0.078]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshStandardMaterial color="#2c302d" />
        </mesh>
      ))}
      {[
        [-1, leftArm],
        [1, rightArm],
      ].map(([side, ref], index) => (
        <group
          key={index}
          ref={ref as React.RefObject<Group>}
          position={[(side as number) * 0.142, 0.79, 0]}
        >
          <Limb length={0.3} radius={0.035} color="#386f89" />
          <mesh position={[0, -0.32, 0]} castShadow>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial color="#c99876" />
          </mesh>
        </group>
      ))}
      {[
        [-1, leftLeg, leftShin],
        [1, rightLeg, rightShin],
      ].map(([side, ref, shin], index) => (
        <group
          key={index}
          ref={ref as React.RefObject<Group>}
          position={[(side as number) * 0.062, 0.5, 0]}
        >
          <Limb length={0.235} radius={0.05} color="#334354" />
          <group ref={shin as React.RefObject<Group>} position={[0, -0.235, 0]}>
            <Limb length={0.225} radius={0.039} color="#334354" />
            <mesh position={[0, -0.237, -0.027]} castShadow>
              <boxGeometry args={[0.085, 0.055, 0.15]} />
              <meshStandardMaterial color="#27312f" roughness={0.8} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
