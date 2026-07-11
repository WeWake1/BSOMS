import type {
  PricelistNodeWithRelations,
  PricelistTreeNode,
  PricelistPrice,
  PricelistNode,
} from '@/types/database';

/**
 * Build a nested tree from a flat list of nodes (with prices + supplier joined).
 * Sorted by sort_order, then name. Each node carries its depth (root = 0).
 */
export function buildTree(
  nodes: PricelistNodeWithRelations[]
): PricelistTreeNode[] {
  const byId = new Map<string, PricelistTreeNode>();
  for (const n of nodes) {
    byId.set(n.id, { ...n, children: [], depth: 0 });
  }

  const roots: PricelistTreeNode[] = [];
  Array.from(byId.values()).forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortFn = (a: PricelistTreeNode, b: PricelistTreeNode) =>
    a.sort_order - b.sort_order || a.name.localeCompare(b.name);

  const assignDepth = (list: PricelistTreeNode[], depth: number) => {
    list.sort(sortFn);
    for (const node of list) {
      node.depth = depth;
      assignDepth(node.children, depth + 1);
    }
  };
  assignDepth(roots, 0);

  return roots;
}

/** A product leaf flattened with its ancestor path — used for fast search. */
export interface FlatProduct {
  node: PricelistNodeWithRelations;
  /** Ancestor names from root → parent (excludes the product's own name). */
  path: string[];
}

/** Flatten the tree to just product leaves, each with its breadcrumb path. */
export function flattenProducts(tree: PricelistTreeNode[]): FlatProduct[] {
  const out: FlatProduct[] = [];
  const walk = (nodes: PricelistTreeNode[], path: string[]) => {
    for (const node of nodes) {
      if (node.kind === 'product') {
        out.push({ node, path });
      }
      if (node.children.length) {
        walk(node.children, [...path, node.name]);
      }
    }
  };
  walk(tree, []);
  return out;
}

/** Case-insensitive match of a query against a product's name, path, and tiers. */
export function productMatches(p: FlatProduct, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    p.node.name,
    ...p.path,
    ...(p.node.tags ?? []),
    p.node.supplier?.name ?? '',
    ...p.node.prices.map((pr) => pr.label),
  ]
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((term) => haystack.includes(term));
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** Format a rupee amount, e.g. 2400 → "₹2,400". */
export function formatRupees(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  return `₹${inr.format(amount)}`;
}

/** Format a single price tier, e.g. "₹2,400 / sheet". */
export function formatPrice(price: PricelistPrice): string {
  const base = formatRupees(price.rate);
  return price.unit ? `${base} / ${price.unit}` : base;
}

/** The lowest rate among a product's tiers (for compact list display). */
export function lowestPrice(prices: PricelistPrice[]): PricelistPrice | null {
  if (!prices.length) return null;
  return prices.reduce((lo, p) => (p.rate < lo.rate ? p : lo), prices[0]);
}

/**
 * Compact size chip, e.g. "8 × 4 · 18mm". Returns '' when no size is set.
 * Thickness is rendered in mm (the universal convention for ply/MDF here).
 */
export function formatSize(
  node: Pick<PricelistNode, 'length' | 'width' | 'thickness'>
): string {
  const parts: string[] = [];
  if (node.length != null && node.width != null) {
    parts.push(`${node.length} × ${node.width}`);
  } else if (node.length != null) {
    parts.push(`${node.length}`);
  } else if (node.width != null) {
    parts.push(`${node.width}`);
  }
  if (node.thickness != null) parts.push(`${node.thickness}mm`);
  return parts.join(' · ');
}

// ─── Shallow-browse helpers (Category → Brand → priced model) ──────────

/** Top-level group nodes = Categories (Plywood, MDF, …). */
export function getCategoryNodes(tree: PricelistTreeNode[]): PricelistTreeNode[] {
  return tree.filter((n) => n.kind === 'group');
}

/** Products at the root that aren't inside any category. */
export function getUncategorisedProducts(
  tree: PricelistTreeNode[]
): PricelistNodeWithRelations[] {
  return tree.filter((n) => n.kind === 'product');
}

export interface BrandSection {
  id: string;
  /** Brand name, or null for products that sit directly under the category. */
  title: string | null;
  products: PricelistNodeWithRelations[];
}

/** All descendant products of a node (flattened, any depth). */
function collectProducts(node: PricelistTreeNode): PricelistNodeWithRelations[] {
  const out: PricelistNodeWithRelations[] = [];
  const walk = (n: PricelistTreeNode) => {
    for (const child of n.children) {
      if (child.kind === 'product') out.push(child);
      walk(child);
    }
  };
  walk(node);
  return out;
}

/**
 * Split a category into brand sections. Each immediate sub-group is a brand
 * (with all its descendant products flattened in); products sitting directly
 * under the category collapse into one leading "General" section.
 */
export function getBrandSections(category: PricelistTreeNode): BrandSection[] {
  const sections: BrandSection[] = [];
  const direct: PricelistNodeWithRelations[] = [];

  for (const child of category.children) {
    if (child.kind === 'group') {
      sections.push({ id: child.id, title: child.name, products: collectProducts(child) });
    } else {
      direct.push(child);
    }
  }
  if (direct.length) {
    sections.unshift({ id: `${category.id}__direct`, title: null, products: direct });
  }
  return sections;
}

// ─── Brand × Model matrix (for the Tree view) ────────────────────────

export interface BrandMatrix {
  /** Column headers — direct sub-group children of the category (brands). */
  brands: PricelistTreeNode[];
  /** Row labels — unique product names across all brands, in insertion order. */
  models: { name: string; tags: string[] }[];
  /** cells[modelIdx][brandIdx] = the product node, or null if that brand doesn't carry it. */
  cells: (PricelistNodeWithRelations | null)[][];
}

/**
 * Build a brand × model grid for a category node.
 * Rows  = unique product names across all brand sub-groups.
 * Cols  = brand sub-groups (direct group children of the category).
 * Cells = the matching product node, or null.
 */
export function buildBrandMatrix(category: PricelistTreeNode): BrandMatrix {
  const brands = category.children.filter((c) => c.kind === 'group');

  const seen = new Set<string>();
  const models: { name: string; tags: string[] }[] = [];

  for (const brand of brands) {
    for (const product of brand.children) {
      if (product.kind === 'product' && !seen.has(product.name)) {
        seen.add(product.name);
        models.push({ name: product.name, tags: product.tags ?? [] });
      }
    }
  }

  const cells: (PricelistNodeWithRelations | null)[][] = models.map((model) =>
    brands.map(
      (brand) =>
        brand.children.find((c) => c.name === model.name && c.kind === 'product') ?? null
    )
  );

  return { brands, models, cells };
}

/** Leading number in a label, e.g. "12mm" → 12; null if none. */
function sizeNum(label: string): number | null {
  const m = label.match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export interface PriceMatrix {
  /** Row labels (size/thickness/tier), numeric-aware sorted. */
  rowLabels: string[];
  /** Column products (the models). */
  products: PricelistNodeWithRelations[];
  /** Cell lookup → the price for a product at a row label, or null. */
  cell: (product: PricelistNodeWithRelations, label: string) => PricelistPrice | null;
  /** True when there's nothing but a single unnamed "Standard" tier. */
  trivial: boolean;
}

/** Build a model × size price grid for a set of products. */
export function buildPriceMatrix(products: PricelistNodeWithRelations[]): PriceMatrix {
  const labels = new Map<string, number | null>();
  for (const p of products) {
    for (const pr of p.prices) {
      if (!labels.has(pr.label)) labels.set(pr.label, sizeNum(pr.label));
    }
  }
  const rowLabels = Array.from(labels.keys()).sort((a, b) => {
    const na = labels.get(a) ?? null;
    const nb = labels.get(b) ?? null;
    if (na != null && nb != null) return na - nb;
    if (na != null) return -1;
    if (nb != null) return 1;
    return a.localeCompare(b);
  });
  const cell = (product: PricelistNodeWithRelations, label: string) =>
    product.prices.find((pr) => pr.label === label) ?? null;

  const trivial = rowLabels.length <= 1 && rowLabels.every((l) => l === 'Standard');
  return { rowLabels, products, cell, trivial };
}
