import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-border rounded-md p-10 text-center">
      <Inbox className="h-8 w-8 mx-auto text-muted-foreground" />
      <div className="mt-3 text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
