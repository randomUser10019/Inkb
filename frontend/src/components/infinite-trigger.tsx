import { useEffect, useRef } from "react";

export function InfiniteTrigger({
  onVisible,
  disabled,
  label,
  auto = true,
}: {
  onVisible: () => void;
  disabled?: boolean;
  label: string;
  auto?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;

  useEffect(() => {
    if (!auto || disabled) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current();
      },
      { rootMargin: "480px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [auto, disabled]);

  return (
    <div ref={ref} className="mt-6">
      <button
        type="button"
        onClick={onVisible}
        disabled={disabled}
        className="h-11 text-sm text-muted hover:text-fg disabled:opacity-60"
      >
        {label}
      </button>
    </div>
  );
}
