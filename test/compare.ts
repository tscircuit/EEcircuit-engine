export function deepCompare(
  a: unknown,
  b: unknown,
  path: string[] = []
): boolean {
  const absoluteTolerance = 2e-3;
  const relativeTolerance = 1e-3;

  if (typeof a === "number" && typeof b === "number") {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      if (Object.is(a, b)) {
        return true;
      }
      console.error(`Difference at ${path.join(".")}:`, a, b);
      return false;
    }

    const diff = Math.abs(a - b);
    const allowed = Math.max(absoluteTolerance, relativeTolerance * Math.max(Math.abs(a), Math.abs(b)));
    if (diff > allowed) {
      console.error(`Difference at ${path.join(".")}:`, a, b, `(diff ${diff}, allowed ${allowed})`);
      return false;
    }
    return true;
  }

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    if (a !== b) {
      console.error(`Difference at ${path.join(".")}:`, a, b);
      return false;
    }
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if (!deepCompare(a[i], b[i], [...path, String(i)])) {
        return false;
      }
    }
  } else {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (
        !deepCompare(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          [...path, key]
        )
      ) {
        return false;
      }
    }
  }

  return true;
}
