/** Tool results are explicit project selections, including results received after mount. */
export function createNativeSelection() {
  let snapshot: { boardId?: string; sequence: number } = { sequence: 0 };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    confirm(boardId: unknown) {
      if (typeof boardId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(boardId)) return;
      snapshot = { boardId, sequence: snapshot.sequence + 1 };
      listeners.forEach(listener => listener());
    },
  };
}
