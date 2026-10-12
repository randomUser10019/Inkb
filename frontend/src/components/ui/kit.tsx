import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { toast } from "sonner";

export { toast };

export function Toast({ title, body }: { title: string; body?: string }) {
  return (
    <div role="status" className="ui-toast">
      <p className="font-semibold">{title}</p>
      {body ? <p className="mt-1 text-sm text-muted">{body}</p> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "quiet" | "danger";
type ButtonSize = "md" | "sm";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  quiet = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  quiet?: boolean;
}) {
  const look = quiet ? "quiet" : variant;
  return (
    <button
      className={`btn${look === "quiet" ? " is-quiet" : ""}${look === "danger" ? " is-danger" : ""}${size === "sm" ? " is-sm" : ""} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="sr-only">Working</span> : null}
      {children}
    </button>
  );
}

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ui-card ${className}`} {...props}>
      {children}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...props },
  ref,
) {
  return <input ref={ref} className={`ui-input ${className}`} {...props} />;
});

export function Tabs({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          className="ui-tab"
          aria-selected={value === tab.id}
          aria-controls={`panel-${tab.id}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}

function focusable(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
}

export function Dialog({
  title,
  titleId,
  kicker,
  onClose,
  onEscape,
  children,
  busy = false,
  align = "center",
}: {
  title: string;
  titleId?: string;
  kicker?: string;
  onClose: () => void;
  onEscape?: () => void;
  children: ReactNode;
  busy?: boolean;
  align?: "center" | "end";
}) {
  const autoId = useId();
  const labelId = titleId ?? autoId;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onEscapeRef = useRef(onEscape);
  onCloseRef.current = onClose;
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    focusable(root ?? document.body)[0]?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        (onEscapeRef.current ?? onCloseRef.current)();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const nodes = focusable(root);
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus();
    };
  }, []);

  return (
    <div className={`ui-dialog-backdrop${align === "end" ? " is-end" : ""}`}>
      <button
        type="button"
        className="ui-dialog-scrim"
        aria-label="Close"
        disabled={busy}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-busy={busy || undefined}
      >
        {kicker ? <p className="text-xs font-semibold tracking-wide text-muted uppercase">{kicker}</p> : null}
        <h2 id={labelId} className="font-serif text-xl">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden="true" />;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ui-card text-center" role="status">
      <p className="text-h3">{title}</p>
      {body ? <p className="mt-2 text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "live";
}) {
  return <span className={`ui-badge is-${tone}`}>{children}</span>;
}

export function Progress({
  value,
  label,
  variant = "bar",
}: {
  value: number;
  label: string;
  variant?: "bar" | "ring";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  if (variant === "ring") {
    return (
      <div
        className="ui-ring"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
        style={{ background: `conic-gradient(var(--color-accent) ${pct * 3.6}deg, var(--color-line) 0)` }}
      >
        <span>{pct}</span>
      </div>
    );
  }
  return (
    <div className="ui-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`ui-switch${checked ? " is-on" : ""}`}
      onClick={() => onCheckedChange(!checked)}
    >
      <span aria-hidden="true" />
      {label}
    </button>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <label className="ui-select" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="ui-tip">
      {children}
      <span role="tooltip">{label}</span>
    </span>
  );
}

export function Menu({
  label,
  items,
}: {
  label: string;
  items: { id: string; label: string; onSelect: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  return (
    <div className="ui-menu">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open ? (
        <div role="menu" aria-label={label}>
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((n) => (n + 1) % items.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((n) => (n - 1 + items.length) % items.length);
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
