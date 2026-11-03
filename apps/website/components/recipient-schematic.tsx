import {
  ArrowRight,
  CircleAlert,
  Download,
  FileArchive,
  Files,
  FileText,
  Image,
  Laptop,
  Lock,
  Minus,
  Plus,
  QrCode,
} from "lucide-react";
import type { ReactNode } from "react";

// Schematic phones that mirror the share page the desktop app serves
// (apps/desktop/src-tauri/src/server/pages.rs): same copy, same layout,
// sample data only. Keep them in sync when that page changes.

type SampleFile = { name: string; size: string; kind: "image" | "document"; done?: boolean };

const beach: SampleFile = { name: "Beach.jpg", size: "4.2 MB", kind: "image" };
const sunset: SampleFile = { name: "Sunset.jpg", size: "3.8 MB", kind: "image" };
const itinerary: SampleFile = { name: "Itinerary.pdf", size: "220 KB", kind: "document" };

const CAPTION = "Schematic with sample data · not a screenshot of a transfer.";

function Phone({ children, browser = false }: { children: ReactNode; browser?: boolean }) {
  return (
    <div className={browser ? "rs-phone rs-browser" : "rs-phone"}>
      <div className="rs-address">192.168.1.24:8765</div>
      <div className="rs-screen">
        {browser ? null : (
          <div className="rs-brand">
            <span className="rs-mark">
              <svg aria-hidden="true" viewBox="6 2 58 46">
                <path className="rs-wing" d="M24 37C21 25 25 13 35 5C38 16 36 28 31 37Z" />
                <path d="M10 43C20 37 33 36 44 32" />
              </svg>
            </span>
            mayfly
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function SharePage({
  title,
  files,
  total,
  note,
}: {
  title: string;
  files: SampleFile[];
  total: string;
  note: ReactNode;
}) {
  return (
    <div className="rs-card">
      <span className="rs-glyph rs-bundle">
        <Files size={16} />
      </span>
      <strong className="rs-title">{title}</strong>
      <span className="rs-meta">
        {files.length} files · {total} in total
      </span>
      <span className="rs-button">
        <Download size={11} />
        Download all<span className="rs-suffix">.zip</span>
      </span>
      <span className="rs-note">{note}</span>
      <ul className="rs-files">
        {files.map((file) => (
          <li key={file.name}>
            <span className={`rs-glyph rs-small rs-${file.kind}`}>
              {file.kind === "image" ? <Image size={11} /> : <FileText size={11} />}
            </span>
            <span className="rs-info">
              <span className="rs-file">{file.name}</span>
              <span className="rs-meta">{file.size}</span>
            </span>
            {file.done ? (
              <span className="rs-done">Limit reached</span>
            ) : (
              <span className="rs-mini">
                <Download size={11} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Message({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: string;
}) {
  return (
    <div className="rs-card">
      <span className="rs-glyph">{icon}</span>
      <strong className="rs-title">{title}</strong>
      <span className="rs-meta">{text}</span>
      {action ? <span className="rs-button">{action}</span> : null}
    </div>
  );
}

function BrowserDownload({
  name,
  size,
  zip = false,
}: {
  name: string;
  size: string;
  zip?: boolean;
}) {
  return (
    <div className="rs-saving">
      <span className={zip ? "rs-glyph rs-bundle" : "rs-glyph rs-document"}>
        {zip ? <FileArchive size={16} /> : <FileText size={16} />}
      </span>
      <strong className="rs-file">{name}</strong>
      <span className="rs-meta">{size}</span>
      <span className="rs-progress">
        <span />
      </span>
      <span className="rs-meta">Saved by your browser</span>
    </div>
  );
}

function Step({ label, children, text }: { label: string; children: ReactNode; text: string }) {
  return (
    <div className="rs-step">
      <span className="rs-label">{label}</span>
      {children}
      <p>{text}</p>
    </div>
  );
}

function Figure({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <figure className={`rs not-prose ${className}`} aria-label={label}>
      <div className="rs-body" aria-hidden="true">
        {children}
      </div>
      <figcaption>{CAPTION}</figcaption>
    </figure>
  );
}

/** The three links a share offers, from the recipient's point of view. */
export function RecipientPaths() {
  return (
    <Figure
      label="Three ways in: the share link opens a page with every file, a file link downloads one file, and the ZIP link downloads all files"
      className="rs-paths"
    >
      <div className="rs-source">
        <QrCode size={16} />
        Scan the QR code or open the link
      </div>
      <div className="rs-row">
        <Step
          label="Share link · default QR"
          text="A page with every file. Download one, or all as a ZIP. Opening the page never counts as a download."
        >
          <Phone>
            <SharePage
              title="Weekend away"
              files={[beach, sunset, itinerary]}
              total="8.2 MB"
              note="Lives for about 26 more minutes."
            />
          </Phone>
        </Step>
        <Step
          label="File link · file QR"
          text="The download starts right away, with no page in between. It counts against that file's limit."
        >
          <Phone browser>
            <BrowserDownload name="Itinerary.pdf" size="220 KB" />
          </Phone>
        </Step>
        <Step
          label="ZIP link"
          text="Every file in one archive, assembled while it downloads. It counts as one download of each file."
        >
          <Phone browser>
            <BrowserDownload name="Mayfly-3-files.zip" size="8.2 MB" zip />
          </Phone>
        </Step>
      </div>
    </Figure>
  );
}

/** The password gate of a protected share. */
export function RecipientPassword() {
  return (
    <Figure
      label="A protected share first shows a password form; after Unlock, the share page with its files appears"
      className="rs-sequence"
    >
      <div className="rs-row">
        <Step
          label="01 · Password required"
          text="The page shows only a password field. No file names, no title."
        >
          <Phone>
            <div className="rs-card">
              <span className="rs-glyph rs-bundle">
                <Lock size={16} />
              </span>
              <strong className="rs-title">Password required</strong>
              <span className="rs-meta">
                Enter the password you got from the person sharing these files.
              </span>
              <span className="rs-field">Password</span>
              <span className="rs-input">••••••••</span>
              <span className="rs-button">Unlock</span>
            </div>
          </Phone>
        </Step>
        <span className="rs-arrow">
          <ArrowRight size={18} />
        </span>
        <Step
          label="02 · Unlocked"
          text="The browser can now open the page and its downloads for up to an hour."
        >
          <Phone>
            <SharePage
              title="Weekend away"
              files={[beach, sunset, itinerary]}
              total="8.2 MB"
              note="Lives for about 26 more minutes."
            />
          </Phone>
        </Step>
      </div>
    </Figure>
  );
}

/** Adding and removing files while the recipient keeps the same link. */
export function RecipientUpdates() {
  return (
    <Figure
      label="The recipient opens the page with two files, the owner adds one and removes one on the computer, and a reload shows the new list under the same link"
      className="rs-sequence"
    >
      <div className="rs-row">
        <Step
          label="01 · Page open"
          text="The recipient opens the link. The page shows what the share holds now."
        >
          <Phone>
            <SharePage
              title="Weekend away"
              files={[beach, sunset]}
              total="8.0 MB"
              note="Lives for about 26 more minutes."
            />
          </Phone>
        </Step>
        <span className="rs-arrow">
          <ArrowRight size={18} />
        </span>
        <Step
          label="02 · On the computer"
          text="The owner adds or removes files. The link and its QR code stay the same."
        >
          <div className="rs-desktop">
            <span className="rs-desktop-head">
              <Laptop size={15} />
              Weekend away
            </span>
            <span className="rs-change rs-added">
              <Plus size={12} />
              Itinerary.pdf
            </span>
            <span className="rs-change rs-removed">
              <Minus size={12} />
              Sunset.jpg
            </span>
            <span className="rs-desktop-note">Add files… · drop onto the share · remove ×</span>
          </div>
        </Step>
        <span className="rs-arrow">
          <ArrowRight size={18} />
        </span>
        <Step
          label="03 · Reload"
          text="The page doesn't update itself. After a reload it shows the new list and offers Refresh."
        >
          <Phone>
            <SharePage
              title="Weekend away"
              files={[beach, itinerary]}
              total="4.4 MB"
              note={
                <>
                  Lives for about 24 more minutes. The owner may add or remove files.{" "}
                  <span className="rs-link">Refresh</span>
                </>
              }
            />
          </Phone>
        </Step>
      </div>
    </Figure>
  );
}

/** What a link shows once it can no longer serve a download. */
export function RecipientEndings() {
  const alert = <CircleAlert size={16} />;
  return (
    <Figure
      label="Pages a recipient sees when a link has ended, was stopped, reached its limit, or points to a removed file"
      className="rs-endings"
    >
      <div className="rs-grid">
        <Message
          icon={alert}
          title="This link is gone"
          text="Its time ran out. Ask for a new link from the computer that shared the file."
        />
        <Message
          icon={alert}
          title="Sharing was stopped"
          text="The owner stopped sharing this file."
        />
        <Message
          icon={alert}
          title="Download limit reached"
          text="This file was downloaded as often as allowed."
        />
        <Message
          icon={alert}
          title="File removed"
          text="The owner removed this file from the shared link."
        />
      </div>
    </Figure>
  );
}
