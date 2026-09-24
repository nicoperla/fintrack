import {
  CATEGORY_COLORS,
  CATEGORY_ICON_NAMES,
  CATEGORY_ICONS,
  type CategoryIconName,
} from "@/lib/category-style";
import { cn } from "@/lib/utils";

export function IconPicker({
  value,
  color,
  onChange,
  error,
  icons = CATEGORY_ICON_NAMES,
}: {
  value: string;
  color: string;
  onChange: (icon: CategoryIconName) => void;
  error?: string;
  icons?: readonly CategoryIconName[];
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Icona</legend>
      <div className="grid grid-cols-8 gap-1.5">
        {icons.map((iconName) => {
          const Icon = CATEGORY_ICONS[iconName];
          const selected = value === iconName;
          return (
            <label
              key={iconName}
              title={iconName}
              className={cn(
                "hover:bg-muted has-focus-visible:ring-ring/50 flex aspect-square cursor-pointer items-center justify-center rounded-md border border-transparent transition-colors has-focus-visible:ring-3",
                selected && "border-foreground/20 bg-muted",
              )}
              style={selected ? { color } : undefined}
            >
              <input
                type="radio"
                name="icon"
                value={iconName}
                checked={selected}
                onChange={() => onChange(iconName)}
                className="sr-only"
              />
              <Icon className="size-4" aria-hidden />
              <span className="sr-only">{iconName}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
    </fieldset>
  );
}

export function ColorPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (color: string) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Colore</legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_COLORS.map((c) => (
          <label
            key={c}
            className={cn(
              "has-focus-visible:ring-ring/50 flex size-7 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-(--popover) has-focus-visible:ring-3",
              value === c && "ring-foreground/60 ring-2",
            )}
            style={{ backgroundColor: c }}
          >
            <input
              type="radio"
              name="color"
              value={c}
              checked={value === c}
              onChange={() => onChange(c)}
              className="sr-only"
            />
            <span className="sr-only">{c}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
    </fieldset>
  );
}
