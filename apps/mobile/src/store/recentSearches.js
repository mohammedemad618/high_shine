import { create } from 'zustand';

const MAX = 6;

/** Recent search terms for this app session (kept in memory only). */
export const useRecentSearches = create((set) => ({
  terms: [],
  add(term) {
    const t = term.trim();
    if (!t) return;
    set((s) => ({ terms: [t, ...s.terms.filter((x) => x !== t)].slice(0, MAX) }));
  },
  clear() {
    set({ terms: [] });
  },
}));
