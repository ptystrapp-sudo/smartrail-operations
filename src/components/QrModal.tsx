import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  qrToken: string | null;
  ticketCode: string;
  routeLabel: string;
}

export function QrModal({ open, onClose, qrToken, ticketCode, routeLabel }: Props) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    if (open && qrToken) {
      QRCode.toDataURL(qrToken, { width: 320, margin: 1, color: { dark: "#0a0e1a", light: "#ffffff" } })
        .then(setSrc).catch(() => setSrc(""));
    }
  }, [open, qrToken]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Boarding QR</DialogTitle>
          <DialogDescription>{routeLabel}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {src ? (
            <img src={src} alt="Ticket QR" className="rounded-md bg-white p-2" width={280} height={280} />
          ) : (
            <div className="h-[280px] w-[280px] bg-muted animate-pulse rounded-md" />
          )}
          <div className="text-center">
            <div className="label-uppercase">Ticket reference</div>
            <div className="font-mono-tight text-sm break-all">{ticketCode}</div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Present this QR to the station validator. Single-use; do not share.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
