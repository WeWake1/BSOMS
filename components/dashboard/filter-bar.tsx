'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Category, OrderStatus } from '@/types/database';
import { Select, SelectItem, SelectTrigger, SelectValue, SelectPopover, SelectListBox } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategories: string[];
  setSelectedCategories: (c: string[]) => void;
  selectedStatus: OrderStatus | 'All';
  setSelectedStatus: (s: OrderStatus | 'All') => void;
  categories: Category[];
  onClear: () => void;
  resultCount: number;
  totalCount: number;
  sortBy: string;
  setSortBy: (s: any) => void;
  viewMode: 'card' | 'list';
  setViewMode: (v: 'card' | 'list') => void;
  // All customer names for autocomplete
  allCustomerNames?: string[];
}

export function FilterBar({
  searchQuery,
  setSearchQuery,
  selectedCategories,
  setSelectedCategories,
  selectedStatus,
  setSelectedStatus,
  categories,
  onClear,
  resultCount,
  totalCount,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  allCustomerNames = [],
}: FilterBarProps) {
  const hasFilters = searchQuery !== '' || selectedCategories.length > 0 || selectedStatus !== 'All';
  const isStatusActive = selectedStatus !== 'All';
  const isCategoryActive = selectedCategories.length > 0;

  // ── Category multi-select dropdown ────────────────────────────────────────
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [catPos, setCatPos] = useState({ top: 0, left: 0, width: 0 });
  const catButtonRef = useRef<HTMLButtonElement>(null);
  const catDropdownRef = useRef<HTMLDivElement>(null);

  const openCatDropdown = () => {
    if (catButtonRef.current) {
      const r = catButtonRef.current.getBoundingClientRect();
      setCatPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setIsCatOpen(true);
  };

  useEffect(() => {
    if (!isCatOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideButton = catButtonRef.current?.contains(target);
      const insideDropdown = catDropdownRef.current?.contains(target);
      if (!insideButton && !insideDropdown) {
        setIsCatOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isCatOpen]);

  const toggleCategory = (id: string) => {
    setSelectedCategories(
      selectedCategories.includes(id)
        ? selectedCategories.filter((c) => c !== id)
        : [...selectedCategories, id]
    );
  };

  const catLabel = selectedCategories.length === 0
    ? 'All Categories'
    : selectedCategories.length === 1
      ? (categories.find((c) => c.id === selectedCategories[0])?.name ?? '1 Category')
      : `${selectedCategories.length} Categories`;

  // ── Autocomplete state ─────────────────────────────────────────────────────
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    // Unique names that start with the query prefix (or contain it)
    const seen = new Set<string>();
    return allCustomerNames
      .filter((name) => {
        const n = name.toLowerCase();
        if (!n.includes(q)) return false;
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      })
      .sort((a, b) => {
        // Prioritise prefix matches above contains matches
        const aStarts = a.toLowerCase().startsWith(q);
        const bStarts = b.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 6);
  }, [searchQuery, allCustomerNames]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSuggestionSelect = (name: string) => {
    setSearchQuery(name);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      handleSuggestionSelect(suggestions[activeSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  // Highlight matched portion of the suggestion
  const highlightMatch = (text: string, query: string) => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <>
        <span className="text-muted-foreground">{text.slice(0, idx)}</span>
        <span className="text-foreground font-bold">{text.slice(idx, idx + query.length)}</span>
        <span className="text-muted-foreground">{text.slice(idx + query.length)}</span>
      </>
    );
  };

  return (
    <div className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border shadow-sm mb-4 transition-colors duration-200">
      <div className="flex flex-col gap-2">

        {/* Row 1: View toggle + Search */}
        <div className="flex gap-2 w-full">
          {/* L4: min-w-[44px] on toggle buttons */}
          <div className="flex bg-muted p-[3px] rounded-xl h-11 border border-border shrink-0">
            <button
              onClick={() => setViewMode('card')}
              className={`h-full min-w-[44px] px-3 rounded-lg transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'card' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Card View"
              aria-pressed={viewMode === 'card'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`h-full min-w-[44px] px-3 rounded-lg transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="List View"
              aria-pressed={viewMode === 'list'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
            </button>
          </div>

          {/* Search with autocomplete */}
          <div className="relative flex-1 transition-all duration-200" ref={searchRef}>
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="w-[18px] h-[18px] text-muted-foreground transition-colors duration-200 [[data-focused]_&]:text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              aria-label="Search orders"
              aria-autocomplete="list"
              aria-controls="search-suggestions"
              aria-expanded={showSuggestions && suggestions.length > 0}
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
                setActiveSuggestionIndex(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              className="block w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-card text-foreground text-sm focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] placeholder:text-muted-foreground outline-none"
            />

            {/* Autocomplete suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul
                id="search-suggestions"
                role="listbox"
                aria-label="Customer name suggestions"
                className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
              >
                {suggestions.map((name, idx) => (
                  <li
                    key={name}
                    role="option"
                    aria-selected={idx === activeSuggestionIndex}
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent input blur before click
                      handleSuggestionSelect(name);
                    }}
                    onMouseEnter={() => setActiveSuggestionIndex(idx)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2.5 text-sm cursor-pointer transition-colors border-b border-border/40 last:border-b-0",
                      idx === activeSuggestionIndex
                        ? "bg-primary/8 text-primary"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <span>{highlightMatch(name, searchQuery.trim())}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Row 2: Status + Category + Sort + Result count + Clear */}
        <div className="flex gap-2 w-full overflow-x-auto">
          {/* Feature 3: Active filter gets border-primary highlight */}
          <Select
            aria-label="Filter by status"
            selectedKey={selectedStatus}
            onSelectionChange={(k) => setSelectedStatus(k as OrderStatus | 'All')}
          >
            <SelectTrigger className={cn(
              "h-9 px-3 rounded-xl border border-border bg-card text-foreground text-xs font-semibold shadow-sm shrink-0 min-w-[120px] transition-colors duration-150",
              isStatusActive && "filter-active"
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectPopover>
              <SelectListBox>
                <SelectItem id="All">All Statuses</SelectItem>
                <SelectItem id="Pending">Pending</SelectItem>
                <SelectItem id="In Progress">In Progress</SelectItem>
                <SelectItem id="Packing">Packing</SelectItem>
                <SelectItem id="Dispatched">Dispatched</SelectItem>
              </SelectListBox>
            </SelectPopover>
          </Select>

          <div className="relative shrink-0">
            <button
              ref={catButtonRef}
              aria-label="Filter by category"
              aria-haspopup="listbox"
              aria-expanded={isCatOpen}
              onClick={() => isCatOpen ? setIsCatOpen(false) : openCatDropdown()}
              className={cn(
                "h-9 px-3 rounded-xl border border-border bg-card text-foreground text-xs font-semibold shadow-sm min-w-[120px] max-w-[160px] transition-colors duration-150 flex items-center justify-between gap-1.5",
                isCategoryActive && "filter-active"
              )}
            >
              <span className="truncate">{catLabel}</span>
              <svg className={cn("w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-150", isCatOpen && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {isCatOpen && typeof document !== 'undefined' && createPortal(
              <div
                ref={catDropdownRef}
                style={{ position: 'fixed', top: catPos.top, left: catPos.left, minWidth: Math.max(catPos.width, 180), zIndex: 9999 }}
                className="bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
              >
                {selectedCategories.length > 0 && (
                  <div className="px-3 pt-2 pb-1 border-b border-border">
                    <button
                      onMouseDown={(e) => { e.preventDefault(); setSelectedCategories([]); }}
                      className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                )}
                <ul role="listbox" aria-multiselectable="true" aria-label="Filter by category" className="py-1 max-h-60 overflow-y-auto">
                  {categories.map((c) => {
                    const checked = selectedCategories.includes(c.id);
                    return (
                      <li key={c.id} role="option" aria-selected={checked}>
                        <button
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors",
                            checked ? "text-primary bg-primary/8 font-semibold" : "text-foreground hover:bg-muted"
                          )}
                          onMouseDown={(e) => { e.preventDefault(); toggleCategory(c.id); }}
                        >
                          <span className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            checked ? "bg-primary border-primary" : "border-muted-foreground/40"
                          )}>
                            {checked && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span className="truncate">{c.name}</span>
                        </button>
                      </li>
                    );
                  })}
                  {categories.length === 0 && (
                    <li className="px-3.5 py-2.5 text-sm text-muted-foreground">No categories</li>
                  )}
                </ul>
              </div>,
              document.body
            )}
          </div>

          <Select
            aria-label="Sort options"
            selectedKey={sortBy}
            onSelectionChange={(k) => setSortBy(k as string)}
          >
            <SelectTrigger className="h-9 px-3 rounded-xl border border-border bg-card text-foreground text-xs font-semibold shadow-sm shrink-0 min-w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectPopover>
              <SelectListBox>
                <SelectItem id="date-desc">Date (New)</SelectItem>
                <SelectItem id="date-asc">Date (Old)</SelectItem>
                <SelectItem id="name-asc">Name (A-Z)</SelectItem>
                <SelectItem id="name-desc">Name (Z-A)</SelectItem>
                <SelectItem id="order-asc">Order #</SelectItem>
              </SelectListBox>
            </SelectPopover>
          </Select>

          {/* Result count + L3: min-w-[44px] on Clear button */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-md whitespace-nowrap">
              {hasFilters && resultCount !== totalCount
                ? `${resultCount} of ${totalCount} orders`
                : `${resultCount} order${resultCount !== 1 ? 's' : ''}`}
            </span>
            {hasFilters && (
              <button
                onClick={onClear}
                className="text-xs font-semibold text-primary hover:text-primary/80 min-w-[44px] min-h-[36px] px-2 whitespace-nowrap rounded-lg hover:bg-primary/10 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
