"use client";

import { useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/paths";

/** Scenes defined in apps/desktop/src/demo/scenes.ts. */
export type DemoScene = "share" | "bundle" | "qr" | "settings";

// The demo renders at this desktop window size and is scaled to fit.
const WIDTH = 1200;
const HEIGHT = 800;

/**
 * The actual FileHop interface on its sample-data simulator, playing a scripted
 * scene in an inert iframe. The screenshot stays underneath: it is the content
 * without JavaScript, before the demo is ready, and for reduced motion.
 */
export function LiveScreen({
  scene,
  poster,
  alt,
  loop = false,
  priority = false,
  onReady,
  onDone,
}: {
  scene: DemoScene;
  poster: string;
  alt: string;
  loop?: boolean;
  priority?: boolean;
  onReady?: () => void;
  onDone?: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const near = useInView(box, { once: true, margin: "200px" });
  const reduced = useReducedMotion();
  const [scale, setScale] = useState(0);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const wanted = useRef(scene);
  wanted.current = scene;
  const done = useRef(onDone);
  done.current = onDone;
  const readied = useRef(onReady);
  readied.current = onReady;
  const live = near && !reduced && scale > 0;

  // The first scene comes from the URL; later ones restart the demo in place.
  useEffect(() => {
    if (live && !source) setSource(`/demo/demo.html?scene=${scene}${loop ? "&loop=1" : ""}`);
  }, [live, source, scene, loop]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ source: "filehop-site", scene }, location.origin);
  }, [scene]);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / WIDTH);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== location.origin) return;
      const data = (event.data ?? {}) as { source?: unknown; event?: unknown; scene?: unknown };
      if (data.source !== "filehop-demo") return;
      // A scene change sent while the demo was still loading never arrived.
      if (data.scene !== wanted.current)
        frame.current?.contentWindow?.postMessage(
          { source: "filehop-site", scene: wanted.current },
          location.origin,
        );
      else if (data.event === "ready") {
        setReady(true);
        readied.current?.();
      } else if (data.event === "done") done.current?.();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="live-screen" ref={box}>
      <Image
        src={asset(`/screenshots/${poster}.jpg`)}
        alt={alt}
        width={1440}
        height={960}
        sizes="(max-width: 900px) 100vw, 1120px"
        priority={priority}
      />
      {live && source && (
        <iframe
          ref={frame}
          src={asset(source)}
          title="FileHop interface demo"
          aria-hidden="true"
          tabIndex={-1}
          inert
          loading="lazy"
          width={WIDTH}
          height={HEIGHT}
          style={{ transform: `scale(${scale})`, opacity: ready ? 1 : 0 }}
        />
      )}
    </div>
  );
}
