import { useState, type ChangeEvent, type FocusEvent, type CSSProperties } from 'react';

/**
 * Number input that tracks its own draft string while focused, so clearing the
 * field and typing behaves normally instead of the committed value (often 0)
 * re-rendering back into the box between keystrokes and getting typed onto.
 */
export function NumberInput({
  value,
  onCommit,
  className,
  style,
  step,
  min,
  max,
  emptyFallback = 0
}: {
  value: number;
  onCommit: (n: number) => void;
  className?: string;
  style?: CSSProperties;
  step?: number | 'any';
  min?: number;
  max?: number;
  emptyFallback?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDraft(text);
    if (text !== '' && text !== '-') {
      const n = Number(text);
      if (!Number.isNaN(n)) onCommit(n);
    }
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleBlur = () => {
    if (draft === '' || draft === '-') onCommit(emptyFallback);
    setDraft(null);
  };

  return (
    <input
      className={className}
      style={style}
      type="number"
      step={step ?? 'any'}
      min={min}
      max={max}
      value={draft !== null ? draft : value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}
