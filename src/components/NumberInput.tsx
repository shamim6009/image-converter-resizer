import { useEffect, useRef, useState } from 'react';

interface NumberInputProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  placeholder?: string;
}

export function NumberInput({
  id,
  label,
  value,
  onChange,
  min = 1,
  max = 16384,
  step = 1,
  suffix = 'px',
  hint,
  disabled = false,
  allowEmpty = false,
  placeholder,
}: NumberInputProps) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(value === null ? '' : String(value));
    }
  }, [value]);

  const commit = (raw: string) => {
    if (raw.trim() === '') {
      onChange(null);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
  };

  return (
    <div className={`number-field ${disabled ? 'is-disabled' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="number-input-wrap">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onFocus={() => {
            focused.current = true;
          }}
          onChange={(event) => {
            const raw = event.target.value;
            setText(raw);
            commit(raw);
          }}
          onBlur={() => {
            focused.current = false;
            if (text.trim() === '') {
              setText(allowEmpty ? '' : String(value ?? min));
              if (!allowEmpty && value === null) onChange(min);
              return;
            }
            const parsed = Number(text);
            if (!Number.isFinite(parsed)) {
              setText(value === null ? '' : String(value));
              return;
            }
            const clamped = Math.min(max, Math.max(min, parsed));
            setText(String(clamped));
            onChange(clamped);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        {suffix ? <span className="input-suffix">{suffix}</span> : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
