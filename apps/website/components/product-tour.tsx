"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/paths";
import { LiveScreen } from "./live-screen";

const scenes = [
  {
    image: "file-drop",
    demo: "bundle",
    title: "One link. Room to grow.",
    text: "Share several files together, give the link a title, and add or remove files later. The same link and QR code keep working.",
    alt: "FileHop sample-data preview with a link titled Weekend away, three files, Add files, and Copy ZIP link",
  },
  {
    image: "file-qr",
    demo: "qr",
    title: "A shortcut for every file.",
    text: "Open the share page, download everything as a ZIP, or scan a QR code for just one file. No companion app needed.",
    alt: "FileHop sample-data preview with the direct-download QR code for Itinerary.pdf selected",
  },
  {
    image: "share-options",
    demo: "share",
    title: "A little control, up front.",
    text: "Choose a lifetime and a download limit per file. Need a link first? Create an empty one and add the files when you’re ready.",
    alt: "FileHop sample-data preview showing a file ready to share with lifetime and download-limit options",
  },
  {
    image: "settings",
    demo: "settings",
    title: "Set it once. Keep your flow.",
    text: "Save your defaults, choose your appearance, and keep sharing from the menu bar or tray when the window closes. Quit ends every share.",
    alt: "FileHop General settings preview with saved defaults, a close-window reminder, and hidden-code options",
  },
] as const;

export function ProductTour() {
  const container = useRef<HTMLDivElement>(null);
  const visible = useInView(container, { amount: 0.25 });
  const reduced = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  // With the live demo, a step lasts as long as its scene; the timer is the fallback.
  const [live, setLive] = useState(false);
  const current = scenes[scene] ?? scenes[0];
  const advance = () => {
    if (scene === scenes.length - 1) setPlaying(false);
    else setScene(scene + 1);
  };

  useEffect(() => {
    if (!playing || reduced || !visible || live) return;
    const timer = setTimeout(() => {
      if (scene === scenes.length - 1) setPlaying(false);
      else setScene(scene + 1);
    }, 5000);
    return () => clearTimeout(timer);
  }, [playing, reduced, scene, visible, live]);

  return (
    <div className="product-tour" ref={container}>
      <div className="tour-screen">
        <div className="screenshot-window">
          <div className="window-toolbar" aria-hidden="true">
            <span />
            <span />
            <span />
            <p>FileHop</p>
            <span className="toolbar-preview">INTERFACE PREVIEW</span>
          </div>
          <div className="tour-frames" id="tour-screenshot">
            {!reduced && (
              <LiveScreen
                scene={current.demo}
                poster={current.image}
                alt={current.alt}
                onReady={() => setLive(true)}
                onDone={() => {
                  if (playing) advance();
                }}
              />
            )}
            {reduced &&
              scenes.map((item, index) => (
                <motion.div
                  key={item.image}
                  className="tour-frame"
                  initial={false}
                  animate={{ opacity: scene === index ? 1 : 0 }}
                  transition={{ duration: reduced ? 0 : 0.4 }}
                  aria-hidden={scene !== index}
                  style={{ pointerEvents: scene === index ? "auto" : "none" }}
                >
                  <a
                    href={asset(`/screenshots/${item.image}.jpg`)}
                    target="_blank"
                    rel="noreferrer"
                    tabIndex={scene === index ? 0 : -1}
                    aria-label={`Open full-size screenshot: ${item.alt}`}
                  >
                    <Image
                      src={asset(`/screenshots/${item.image}.jpg`)}
                      alt={item.alt}
                      width={1440}
                      height={960}
                      sizes="(max-width: 900px) 100vw, 760px"
                    />
                  </a>
                </motion.div>
              ))}
          </div>
        </div>
        <p className="tour-caption">
          {live
            ? "The actual FileHop interface, running in your browser with sample data. No files are transferred."
            : "Actual FileHop interface · sample-data browser preview. No files are transferred."}
        </p>
      </div>
      <div className="tour-sidebar">
        <fieldset className="tour-scenes" aria-label="Explore current FileHop features">
          {scenes.map((item, index) => (
            <button
              type="button"
              key={item.image}
              className={scene === index ? "tour-scene active" : "tour-scene"}
              aria-pressed={scene === index}
              aria-controls="tour-screenshot"
              onClick={() => {
                setScene(index);
                setPlaying(false);
              }}
            >
              <span className="tour-number">0{index + 1}</span>
              <span>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </span>
            </button>
          ))}
        </fieldset>
        <div className="tour-controls">
          <span>THE CURRENT DESKTOP BUILD</span>
          <button
            type="button"
            onClick={() => {
              if (reduced) {
                setScene((scene + 1) % scenes.length);
                setPlaying(false);
                return;
              }
              if (!playing && scene === scenes.length - 1) setScene(0);
              setPlaying(!playing);
            }}
            aria-label={
              reduced
                ? "Show next screenshot"
                : playing
                  ? "Pause screenshot tour"
                  : "Play screenshot tour"
            }
          >
            {reduced ? (
              <Play size={13} />
            ) : playing ? (
              <Pause size={13} />
            ) : scene === scenes.length - 1 ? (
              <RotateCcw size={13} />
            ) : (
              <Play size={13} />
            )}
            {reduced ? "Next" : playing ? "Pause" : "Play"}
          </button>
        </div>
      </div>
    </div>
  );
}
