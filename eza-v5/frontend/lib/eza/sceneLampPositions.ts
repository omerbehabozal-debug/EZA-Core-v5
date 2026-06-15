/** Eight hand-marked amber lamps on default-conversation-scene.png (user red circles). */
export type SceneLampSpec = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  delay: number;
};

export const SCENE_IMAGE_ASPECT = 1024 / 682;

/** Pin-sized overlays — w/h are % of scene image, tuned to amber cores only. */
export const SCENE_ENTRANCE_LAMPS: SceneLampSpec[] = [
  { id: 'hill', x: 21.0, y: 75.37, w: 0.4, h: 0.72, color: 'rgb(226, 161, 67)', delay: 0 },
  { id: 'br-l', x: 41.57, y: 67.45, w: 0.38, h: 0.66, color: 'rgb(219, 160, 98)', delay: 2.4 },
  { id: 'br-c', x: 50.29, y: 67.45, w: 0.38, h: 0.66, color: 'rgb(200, 150, 90)', delay: 5.1 },
  { id: 'br-r', x: 54.21, y: 67.45, w: 0.38, h: 0.66, color: 'rgb(202, 154, 92)', delay: 7.8 },
  { id: 'cb-l', x: 59.47, y: 58.94, w: 0.36, h: 0.62, color: 'rgb(255, 185, 85)', delay: 1.3 },
  { id: 'cb-r', x: 65.04, y: 58.8, w: 0.36, h: 0.62, color: 'rgb(255, 204, 125)', delay: 4.0 },
  { id: 'ms-l', x: 75.39, y: 67.45, w: 0.38, h: 0.66, color: 'rgb(234, 150, 52)', delay: 6.6 },
  { id: 'ms-c', x: 78.03, y: 67.45, w: 0.38, h: 0.66, color: 'rgb(233, 160, 55)', delay: 3.2 },
];
