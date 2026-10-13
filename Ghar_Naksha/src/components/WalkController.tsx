import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Project } from '../types';
import { WalkAvatar, type AvatarPose } from './WalkAvatar';
import {
  DEFAULT_WALK_SETTINGS,
  bodyBlocked,
  cameraObstructionFraction,
  nearbySeat,
  moveWalker,
  personHeight,
  seatedEyeHeight,
  spawnWalker,
  standingEyeHeight,
  standingFromSeat,
  type SeatPose,
  type WalkPosition,
  type WalkthroughSettings,
  type WalkWorld,
} from '../lib/walkthrough';

export interface WalkStatus {
  position: WalkPosition;
  levelName: string;
  height: number;
  camera: WalkthroughSettings['camera'];
  eyeElevation: number;
  seated: boolean;
  seatName: string | null;
  canSit: boolean;
  message: string;
}
export interface WalkInteraction {
  active: boolean;
  suppressUntil: number;
  cancelCamera: boolean;
}
export function WalkController({
  world,
  project,
  focusRoomId,
  interaction,
  settings = DEFAULT_WALK_SETTINGS,
  onActiveLevelChange,
  onStatus,
}: {
  world: WalkWorld;
  project: Project;
  focusRoomId: string | null;
  interaction: WalkInteraction;
  settings?: WalkthroughSettings;
  onActiveLevelChange?: (levelId: string) => void;
  onStatus: (status: WalkStatus) => void;
}) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const angles = useRef({ yaw: 0, pitch: -0.05 });
  const requestedLevelId = project.activeLevelId ?? world.levels[0].id;
  const initialPosition = useMemo(
    () => spawnWalker(world, requestedLevelId, settings.height),
    [],
  );
  const body = useRef<WalkPosition>(initialPosition);
  const seat = useRef<SeatPose | null>(null);
  const initialized = useRef(false);
  const lastStatus = useRef(0);
  const lastAnnounced = useRef(requestedLevelId);
  const lastFocus = useRef<string | null>(null);
  const message = useRef('');
  const latest = useRef({
    world,
    project,
    settings,
    onActiveLevelChange,
    onStatus,
  });
  latest.current = { world, project, settings, onActiveLevelChange, onStatus };
  const pose = useRef<AvatarPose>({
    position: body.current,
    yaw: 0,
    moving: false,
    seated: false,
    seatY: 0,
    height: personHeight(settings.height),
    visible: settings.camera !== 'first',
  });
  const performInteraction = useRef<() => void>(() => {});
  const stand = () => {
    if (!seat.current) return true;
    const position = standingFromSeat(
      latest.current.world,
      seat.current,
      latest.current.settings.height,
    );
    if (!position) {
      message.current =
        'No clear space to stand. Move the nearby furniture in the editor.';
      return false;
    }
    body.current = position;
    seat.current = null;
    message.current = '';
    return true;
  };
  performInteraction.current = () => {
    if (seat.current) {
      stand();
      return;
    }
    const nearby = nearbySeat(latest.current.world, body.current);
    if (!nearby) {
      message.current = 'Move next to a sofa or chair to sit.';
      return;
    }
    // Do not allow interaction through a wall or intervening furniture.
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      if (
        bodyBlocked(
          latest.current.world,
          body.current.x + (nearby.x - body.current.x) * t,
          body.current.y,
          body.current.z + (nearby.z - body.current.z) * t,
          latest.current.settings.height,
          nearby.elementId,
        )
      ) {
        message.current = 'Approach the seat from its open side.';
        return;
      }
    }
    seat.current = nearby;
    body.current = {
      ...body.current,
      x: nearby.x,
      z: nearby.z,
      levelId: nearby.levelId,
    };
    angles.current.yaw = nearby.yaw;
    message.current = '';
  };
  useEffect(() => {
    const room =
      project.rooms.find((item) => item.id === focusRoomId) ??
      (!initialized.current
        ? (project.rooms.find(item=>item.id==='living' && (item.levelId ?? world.levels[0].id) === requestedLevelId) ?? project.rooms.find(
            (item) => (item.levelId ?? world.levels[0].id) === requestedLevelId,
          ))
        : undefined);
    const focusChanged = !!room && focusRoomId !== lastFocus.current;
    // Auto level changes at the last tread preserve the person's position.
    if (
      !initialized.current ||
      (requestedLevelId !== body.current.levelId &&
        requestedLevelId !== lastAnnounced.current) ||
      focusChanged
    ) {
      body.current = spawnWalker(
        world,
        requestedLevelId,
        settings.height,
        room ? [room.center[0], room.center[1] + room.depth * 0.2] : undefined,
      );
      seat.current = null;
      angles.current = { yaw: 0, pitch: -0.05 };
      keys.current.clear();
      initialized.current = true;
      lastAnnounced.current = body.current.levelId;
    }
    lastFocus.current = focusRoomId;
  }, [requestedLevelId, focusRoomId, world, project.rooms, settings.height]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.code === 'KeyE' && !event.repeat) {
        event.preventDefault();
        performInteraction.current();
      }
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ShiftLeft',
          'ShiftRight',
        ].includes(event.code)
      ) {
        event.preventDefault();
        keys.current.add(event.code);
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const touchWalk = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          direction: 'forward' | 'backward' | 'left' | 'right';
          active: boolean;
        }>
      ).detail;
      if (!detail) return;
      const code = {
        forward: 'ArrowUp',
        backward: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
      }[detail.direction];
      if (code) {
        if (detail.active) keys.current.add(code);
        else keys.current.delete(code);
      }
    };
    const pointerDown = (event: PointerEvent) => {
      if (
        event.button === 0 &&
        !pointer.current &&
        (event.isPrimary || event.pointerType === 'touch')
      )
        pointer.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
    };
    const pointerUp = (event: PointerEvent) => {
      if (event.pointerId === pointer.current?.id) {
        if (pointer.current.moved)
          interaction.suppressUntil = performance.now() + 250;
        pointer.current = null;
      }
    };
    const pointerMove = (event: PointerEvent) => {
      const last = pointer.current;
      if (!last || last.id !== event.pointerId) return;
      angles.current.yaw -= (event.clientX - last.x) * 0.003;
      angles.current.pitch = Math.max(
        -1,
        Math.min(1, angles.current.pitch - (event.clientY - last.y) * 0.003),
      );
      pointer.current = {
        ...last,
        x: event.clientX,
        y: event.clientY,
        moved:
          last.moved ||
          Math.hypot(event.clientX - last.startX, event.clientY - last.startY) >
            4,
      };
    };
    const blur = () => {
      keys.current.clear();
      pointer.current = null;
    };
    const interact = () => performInteraction.current();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('ghar-walk', touchWalk);
    window.addEventListener('ghar-interact', interact);
    window.addEventListener('blur', blur);
    gl.domElement.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    window.addEventListener('pointermove', pointerMove);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('ghar-walk', touchWalk);
      window.removeEventListener('ghar-interact', interact);
      window.removeEventListener('blur', blur);
      gl.domElement.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', pointerUp);
      window.removeEventListener('pointermove', pointerMove);
    };
  }, [gl, interaction]);
  useFrame(({ clock }, delta) => {
    const current = latest.current,
      height = personHeight(current.settings.height);
    const pressed = keys.current;
    const forward =
      Number(pressed.has('KeyW') || pressed.has('ArrowUp')) -
      Number(pressed.has('KeyS') || pressed.has('ArrowDown'));
    const side =
      Number(pressed.has('KeyD') || pressed.has('ArrowRight')) -
      Number(pressed.has('KeyA') || pressed.has('ArrowLeft'));
    let moving = false;
    if (
      seat.current &&
      !current.world.seats.some(
        (item) => item.element.id === seat.current?.elementId,
      )
    )
      stand();
    if ((forward || side) && (!seat.current || stand())) {
      const sprint = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
      const speed =
        (Math.min(delta, 0.045) * (sprint ? 3.8 : 2.1)) /
        (forward && side ? Math.SQRT2 : 1);
      const yaw = angles.current.yaw;
      const previous = body.current;
      body.current = moveWalker(
        current.world,
        previous,
        (-Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed,
        (-Math.cos(yaw) * forward - Math.sin(yaw) * side) * speed,
        height,
      );
      moving =
        Math.hypot(body.current.x - previous.x, body.current.z - previous.z) >
        0.0001;
      if (moving) message.current = '';
    }
    if (body.current.levelId !== lastAnnounced.current) {
      lastAnnounced.current = body.current.levelId;
      current.onActiveLevelChange?.(body.current.levelId);
    }
    const p = body.current;
    const eyeY = seat.current
      ? seat.current.seatY + seatedEyeHeight(height)
      : p.y + standingEyeHeight(height);
    pose.current = {
      position: p,
      yaw: seat.current?.yaw ?? angles.current.yaw,
      height,
      moving,
      seated: !!seat.current,
      seatY: seat.current?.seatY ?? 0,
      visible: current.settings.camera !== 'first',
    };
    if (current.settings.camera === 'first') {
      camera.position.set(p.x, eyeY, p.z);
      camera.rotation.set(angles.current.pitch, angles.current.yaw, 0, 'YXZ');
    } else {
      const aim = new Vector3(p.x, eyeY - height * 0.13, p.z);
      const distance = height * 1.65;
      const sign = current.settings.camera === 'front' ? -1 : 1;
      const desired = new Vector3(
        p.x + Math.sin(angles.current.yaw) * distance * sign,
        eyeY + height * 0.12 - Math.sin(angles.current.pitch) * distance,
        p.z + Math.cos(angles.current.yaw) * distance * sign,
      );
      const fraction = cameraObstructionFraction(
        current.world,
        aim.toArray(),
        desired.toArray(),
      );
      camera.position.copy(aim).lerp(desired, fraction);
      camera.lookAt(aim);
      pose.current.visible = fraction > 0.19;
    }
    if (clock.elapsedTime - lastStatus.current > 0.16) {
      lastStatus.current = clock.elapsedTime;
      const nearby = seat.current ?? nearbySeat(current.world, p);
      current.onStatus({
        position: { ...p },
        levelName:
          current.world.levels.find((level) => level.id === p.levelId)?.name ??
          'Floor',
        height,
        camera: current.settings.camera,
        eyeElevation: eyeY,
        seated: !!seat.current,
        seatName: nearby?.name ?? null,
        canSit: !!nearby,
        message: message.current,
      });
    }
  });
  return <WalkAvatar pose={pose} />;
}
