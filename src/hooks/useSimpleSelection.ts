import { useState } from 'react';
import { SimpleSelection } from '../types/strategy';
import { loadSimple, saveSimple } from '../lib/strategies/storage';

// Which presets are switched on in the Strategies tab, and how many must agree
export const useSimpleSelection = () => {
  const [selection, setSelection] = useState<SimpleSelection>(loadSimple);

  const update = (next: SimpleSelection) => {
    setSelection(next);
    saveSimple(next);
  };

  const toggle = (id: string) => {
    const enabled = selection.enabled.includes(id) ? selection.enabled.filter((x) => x !== id) : [...selection.enabled, id];
    update({ ...selection, enabled });
  };

  const setMinAgree = (minAgree: number) => update({ ...selection, minAgree: Math.max(1, Math.round(minAgree)) });

  return { selection, toggle, setMinAgree };
};
