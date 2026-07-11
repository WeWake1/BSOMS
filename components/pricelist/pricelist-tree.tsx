'use client';

import { cn } from '@/lib/utils';
import { formatPrice, formatSize, lowestPrice } from '@/lib/pricelist-utils';
import type {
  PricelistTreeNode,
  PricelistNodeWithRelations,
} from '@/types/database';

interface PricelistTreeProps {
  nodes: PricelistTreeNode[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelectProduct: (node: PricelistNodeWithRelations, path: string[]) => void;
  /** Quote mode — show checkboxes on products. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (node: PricelistNodeWithRelations) => void;
  /** Admin controls (hidden in quote mode). */
  isAdmin?: boolean;
  onAddChild?: (parent: PricelistTreeNode) => void;
  onEditNode?: (node: PricelistTreeNode) => void;
  onDeleteNode?: (node: PricelistTreeNode) => void;
  /** Internal: accumulated ancestor names. */
  path?: string[];
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function priceLabel(node: PricelistNodeWithRelations): string | null {
  const lo = lowestPrice(node.prices);
  if (!lo) return null;
  return node.prices.length > 1 ? `from ${formatPrice(lo)}` : formatPrice(lo);
}

export function PricelistTree(props: PricelistTreeProps) {
  const {
    nodes,
    expanded,
    onToggle,
    onSelectProduct,
    selectable = false,
    selectedIds,
    onToggleSelect,
    isAdmin = false,
    onAddChild,
    onEditNode,
    onDeleteNode,
    path = [],
  } = props;

  const adminActive = isAdmin && !selectable;

  return (
    <ul className="flex flex-col">
      {nodes.map((node) => {
        const indent = { paddingLeft: `${node.depth * 16 + 12}px` };

        if (node.kind === 'group') {
          const isOpen = expanded.has(node.id);
          return (
            <li key={node.id}>
              <div className="flex items-center rounded-xl hover:bg-muted/60 transition-colors group">
                <button
                  type="button"
                  onClick={() => onToggle(node.id)}
                  aria-expanded={isOpen}
                  className="flex items-center gap-2 py-3 pr-2 flex-1 min-w-0 text-left min-tap"
                  style={indent}
                >
                  <ChevronRight
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform shrink-0',
                      isOpen && 'rotate-90'
                    )}
                  />
                  <svg className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-sm font-bold text-foreground flex-1 min-w-0 truncate">
                    {node.name}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
                    {node.children.length}
                  </span>
                </button>

                {adminActive && (
                  <div className="flex items-center gap-0.5 pr-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onAddChild?.(node)}
                      aria-label={node.depth === 0 ? `Add brand to ${node.name}` : `Add variety to ${node.name}`}
                      className="h-7 px-2 flex items-center gap-1 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors min-tap"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      {node.depth === 0 ? 'Brand' : 'Variety'}
                    </button>
                    <button type="button" onClick={() => onEditNode?.(node)} aria-label={`Edit ${node.name}`} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors min-tap">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </button>
                    <button type="button" onClick={() => onDeleteNode?.(node)} aria-label={`Delete ${node.name}`} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors min-tap">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                )}
              </div>

              {isOpen && node.children.length > 0 && (
                <PricelistTree
                  {...props}
                  nodes={node.children}
                  path={[...path, node.name]}
                />
              )}
            </li>
          );
        }

        // product leaf
        const pl = priceLabel(node);
        const size = formatSize(node);
        const checked = selectedIds?.has(node.id) ?? false;

        return (
          <li key={node.id}>
            <div
              className="flex items-center gap-2 py-2.5 pr-2 rounded-xl hover:bg-muted/40 transition-colors"
              style={indent}
            >
              {selectable && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Select ${node.name}`}
                  onClick={() => onToggleSelect?.(node)}
                  className={cn(
                    'w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors min-tap',
                    checked
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-border bg-card'
                  )}
                >
                  {checked && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectProduct(node, [...path])}
                className="flex items-center gap-2 flex-1 min-w-0 text-left min-tap"
              >
                <svg className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {node.name}
                  </span>
                  {size && (
                    <span className="text-xs text-muted-foreground truncate">
                      {size}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-foreground tabular-nums shrink-0">
                  {pl ?? <span className="text-muted-foreground font-medium">—</span>}
                </span>
                {!adminActive && <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
              </button>

              {adminActive && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button" onClick={() => onEditNode?.(node)} aria-label={`Edit ${node.name}`} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors min-tap">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  </button>
                  <button type="button" onClick={() => onDeleteNode?.(node)} aria-label={`Delete ${node.name}`} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors min-tap">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
