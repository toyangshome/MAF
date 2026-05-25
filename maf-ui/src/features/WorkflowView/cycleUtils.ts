/**
 * Detect whether adding an edge from newSource to newTarget would create a cycle.
 * Uses DFS from newTarget to see if newSource is reachable (which would close a loop).
 */
export function wouldCreateCycle(
  edges: Array<{ source: string; target: string }>,
  newSource: string,
  newTarget: string,
): boolean {
  const adj = new Map<string, string[]>();
  edges.forEach(({ source, target }) => {
    if (!adj.has(source)) adj.set(source, []);
    adj.get(source)!.push(target);
  });
  if (!adj.has(newSource)) adj.set(newSource, []);
  adj.get(newSource)!.push(newTarget);

  const visited = new Set<string>();
  const stack = [newTarget];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newSource) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    (adj.get(current) || []).forEach((child) => stack.push(child));
  }
  return false;
}
