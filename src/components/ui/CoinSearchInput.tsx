import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

interface CoinSearchInputProps {
  value: string;
  suggestions: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  // Called with the pair to add: a tapped suggestion, or the typed text / first suggestion
  onAdd: (value: string) => void;
}

// Search box with its own dropdown and an explicit "+" button. Browsers' native
// <datalist> is unreliable on phones (no list on iOS, no Enter key), so this draws
// the list itself and never depends on the Enter key.
const CoinSearchInput: React.FC<CoinSearchInputProps> = ({ value, suggestions, placeholder, disabled, onChange, onAdd }) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const showList = open && suggestions.length > 0;

  useEffect(() => setHighlighted(0), [suggestions.length, value]);

  useEffect(() => {
    const item = listRef.current?.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const add = (pair: string) => {
    onAdd(pair);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add(showList ? suggestions[Math.min(highlighted, suggestions.length - 1)] : value);
    } else if (e.key === 'ArrowDown' && showList) {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={value}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="done"
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // A short delay lets a tap on a suggestion register before the list closes
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="field min-w-0 flex-1 !py-1.5 font-mono text-xs"
        />
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={() => add(suggestions[0] ?? value)}
          className="btn-ghost !px-2.5 !py-1.5"
          aria-label="Add"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {showList && (
        <ul
          ref={listRef}
          className="absolute z-30 mt-1.5 max-h-48 w-full overflow-y-auto rounded-xl border border-white/10 bg-ink-800/95 p-1 text-sm shadow-2xl backdrop-blur-xl"
        >
          {suggestions.map((pair, index) => (
            <li
              key={pair}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(pair)}
              onMouseEnter={() => setHighlighted(index)}
              className={`cursor-pointer rounded-lg px-3 py-2 font-mono transition-colors ${
                index === highlighted ? 'bg-glow-cyan/15 text-white' : 'text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              {pair}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CoinSearchInput;
