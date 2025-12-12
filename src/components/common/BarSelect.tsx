interface BarSelectOption<T extends string> {
  value: T;
  label: string;
}

interface BarSelectProps<T extends string> {
  options: BarSelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

function BarSelect<T extends string>({
  options,
  value,
  onChange,
}: BarSelectProps<T>) {
  return (
    <div className="bar-select-group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`bar-select-button ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default BarSelect;
