import type { Category, OrderStatus } from '@/types/database';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  selectedStatus: OrderStatus | 'All';
  setSelectedStatus: (s: OrderStatus | 'All') => void;
  categories: Category[];
  onClear: () => void;
  resultCount: number;
  sortBy: string;
  setSortBy: (s: any) => void;
  viewMode: 'card' | 'list';
  setViewMode: (v: 'card' | 'list') => void;
}

export function FilterBar({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedStatus,
  categories,
  onClear,
  resultCount,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
}: FilterBarProps) {
  const hasFilters = searchQuery !== '' || selectedCategory !== 'All' || selectedStatus !== 'All';

  return (
    <div className="sticky top-0 z-40 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border shadow-sm mb-4 transition-colors duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* View Toggle & Search */}
        <div className="flex gap-2 w-full sm:w-auto sm:flex-1">
          <div className="flex bg-muted p-[3px] rounded-xl h-11 border border-border shrink-0">
            <button
              onClick={() => setViewMode('card')}
              className={`h-full px-3 rounded-lg transition-colors flex items-center justify-center focus-visible:outline-none focus:ring-2 focus:ring-indigo-500 ${viewMode === 'card' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Grid View"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`h-full px-3 rounded-lg transition-colors flex items-center justify-center focus-visible:outline-none focus:ring-2 focus:ring-indigo-500 ${viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="List View"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
            </button>
          </div>
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="w-[18px] h-[18px] text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-card text-foreground text-sm focus:ring-2 focus:ring-indigo-500 shadow-sm transition-colors placeholder:text-muted-foreground outline-none focus-visible:outline-none"
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            className="h-11 px-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat transition-colors flex-1 sm:flex-none sm:min-w-[140px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-11 px-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none pr-8 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat transition-colors flex-1 sm:flex-none sm:min-w-[140px]"
            aria-label="Sort options"
          >
            <option value="date-desc">Date (New)</option>
            <option value="date-asc">Date (Old)</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="order-asc">Order #</option>
          </select>
        </div>

        {/* Result count + Clear */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-md whitespace-nowrap transition-colors">
            {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </span>
          {hasFilters && (
            <button
              onClick={onClear}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 min-tap px-1 whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
