"use client";

import { Check, FileText, Laptop, Pause, Play, QrCode, RotateCcw, Smartphone } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "01",
    title: "Choose your files.",
    text: "A photo. A PDF. A few things for later. Drop them into FileHop and set a lifetime.",
  },
  {
    number: "02",
    title: "Make the connection.",
    text: "Point your phone’s camera at the QR code. Your browser takes it from here.",
  },
  {
    number: "03",
    title: "And it’s there.",
    text: "Download a file or get them all as a ZIP, directly from your computer. Stop sharing when you’re done.",
  },
];

export function TransferStory() {
  const container = useRef<HTMLDivElement>(null);
  const visible = useInView(container, { amount: 0.3 });
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing || reduced || !visible) return;
    const timer = setTimeout(() => {
      if (step === 2) setPlaying(false);
      else setStep(step + 1);
    }, 2200);
    return () => clearTimeout(timer);
  }, [playing, reduced, step, visible]);
  return (
    <div className="story" ref={container}>
      <div className="story-visual" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="story-computer">
          <Laptop size={42} strokeWidth={1} />
          <span>Your computer</span>
        </div>
        <div className="story-wire">
          <motion.span initial={false} animate={reduced ? {} : { scaleX: (step + 1) / 3 }} />
        </div>
        <div className="story-token">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {step === 0 ? (
                <FileText size={36} strokeWidth={1.4} />
              ) : step === 1 ? (
                <QrCode size={36} strokeWidth={1.4} />
              ) : (
                <Check size={36} strokeWidth={1.4} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="story-wire right">
          <motion.span initial={false} animate={reduced ? {} : { scaleX: step === 2 ? 1 : 0.2 }} />
        </div>
        <div className="story-phone">
          <Smartphone size={38} strokeWidth={1} />
          <span>Your phone</span>
        </div>
        <span className="story-network">SAME WI-FI. ONE SHORT HOP.</span>
      </div>
      <fieldset className="story-steps" aria-label="Illustrated sharing steps">
        {steps.map((item, index) => (
          <button
            key={item.number}
            type="button"
            className={step === index ? "story-step active" : "story-step"}
            aria-pressed={step === index}
            onClick={() => {
              setStep(index);
              setPlaying(false);
            }}
          >
            <span className="step-number">{item.number}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </button>
        ))}
      </fieldset>
      <div className="story-controls">
        <span>Illustrated workflow · not a recording of a transfer.</span>
        <button
          type="button"
          onClick={() => {
            if (reduced) {
              setStep((step + 1) % 3);
              setPlaying(false);
              return;
            }
            if (!playing && step === 2) setStep(0);
            setPlaying(!playing);
          }}
          aria-label={
            reduced
              ? "Show next workflow step"
              : playing
                ? "Pause workflow animation"
                : "Replay workflow animation"
          }
        >
          {playing && !reduced ? (
            <Pause size={13} />
          ) : step === 2 ? (
            <RotateCcw size={13} />
          ) : (
            <Play size={13} />
          )}
          {reduced ? "Next step" : playing ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}
