import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/contracts")({
  component: ContractsLayout,
});

function ContractsLayout() {
  return <Outlet />;
}
