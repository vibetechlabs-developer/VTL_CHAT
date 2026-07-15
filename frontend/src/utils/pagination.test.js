import { describe, it, expect } from "vitest";
import {
  normalizePage,
  mergeById,
  prependById,
  toChronological,
} from "./pagination.js";

describe("pagination", () => {
  it("normalizes cursor page shape", () => {
    expect(normalizePage({ results: [{ id: 1 }], next: "/a", previous: null })).toEqual({
      results: [{ id: 1 }],
      next: "/a",
      previous: null,
    });
  });

  it("normalizes bare arrays", () => {
    expect(normalizePage([{ id: 1 }])).toEqual({
      results: [{ id: 1 }],
      next: null,
      previous: null,
    });
  });

  it("merges without duplicates", () => {
    const a = [{ id: 1 }, { id: 2 }];
    const b = [{ id: 2 }, { id: 3 }];
    expect(mergeById(a, b)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("prepends without duplicates", () => {
    const existing = [{ id: 2 }, { id: 3 }];
    const older = [{ id: 1 }, { id: 2 }];
    expect(prependById(existing, older)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("reverses newest-first pages to chronological order", () => {
    expect(toChronological([{ id: 3 }, { id: 2 }, { id: 1 }])).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });
});
