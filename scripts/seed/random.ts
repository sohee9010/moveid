// 매번 같은 결과를 내는 난수 생성기 (mulberry32).
// 시드를 여러 번 실행해도 같은 회원·같은 분포의 이벤트가 만들어지게 한다.

export function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** min 이상 max 이하 정수 */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    /** 배열에서 하나 */
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('빈 배열에서 고를 수 없습니다.');
      return item;
    },
    /** 가중치에 따라 하나: [[값, 가중치], ...] */
    weighted: <T>(entries: readonly (readonly [T, number])[]): T => {
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let r = next() * total;
      for (const [value, weight] of entries) {
        r -= weight;
        if (r < 0) return value;
      }
      const last = entries.at(-1);
      if (!last) throw new Error('빈 배열에서 고를 수 없습니다.');
      return last[0];
    },
    chance: (p: number) => next() < p,
  };
}

export type Random = ReturnType<typeof createRandom>;
