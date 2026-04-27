// PAYLOAD 7 — Framework-agnostic "render plan" type.
// React/Next.js is not yet bootstrapped in this repo (see README + tsconfig
// jsx:preserve). Page components in ui/app/* return a RenderPlan tree that:
//   • Documents the exact UI surface a renderer must produce.
//   • Is structurally testable in Jest (no DOM, no React runtime needed).
//   • Maps 1:1 onto JSX once Next.js lands — every node carries the same
//     props the eventual <div> / <section> would receive.
//
// The renderer adapter (ui/components/react-adapter.ts in a future payload)
// will recursively convert RenderNode → React.createElement.

export type RenderNode = RenderElement | string | number | null | undefined | RenderNode[];

export interface RenderElement {
  /** HTML element or design-system component name. */
  tag: string;
  /** Stable test-id (data-testid). Required on every interactive node. */
  test_id?: string;
  /** ARIA + role attributes. */
  aria?: Record<string, string>;
  /** Inline class list for the renderer adapter. */
  classes?: readonly string[];
  /** Inline style hash (renderer adapter resolves theme tokens). */
  style?: Record<string, string | number>;
  /** Event handler names — adapter binds them at mount time. */
  on?: Readonly<Record<string, string>>;
  /** Free-form props passed straight through to the renderer. */
  props?: Readonly<Record<string, unknown>>;
  /** Child nodes. */
  children?: RenderNode[];
}

export function el(
  tag: string,
  attrs?: Omit<RenderElement, 'tag' | 'children'>,
  children?: RenderNode[],
): RenderElement {
  return { tag, ...(attrs ?? {}), ...(children ? { children } : {}) };
}

/** Walk a tree and collect every test_id. Used by E2E tests. */
export function collectTestIds(node: RenderNode): string[] {
  const out: string[] = [];
  const visit = (n: RenderNode): void => {
    if (n == null) return;
    if (Array.isArray(n)) {
      n.forEach(visit);
      return;
    }
    if (typeof n === 'object') {
      if (n.test_id) out.push(n.test_id);
      if (n.children) n.children.forEach(visit);
    }
  };
  visit(node);
  return out;
}

/** Find the first node whose test_id matches. Returns undefined if none. */
export function findByTestId(node: RenderNode, test_id: string): RenderElement | undefined {
  if (node == null) return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestId(child, test_id);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof node !== 'object') return undefined;
  if (node.test_id === test_id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findByTestId(child, test_id);
      if (found) return found;
    }
  }
  return undefined;
}
