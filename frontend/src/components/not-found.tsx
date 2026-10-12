import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/kit";
import { COPY } from "@inkboard/shared/copy";

export function NotFoundPage() {
  return (
    <AppShell>
      <div className="board-pad py-16">
        <EmptyState
          title={COPY.pageNotOnBoard}
          body={COPY.pageMissing}
          action={
            <Link to="/" className="btn">
              {COPY.backToTheWall}
            </Link>
          }
        />
      </div>
    </AppShell>
  );
}