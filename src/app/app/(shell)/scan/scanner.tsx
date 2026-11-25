"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import { ActionForm, Field, Submit } from "@/components/form";
import { Button } from "@/components/ui";
import type { ActionState } from "@/server/action";

type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
declare global {
  interface Window { BarcodeDetector?: new (o: { formats: string[] }) => Detector }
}

/**
 * Camera scanning via the native BarcodeDetector API (Chrome/Android, recent Safari).
 * Falls back to typing the inventory number; both paths resolve on the server.
 */
export function Scanner({ action }: { action: (s: ActionState, fd: FormData) => Promise<ActionState> }) {
  const video = useRef<HTMLVideoElement>(null);
  const form = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSupported(typeof window !== "undefined" && !!window.BarcodeDetector && !!navigator.mediaDevices), []);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0]?.rawValue) {
            stopped = true;
            navigator.vibrate?.(30);
            const input = form.current?.querySelector<HTMLInputElement>("input[name=code]");
            if (input) {
              input.value = codes[0].rawValue;
              startTransition(() => input.form?.requestSubmit());
            }
            return;
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Dostop do kamere ni dovoljen. Vnesite številko ročno.");
        setActive(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return (
    <div className="space-y-6">
      {supported && (
        <div className="overflow-hidden rounded-md border border-line bg-ink">
          {active ? (
            <div className="relative aspect-[4/3] sm:aspect-video">
              <video ref={video} playsInline muted className="h-full w-full object-cover" />
              <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="size-56 rounded-lg border-2 border-amber/90 shadow-[0_0_0_100vmax_rgb(22_25_29/0.45)]" />
              </div>
              <Button variant="secondary" size="sm" className="absolute right-3 bottom-3" onClick={() => setActive(false)}>Ustavi</Button>
            </div>
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-4 p-6 text-center text-white sm:aspect-video">
              <p className="max-w-xs text-sm text-white/70">Usmerite kamero v QR nalepko na opremi.</p>
              <Button variant="amber" size="lg" onClick={() => { setError(null); setActive(true); }}>Vklopi kamero</Button>
            </div>
          )}
        </div>
      )}
      {supported === false && <p className="text-sm text-steel">Ta brskalnik ne podpira skeniranja s kamero. Uporabite kamero telefona (odpre povezavo na nalepki) ali vnesite številko spodaj.</p>}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div ref={form}>
        <ActionForm action={action} className="flex items-end gap-2">
          <Field name="code" label="Inventarna ali serijska številka" placeholder="npr. KLD-003" autoComplete="off" autoCapitalize="characters" className="flex-1" />
          <Submit pendingLabel="Iskanje …">Odpri</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
