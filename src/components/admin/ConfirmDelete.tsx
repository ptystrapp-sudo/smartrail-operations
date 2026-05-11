import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfirmDelete({
  open,
  onOpenChange,
  onConfirm,
  entityLabel,
  description,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void | Promise<void>;
  entityLabel: string;
  description?: ReactNode;
  busy?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const ok = typed.trim().toUpperCase() === "DELETE";
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setTyped("");
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permanently delete {entityLabel}?</DialogTitle>
          <DialogDescription>
            {description ??
              "This is a destructive operational change. The record and its associated history will be removed from the live network."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">
            Type <span className="font-mono text-destructive">DELETE</span> to confirm
          </Label>
          <Input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!ok || busy}
            onClick={async () => {
              await onConfirm();
              setTyped("");
            }}
          >
            {busy ? "Removing…" : "Permanently delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
