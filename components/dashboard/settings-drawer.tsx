'use client';

import { useState } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import type { Category } from '@/types/database';
import type { AuthUser } from '@/lib/auth';
import { signOut } from '@/app/(auth)/login/actions';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  categories: Category[];
}

export function SettingsDrawer({ isOpen, onClose, user, categories }: SettingsDrawerProps) {
  const isAdmin = user.profile.role === 'admin';
  const supabase = createClient();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    // The server action handles the cookie deletion and redirecting
    await signOut();
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setError(null);
  };

  const saveEdit = async (cat: Category) => {
    if (!editName.trim() || editName.trim() === cat.name) {
      cancelEdit();
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await (supabase.from('categories') as any)
        .update({ name: editName.trim() })
        .eq('id', cat.id);
      if (err) throw err;
      cancelEdit();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveNew = async () => {
    if (!newName.trim()) {
      setIsAdding(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await (supabase.from('categories') as any)
        .insert({ name: newName.trim() });
      if (err) throw err;
      setIsAdding(false);
      setNewName('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Orders using it will lose their category.')) return;
    
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('categories').delete().eq('id', id);
      if (err) throw err;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="flex flex-col h-full overflow-y-auto w-full max-w-lg mx-auto p-4 sm:p-6 pb-safe">
        
        {/* Profile Section */}
        <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 mb-6 border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
            {user.profile.full_name ? user.profile.full_name[0].toUpperCase() : (user.email?.[0]?.toUpperCase() || 'U')}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-bold text-gray-900 truncate">
              {user.profile.full_name || 'No Name Set'}
            </span>
            <span className="text-xs text-gray-500 truncate">{user.email || 'No email'}</span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-600 mt-1 inline-block bg-indigo-50 px-2 py-0.5 rounded-md w-fit">
              {user.profile.role}
            </span>
          </div>
          <div className="shrink-0">
             <Button variant="secondary" size="sm" onClick={handleSignOut} className="h-8 text-xs px-3">
               Sign Out
             </Button>
          </div>
        </div>

        {/* Categories Section (Admin) */}
        {isAdmin && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
               <h3 className="text-[14px] font-bold text-gray-900 tracking-tight">Manage Categories</h3>
               {!isAdding && (
                 <Button variant="ghost" size="sm" onClick={() => { setIsAdding(true); setError(null); }} className="h-6 text-xs px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                    + Add New
                 </Button>
               )}
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-600 text-xs p-2.5 rounded-lg border border-red-100 mt-1 mb-2">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {categories.length === 0 && !isAdding && (
                <div className="text-sm text-gray-500 text-center py-6 bg-white border border-gray-100 rounded-xl border-dashed">
                  No categories defined.
                </div>
              )}

              {categories.map((cat) => (
                <div key={cat.id} className="min-h-[52px] bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center justify-between group transition-colors hover:border-indigo-200">
                  {editingId === cat.id ? (
                    <div className="flex items-center w-full gap-2">
                      <Input 
                        label="Rename Category"
                        autoFocus 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        className="h-8 text-sm !mt-0 !mb-0"
                        onKeyDown={e => e.key === 'Enter' && saveEdit(cat)}
                      />
                      <Button size="sm" onClick={() => saveEdit(cat)} disabled={loading} className="shrink-0 h-8 px-3">Save</Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={loading} className="shrink-0 h-8 w-8 p-0 text-gray-400 hover:text-gray-600">
                         <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-gray-800 tracking-tight leading-5 py-1 truncate flex-1 min-w-0 pr-3">{cat.name}</span>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button 
                         onClick={() => startEdit(cat)}
                         className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors min-tap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" 
                         aria-label="Edit"
                        >
                          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        </button>
                        <button 
                         onClick={() => deleteCategory(cat.id)}
                         className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors min-tap focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                         aria-label="Delete"
                        >
                          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {isAdding && (
                <div className="min-h-[52px] bg-indigo-50/50 border border-indigo-200 rounded-xl px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center w-full gap-2">
                    <Input 
                      label="New Category Name"
                      autoFocus 
                      placeholder="Category name"
                      value={newName} 
                      onChange={e => setNewName(e.target.value)} 
                      className="h-8 text-sm bg-white border-indigo-100 !mt-0 !mb-0"
                      onKeyDown={e => e.key === 'Enter' && saveNew()}
                    />
                    <Button size="sm" onClick={saveNew} disabled={loading} className="shrink-0 h-8 px-3">Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewName(''); }} disabled={loading} className="shrink-0 h-8 w-8 p-0 text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        )}

      </div>
    </Drawer>
  );
}
