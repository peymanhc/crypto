import { useState } from 'react';
import { CustomStrategy } from '../types/strategy';
import { loadStrategies, saveStrategies, loadActiveStrategyId, saveActiveStrategyId } from '../lib/strategies/storage';

const newId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// The user's saved strategies from the Builder tab, plus which one is active
export const useStrategies = () => {
  const [strategies, setStrategies] = useState<CustomStrategy[]>(loadStrategies);
  const [activeId, setActiveState] = useState<string | null>(loadActiveStrategyId);
  // The one open in the editor (defaults to the active one)
  const [selectedId, setSelectedId] = useState<string | null>(() => loadActiveStrategyId() ?? loadStrategies()[0]?.id ?? null);

  const persist = (list: CustomStrategy[]) => {
    setStrategies(list);
    saveStrategies(list);
  };

  const setActive = (id: string | null) => {
    setActiveState(id);
    saveActiveStrategyId(id);
  };

  const create = (name: string): CustomStrategy => {
    const strategy: CustomStrategy = { id: newId(), name, rules: [], minScore: 1, updatedAt: Date.now() };
    persist([...strategies, strategy]);
    setSelectedId(strategy.id);
    if (!activeId) setActive(strategy.id);
    return strategy;
  };

  const update = (strategy: CustomStrategy) =>
    persist(strategies.map((s) => (s.id === strategy.id ? { ...strategy, updatedAt: Date.now() } : s)));

  const duplicate = (id: string) => {
    const source = strategies.find((s) => s.id === id);
    if (!source) return;
    const copy: CustomStrategy = { ...source, id: newId(), name: `${source.name} (2)`, updatedAt: Date.now() };
    persist([...strategies, copy]);
    setSelectedId(copy.id);
  };

  const remove = (id: string) => {
    const rest = strategies.filter((s) => s.id !== id);
    persist(rest);
    if (selectedId === id) setSelectedId(rest[0]?.id ?? null);
    if (activeId === id) setActive(rest[0]?.id ?? null);
  };

  const selected = strategies.find((s) => s.id === selectedId) ?? null;
  const active = strategies.find((s) => s.id === activeId) ?? strategies[0] ?? null;

  return { strategies, active, activeId, selected, selectedId, setSelectedId, setActive, create, update, duplicate, remove };
};
