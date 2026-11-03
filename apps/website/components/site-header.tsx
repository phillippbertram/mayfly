"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { repositoryUrl } from "@/lib/repository";
import { Brand } from "./brand";
import { GitHubMark } from "./github-mark";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link href="/" aria-label="Mayfly home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation" className="desktop-nav">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#details">Thoughtfully simple</Link>
          <Link href="/docs/">
            User manual <ArrowUpRight size={12} aria-hidden="true" />
          </Link>
          <a href={repositoryUrl} className="nav-github" aria-label="Mayfly on GitHub">
            <GitHubMark size={17} />
          </a>
        </nav>
        <Link href="/#download" className="nav-cta">
          Get Mayfly <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
        <button
          type="button"
          className="mobile-menu-button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile navigation">
          <Link onClick={() => setOpen(false)} href="/#how-it-works">
            How it works
          </Link>
          <Link onClick={() => setOpen(false)} href="/#details">
            Thoughtfully simple
          </Link>
          <Link onClick={() => setOpen(false)} href="/docs/">
            User manual
          </Link>
          <Link onClick={() => setOpen(false)} href="/#download">
            Downloads
          </Link>
          <a href={repositoryUrl} className="mobile-github">
            <GitHubMark size={16} />
            GitHub
          </a>
        </nav>
      )}
    </header>
  );
}
