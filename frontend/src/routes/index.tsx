import { createFileRoute } from "@tanstack/react-router";
import { lazyPage } from "./lazy-page";

export const Route = createFileRoute("/")({
  component: lazyPage(() => import("@/pages/home-page")),
});
