// tests/helpers/requestCache.ts
//
// Request-scoped memoizer used in tests that assert React.cache deduping.
// jsdom's client React build makes cache() a no-op, so those tests install
// this in place of react.cache. Production code uses React.cache itself.
//
// SEE: src/lib/session.ts, src/lib/myTasks.ts

type CacheNode = {
  s: 0 | 1 | 2;
  v: unknown;
  o: WeakMap<object, CacheNode> | null;
  p: Map<unknown, CacheNode> | null;
};

type CachedFn = (...args: never[]) => unknown;

let fnRoots = new WeakMap<CachedFn, CacheNode>();

function createNode(): CacheNode {
  return { s: 0, v: undefined, o: null, p: null };
}

export function resetRequestCache() {
  fnRoots = new WeakMap();
}

function childForObject(node: CacheNode, arg: object): CacheNode {
  const objectCache: WeakMap<object, CacheNode> = node.o ?? new WeakMap();
  node.o = objectCache;
  const existing = objectCache.get(arg);
  if (existing) return existing;
  const next: CacheNode = createNode();
  objectCache.set(arg, next);
  return next;
}

function childForPrimitive(node: CacheNode, arg: unknown): CacheNode {
  const primitiveCache: Map<unknown, CacheNode> = node.p ?? new Map();
  node.p = primitiveCache;
  const existing = primitiveCache.get(arg);
  if (existing) return existing;
  const next: CacheNode = createNode();
  primitiveCache.set(arg, next);
  return next;
}

export function cache<T extends CachedFn>(fn: T): T {
  return ((...args: never[]) => {
    const existing = fnRoots.get(fn);
    let node: CacheNode = existing ?? createNode();
    if (!existing) fnRoots.set(fn, node);

    for (const arg of args) {
      if (typeof arg === 'function' || (typeof arg === 'object' && arg !== null)) {
        node = childForObject(node, arg);
      } else {
        node = childForPrimitive(node, arg);
      }
    }

    if (node.s === 1) return node.v;
    if (node.s === 2) throw node.v;
    try {
      const result = fn(...args);
      node.s = 1;
      node.v = result;
      return result;
    } catch (error) {
      node.s = 2;
      node.v = error;
      throw error;
    }
  }) as T;
}
