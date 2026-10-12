import { FolioShell } from "@/components/folio/shell";

export function AppShell({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return <FolioShell compact={compact}>{children}</FolioShell>;
}
