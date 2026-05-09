export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  nextFloat() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number) {
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  nextNumber(min: number, max: number) {
    return this.nextFloat() * (max - min) + min;
  }

  chance(probability: number) {
    return this.nextFloat() < probability;
  }

  pick<T>(items: readonly T[]) {
    return items[this.nextInt(0, items.length - 1)];
  }

  weightedPick<T>(items: Array<{ item: T; weight: number }>) {
    const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);

    if (total <= 0) {
      return items[0].item;
    }

    let threshold = this.nextFloat() * total;

    for (const entry of items) {
      threshold -= Math.max(0, entry.weight);

      if (threshold <= 0) {
        return entry.item;
      }
    }

    return items[items.length - 1].item;
  }

  snapshot() {
    return this.state >>> 0;
  }
}
