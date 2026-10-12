import { useTheme } from "@/components/theme-provider.tsx";
import type { ThemeMode } from "@inkboard/shared/theme";

const OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: "system", label: "Match device" },
  { id: "dark", label: "Iron" },
  { id: "light", label: "Bone" },
];

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();
  return (
    <div className="theme-lamp caption-toggle" role="group" aria-label="Theme">
      {OPTIONS.map((o) => {
        const on = mode === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => setMode(o.id)}
            className={`caption-opt${on ? " is-on" : ""}`}
          >
            {compact ? o.label.split(" ")[0] : o.label}
          </button>
        );
      })}
    </div>
  );
}
