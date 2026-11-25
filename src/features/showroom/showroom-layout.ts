export type Vector = [number, number, number];
export type WallId = "left" | "front" | "right";
export type Selection = { wall: WallId; id: string };

export type GarmentPose = {
  src: string;
  width: number;
  collar: readonly [center: number, top: number, depth: number];
};

export type ShowroomGarment = {
  id: string;
  name: string;
  color: string;
  priceUsd: number;
  description: string;
  length: number;
  front: GarmentPose;
  profile: GarmentPose;
};

export type ShowroomRacks = Record<WallId, readonly ShowroomGarment[]>;

export const railHeight = 4.5;
export const hangerDrop = 0.36;
export const entryPosition: Vector = [0, 2.75, 5.6];

export const racks: Record<WallId, { position: Vector; angle: number; width: number; spacing: number }> = {
  left: { position: [-8.07, railHeight, 0.48], angle: Math.PI / 2, width: 6.4, spacing: 1.32 },
  front: { position: [0, railHeight, -6.73], angle: 0, width: 8.1, spacing: 0.81 },
  right: { position: [8.07, railHeight, 0.48], angle: -Math.PI / 2, width: 6.4, spacing: 1.32 },
};

export function rackOffset(wall: WallId, index: number, count: number) {
  return (index - (count - 1) / 2) * racks[wall].spacing;
}

export type ProductView = { position: Vector; yaw: number; pitch: number };

export function productView(wall: WallId, item: ShowroomGarment, index: number, count: number): ProductView {
  const rack = racks[wall];
  const slot = rackOffset(wall, index, count);
  const sin = Math.sin(rack.angle);
  const cos = Math.cos(rack.angle);
  const distance = 4.4;

  return {
    position: [
      rack.position[0] + slot * cos + distance * sin,
      railHeight - hangerDrop - item.length / 2 + 0.13,
      rack.position[2] - slot * sin + distance * cos,
    ],
    yaw: rack.angle,
    pitch: Math.atan2(-0.13, distance),
  };
}
