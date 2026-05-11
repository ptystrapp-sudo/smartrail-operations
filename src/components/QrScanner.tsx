import { useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface Props {
  onDecode: (text: string) => void;
  paused?: boolean;
}

export function QrScanner({ onDecode, paused }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastDecodeRef = useRef<{ text: string; ts: number }>({ text: "", ts: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const id = "smartrail-qr-region";
    ref.current.id = id;

    const scanner = new Html5Qrcode(id, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    });
    scannerRef.current = scanner;

    Html5Qrcode.getCameras().then(cams => {
      if (!cams.length) return;
      const back = cams.find(c => /back|rear|environment/i.test(c.label)) ?? cams[0];
      scanner.start(
        back.id,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          // debounce duplicate reads within 1.5s
          const now = Date.now();
          if (decoded === lastDecodeRef.current.text && now - lastDecodeRef.current.ts < 1500) return;
          lastDecodeRef.current = { text: decoded, ts: now };
          onDecode(decoded);
        },
        () => { /* ignore per-frame failures */ },
      ).catch((err) => console.error("Scanner start failed", err));
    }).catch((err) => console.error("Camera enumeration failed", err));

    return () => {
      scanner.stop().catch(() => {}).finally(() => { scanner.clear(); });
    };
  }, [onDecode]);

  useEffect(() => {
    const s = scannerRef.current;
    if (!s) return;
    if (paused) s.pause(true);
    else { try { s.resume(); } catch { /* ignore */ } }
  }, [paused]);

  return <div ref={ref} className="w-full max-w-sm aspect-square mx-auto rounded-md overflow-hidden bg-black" />;
}
