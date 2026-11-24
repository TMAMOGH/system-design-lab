import type { TraceMeta } from "./types";

export interface HeapEntry {
  t: number;
  seq: number;
  fn: () => void;
  meta: TraceMeta;
}

function less(a: HeapEntry, b: HeapEntry): boolean {
  return a.t < b.t || (a.t === b.t && a.seq < b.seq);
}

/** Binary min-heap ordered by (t, seq). */
export class EventHeap {
  private items: HeapEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  peek(): HeapEntry | undefined {
    return this.items[0];
  }

  push(e: HeapEntry): void {
    const a = this.items;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop(): HeapEntry | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < n && less(a[l], a[m])) m = l;
        if (r < n && less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}
