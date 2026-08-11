import { Icon } from "@/components/icon";

export interface SelectOption {
  value: string;
  label: string;
}

// The site's one select. Both filter clusters -- the homepage corpus console
// and the Explorer's quick filters -- used to render different components
// (native <select> on one, a Base UI popover Select on the other) styled to
// look identical at rest, so they read as the same control right up until you
// opened one and got a different menu, font and keyboard model.
//
// Settled on the native element: it inherits the OS picker on touch (a far
// better experience for the Explorer's long "collection" and "topic" lists
// than a scrolling popover), it needs no client JS, and `color-scheme` on the
// root already gives it the correct light/dark rendering. The chevron is ours
// so the resting state still matches the rest of the chrome.
export function SelectField({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible name — these filters sit in a toolbar with no visible label. */
  label: string;
  className?: string;
}) {
  return (
    <div
      className={
        "relative inline-flex h-10 items-center rounded-full border border-border-control bg-surface " +
        "focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/40 " +
        className
      }
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-full w-full cursor-pointer appearance-none rounded-full bg-transparent py-0 pl-3.5 pr-9 text-sm text-text outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        size={14}
        className="pointer-events-none absolute right-3 text-text-subtle"
      />
    </div>
  );
}

// The matching text input, so the search boxes and the selects share one
// resting style and one focus treatment. The ring lives on the wrapper
// because the wrapper is what the user perceives as the control: the bare
// <input> carried `outline-none` and the pill had no :focus-within rule, so
// tabbing into either search box changed nothing on screen at all -- a
// straight WCAG 2.2 SC 2.4.7 (Focus Visible, Level A) failure on the two
// most-used controls on the site.
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={
        "flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-border-control bg-surface px-3.5 " +
        "focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/40 " +
        className
      }
    >
      <Icon name="search" size={15} className="shrink-0 text-text-subtle" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-full flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
      />
    </div>
  );
}
