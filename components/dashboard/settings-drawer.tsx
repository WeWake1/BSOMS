'use client';

import { useState, useEffect } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_COLOR_OPTIONS, type CategoryColorKey, getCategoryColor } from '@/lib/category-colors';
import type { Category } from '@/types/database';
import type { AuthUser } from '@/lib/auth';
import { signOut } from '@/app/(auth)/login/actions';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  categories: Category[];
}

/** Compact color swatch picker */
function ColorPicker({ value, onChange }: { value: CategoryColorKey; onChange: (k: CategoryColorKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {CATEGORY_COLOR_OPTIONS.map(opt => (
        <button
          key={opt.key}
          type="button"
          title={opt.label}
          onClick={() => onChange(opt.key)}
          className={`w-6 h-6 rounded-full ${opt.swatch} transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-400 ${value === opt.key ? 'ring-2 ring-offset-1 ring-gray-600 scale-110' : ''}`}
        />
      ))}
    </div>
  );
}

export function SettingsDrawer({ isOpen, onClose, user, categories }: SettingsDrawerProps) {
  const isAdmin = user.profile.role === 'admin';
  const supabase = createClient();

  const [showCategories, setShowCategories] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Category editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<CategoryColorKey>('violet');

  // New category state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<CategoryColorKey>('violet');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setShowCategories(false);
      setEditingId(null);
      setIsAdding(false);
      setNewName('');
      setError(null);
    }
  }, [isOpen]);

  // Sync dark mode on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('darkMode') === 'true';
    setDarkMode(saved);
    if (saved) document.documentElement.classList.add('dark');
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSignOut = async () => { await signOut(); };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor((cat.color as CategoryColorKey) || 'violet');
    setError(null);
  };
  const cancelEdit = () => { setEditingId(null); setEditName(''); setError(null); };

  const saveEdit = async (cat: Category) => {
    if (!editName.trim()) { cancelEdit(); return; }
    setLoading(true); setError(null);
    try {
      const { error: err } = await (supabase.from('categories') as any)
        .update({ name: editName.trim(), color: editColor })
        .eq('id', cat.id);
      if (err) throw err;
      cancelEdit();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const saveNew = async () => {
    if (!newName.trim()) { setIsAdding(false); return; }
    setLoading(true); setError(null);
    try {
      const { error: err } = await (supabase.from('categories') as any)
        .insert({ name: newName.trim(), color: newColor });
      if (err) throw err;
      setIsAdding(false); setNewName(''); setNewColor('violet');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Orders using it will lose their category.')) return;
    setLoading(true); setError(null);
    try {
      const { error: err } = await supabase.from('categories').delete().eq('id', id);
      if (err) throw err;
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="flex flex-col overflow-y-auto w-full max-w-lg mx-auto p-4 sm:p-6 pb-12 gap-4">

        {/* ── Profile ──────────────────────────────── */}
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
            {user.profile.full_name ? user.profile.full_name[0].toUpperCase() : (user.email?.[0]?.toUpperCase() || 'U')}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-bold text-gray-900 truncate">{user.profile.full_name || 'No Name Set'}</span>
            <span className="text-xs text-gray-500 truncate">{user.email || 'No email'}</span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-600 mt-1 inline-block bg-indigo-50 px-2 py-0.5 rounded-md w-fit">
              {user.profile.role}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={handleSignOut} className="h-8 text-xs px-3 shrink-0">Sign Out</Button>
        </div>

        {/* ── Dark Mode ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                {darkMode
                  ? <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  : <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Dark Mode</p>
                <p className="text-xs text-gray-500">{darkMode ? 'On' : 'Off'}</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={darkMode}
              onClick={toggleDarkMode}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${darkMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* ── Manage Categories (Admin only) ─────── */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowCategories(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-tap"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">Manage Categories</p>
                  <p className="text-xs text-gray-500">{categories.length} {categories.length === 1 ? 'category' : 'categories'}</p>
                </div>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showCategories ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>

            {showCategories && (
              <div className="border-t border-gray-100 p-4 flex flex-col gap-2">
                {error && (
                  <div className="bg-red-50 text-red-600 text-xs p-2.5 rounded-lg border border-red-100 mb-1">{error}</div>
                )}

                {categories.length === 0 && !isAdding && (
                  <div className="text-sm text-gray-500 text-center py-5 border border-gray-100 rounded-xl border-dashed">No categories yet.</div>
                )}

                {categories.map((cat) => {
                  const palette = getCategoryColor(cat.id, cat.color);
                  return (
                    <div key={cat.id} className="bg-gray-50 border border-gray-200 rounded-xl group">
                      {editingId === cat.id ? (
                        <div className="p-3 flex flex-col gap-2">
                          <Input label="Rename Category" autoFocus value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm !mt-0" onKeyDown={e => e.key === 'Enter' && saveEdit(cat)} />
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Color</p>
                            <ColorPicker value={editColor} onChange={setEditColor} />
                          </div>
                          <div className="flex gap-2 mt-1">
                            <Button size="sm" onClick={() => saveEdit(cat)} disabled={loading} className="flex-1 h-8">Save</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={loading} className="h-8 px-3 text-gray-500">Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 py-2.5 flex items-center justify-between min-h-[48px]">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${palette.dot}`} />
                            <span className={`text-sm font-semibold px-2 py-0.5 rounded-md border ${palette.bg} ${palette.text} ${palette.border} truncate`}>{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                            <button onClick={() => startEdit(cat)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors min-tap" aria-label="Edit">
                              <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            </button>
                            <button onClick={() => deleteCategory(cat.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors min-tap" aria-label="Delete">
                              <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {isAdding ? (
                  <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-3 flex flex-col gap-2">
                    <Input label="Category Name" autoFocus placeholder="e.g. Furniture" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-sm !mt-0" onKeyDown={e => e.key === 'Enter' && saveNew()} />
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">Pick a color</p>
                      <ColorPicker value={newColor} onChange={setNewColor} />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" onClick={saveNew} disabled={loading} className="flex-1 h-8">Add Category</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewName(''); setNewColor('violet'); }} className="h-8 px-3 text-gray-500">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setIsAdding(true); setError(null); }}
                    className="w-full h-10 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors min-tap flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Category
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </Drawer>
  );
}
