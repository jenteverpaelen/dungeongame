import type { AdventureData } from '@shared/adventureTypes';

interface AmbientAudio {
  positionedLoop(id: string, name: string, x: number, y: number, radius: number): void;
  clearAmbient(): void;
}

/** Same positional engine and ambience controls as the town; owned by the current zone. */
export class AdventureSound {
  private next = 0;
  private destroyed = false;
  constructor(private area: AdventureData, private audio: AmbientAudio) {}
  update(time: number): void {
    if (this.destroyed || time < this.next) return;
    this.next = time + .08;
    for (const e of this.area.ambience?.sounds ?? [])
      this.audio.positionedLoop(`${this.area.id}/${e.id}`, `town_${e.kind}`, ...e.position, e.radius);
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.audio.clearAmbient();
  }
}
