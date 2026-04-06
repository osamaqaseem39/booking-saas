type Opt<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly Opt<T>[];
  onChange: (next: T) => void;
  disabled?: boolean;
  /** Accessibility: short name for this control group */
  ariaLabel?: string;
};

export function TurfSetupButtonSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  ariaLabel,
}: Props<T>) {
  const groupLabel = ariaLabel ?? label;
  return (
    <div>
      <span className="muted" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
        {label}
      </span>
      <div
        className="turf-setup-btn-select"
        role="group"
        aria-label={groupLabel}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              className={
                active
                  ? 'turf-setup-btn-select__btn turf-setup-btn-select__btn--active'
                  : 'turf-setup-btn-select__btn'
              }
              aria-pressed={active}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
