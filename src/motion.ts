import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
const CDN_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const CDN_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const LOCAL_WASM = "mediapipe/wasm";
const LOCAL_MODEL = "mediapipe/pose_landmarker_lite.task";
export type Direction = 'forward' | 'backward';
export class Motion {
  private video: HTMLVideoElement | null = null;
  private landmarker: PoseLandmarker | null = null;
  private raf = 0;
  private running = false;
  private smoothed: number | null = null;
  private neutral = 0;
  private sensitivity = 0.015;
  private last: Direction | 'none' = 'none';
  private lastEmit = 0;
  onMove: ((d: Direction) => void) | null = null;
  onOffset: ((offset: number) => void) | null = null;
  async init(video: HTMLVideoElement) {
    this.video = video;
    const packaged = !!(window as any).Capacitor || navigator.userAgent.toLowerCase().includes('electron');
    const wasm = packaged ? LOCAL_WASM : CDN_WASM;
    const model = packaged ? LOCAL_MODEL : CDN_MODEL;
    const vision = await FilesetResolver.forVisionTasks(wasm);
    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: model, delegate: "GPU" },
      runningMode: "VIDEO", numPoses: 1
    });
  }
  setSensitivity(percent: number) { this.sensitivity = 0.05 - (percent / 100) * 0.045; }
  calibrate() { if (this.smoothed !== null) this.neutral = this.smoothed; }
  start() { if (this.running || !this.landmarker) return; this.running = true; this.last = 'none'; this.smoothed = null; this.loop(); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  private depth(lm: any[]): number {
    const nose = lm[0], ls = lm[11], rs = lm[12];
    if (!nose || !ls || !rs) return 0;
    const midX = (ls.x + rs.x) / 2, midY = (ls.y + rs.y) / 2;
    const sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    const nd = Math.hypot(nose.x - midX, nose.y - midY);
    return sw * 0.7 + nd * 0.3;
  }
  private loop = () => {
    if (!this.running || !this.video || !this.landmarker) return;
    try {
      const res = this.landmarker.detectForVideo(this.video, performance.now());
      const lm = res.landmarks?.[0];
      if (lm) {
        const raw = this.depth(lm);
        this.smoothed = this.smoothed === null ? raw : this.smoothed * 0.8 + raw * 0.2;
        const off = this.smoothed - this.neutral;
                this.onOffset?.(off);
        const cur: Direction | 'none' =
          off > this.sensitivity ? 'forward' :
          off < -this.sensitivity ? 'backward' :
          Math.abs(off) < this.sensitivity * 0.4 ? 'none' : this.last;
        const now = Date.now();
        if (cur !== 'none' && cur !== this.last && now - this.lastEmit > 600) {
          this.lastEmit = now;
          this.onMove?.(cur);
        }
        this.last = cur;
      }
    } catch (e) { }
    this.raf = requestAnimationFrame(this.loop);
  };
}
