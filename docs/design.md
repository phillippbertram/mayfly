# Design concept

## Status

This document describes the intended desktop and mobile-page design for Mayfly.
It is a concept for the implementation issues, not a description of a shipped
interface. Where it names behavior, the product specification in
[product.md](product.md) and the invariants in [security.md](security.md) remain
authoritative. Visual mockups that accompany this concept live outside the
repository until the first implementation issue imports real assets.

Variant A is implemented in `apps/desktop/src`, see
[ADR 0002](decisions/0002-desktop-interface.md). The desktop build reports sharing as
unavailable until the Rust services exist; `pnpm dev:web` shows every state with
labeled sample data.

## Product character

Mayfly does one thing: it carries a file from the desktop to a phone on the same
network, for a few minutes, and then forgets about it. The name is the model: a
mayfly lives for a single day, and every share lives one short life too. The interface should feel
like a well-made utility rather than a service: quiet, fast, honest about what it
is doing, and finished after a single screen.

Three words guide every decision: **calm**, **temporary**, **truthful**.

The brand concept adds one image and one rule. The image is a lifecycle, not a
mascot: every share is **Live**, then **Fading**, then **Gone**. The rule: the
metaphor sets the mood but stops at security. Stop sharing, passwords, download
limits, errors, and the HTTP trusted-network notice keep plain words.

## Design principles

1. **One job, one window.** The dashboard is the application. Share details open
   beside the list, settings open over it. There is no navigation tree, no
   onboarding tour, and no second main view.
2. **Temporary by design.** Every share visibly counts down. Expired and revoked
   shares fade instead of vanishing silently. Copy such as "until 14:32" and
   "memory only, gone after restart" keeps the ephemeral model present without
   nagging.
3. **Truthful status.** The server status in the header reflects the actual bound
   listener. A failed bind, a missing network address, or a changed IP is shown
   as such, never as a green dot. Countdown clocks in the UI are informative; the
   Rust backend decides when a share is really over.
4. **Honest about trust.** The HTTP and trusted-network limitation is always one
   glance away: a persistent, low-contrast notice in the window footer and a short
   line under every QR code. It is never hidden behind a help page.
5. **Native first.** System font, system title bar behavior, system menus, tray
   conventions, and keyboard shortcuts of the host platform. No imitation of
   another operating system's chrome, no decorative blur.
6. **Restrained motion.** Motion confirms an action in 120 to 180 ms and then
   stops. Nothing animates while idle, except the empty-state illustration, which
   loops calmly to invite the first share. Reduced-motion preferences disable all
   non-essential transitions.

## Audience and core flows

The primary user owns both devices: a laptop and a phone on the same home or
office Wi-Fi. They want a photo, PDF, or export on the phone in under thirty
seconds and do not want to think about accounts, cables, or cloud storage.

| Flow                | Steps the design must make obvious                                                        |
| ------------------- | ----------------------------------------------------------------------------------------- |
| First share         | Drop or choose a file, see the share appear, open its QR, scan, download                  |
| Repeat share        | Drop more files onto a non-empty dashboard without losing the current selection           |
| Hand over a link    | Copy the URL or QR image for a chat or a second screen                                    |
| Direct download     | Copy a file's direct link (or the ZIP link) from the inspector and paste it elsewhere     |
| Stop early          | Revoke one share or all shares with a single, reversible-looking but clearly final action |
| Keep sharing        | Close the window, confirm from the tray that shares are still active, quit when done      |
| Recover from errors | Understand a port conflict, a missing network, or a changed address and fix it in place   |

## Information architecture

```text
Main window
├── Header: app name, server status, selected address, settings
├── Drop zone (full-height empty state, or a compact strip above the list)
├── Share list (one row per share, newest first)
├── Share inspector (side panel on wide windows, sheet on narrow windows)
└── Footer: trusted-network notice

Settings dialog
├── General: default lifetime, default download limit
├── Network: port, interface and address, bind status
├── Appearance: theme
└── Link profiles: list, default marker, profile editor

Tray menu
├── Open Mayfly
├── Active share summary (informational)
└── Quit Mayfly

Mobile page (served by the Rust HTTP service)
├── Share page: one file large, several as a list with a ZIP, or "No files yet"
└── Error pages: expired, revoked, limit reached, not found, file unavailable
```

## Window and layout

- Default window size 960 x 640 points, minimum 720 x 480. Remember the last size
  and position per user through Tauri window state once implemented.
- Above 900 points of width the inspector is a fixed 360-point right panel; the
  list fills the remaining width. Below that, the inspector becomes a sheet that
  slides over the list and closes with Escape or a close button.
- Content respects a 24-point outer gutter and a 4-point base grid. Rows are 56
  points tall with a 12-point gap between icon, text, and actions.
- On macOS the title bar is transparent with inset traffic lights, and the header
  doubles as the drag region. On Windows and Linux the native title bar stays and
  the header sits directly below it.

## Key screens

### Empty state

The first thing a new user sees is a single large drop zone with a dashed, rounded
border that fills the content area. It contains a small line illustration (a file
leaving a laptop on a dashed arc toward another device), the heading "Share a file
with your phone", where the last word rolls through phone, tablet, laptop, and
computer in step with the animation, one supporting sentence that names any device
with a browser on the network, and a primary button "Choose files..." with its shortcut
shown as a hint. A quieter "New empty link" button next to it creates a share without
files (Cmd/Ctrl+N), for opening the link on the other device first and adding files
afterwards. The header already shows the real server status so the user knows
scanning will work before the first file is added.

The illustration loops gently while idle: a soft glow breathes behind it, a file
card lifts on the laptop screen, the mayfly mark flies the dashed arc with a short trail, and
the receiving device lights up with a drawn check mark and a ripple. The receiver
changes with every flight (phone, tablet, laptop, desktop monitor) because Mayfly
serves any browser on the network, not only phones. A single clock drives the scene
so its parts never drift apart; with reduced motion it rests on the received frame. Hover or an incoming drag
speeds the loop up and brightens the accent. Heading, text, and button rise in with
a short stagger.

Drag feedback: the dashed border becomes solid in the accent color, the background
tints by a few percent, and the heading changes to "Drop to share". Rejected items
such as folders show an inline explanation ("Folders can't be shared. Drop single
files.") without a modal.

### Share options

Choosing or dropping files opens a compact options sheet before anything is shared.
It lists the files, with a remove button for each when there are several, and
offers the lifetime (5, 10, 30, or 60 minutes, until stopped, or a custom number
of minutes) and the download limit (none, 1, 3, 5, or custom, per file). With
several files, a switch "Give each file its own link" creates one share per file;
by default all files go behind one link. A "Protect with a password" switch reveals
a password field with show/hide, generate, and copy buttons and the note "Send it
separately from the link"; Share stays disabled until the password is usable, and
the field is cleared when the sheet closes. Nothing else is asked: files can be
added or removed later, and every share has a page, a ZIP, and direct file links.
Every field starts from the defaults in settings, and the primary Share button has
focus, so Return shares with the defaults in one keystroke; Cmd/Ctrl+Return shares
from anywhere in the sheet. A live summary reads like "Until about 14:42 · up to 3
downloads". The "Ask before sharing" switch, also in General settings, skips the
sheet for users who always want the defaults.

While a share is active, the inspector can extend its lifetime (add 5, 10, 30, or
60 minutes, or keep it until stopped) and change its download limit to any value
above the downloads already started. Rust validates and applies both changes.

### Dashboard with shares

Once a share exists, the drop zone collapses into a compact 64-point strip at the
top of the list ("Drop files to share" plus a "Choose files" button). The whole
window remains a drop target, so the strip is a hint rather than the only target.

Dragging files over the window outlines what a drop will do, in place and
without blurring the app:

- Over an active share's row, or over the inspector of an active share: that
  row (or panel) is outlined with a pill "Add to “<name>”", and the files join it.
- Anywhere else (the strip, the header, empty space, finished shares): the whole
  window is outlined with "New link for 10 minutes", and the strip reads "Release
  to share". A hint says that dropping on an active link adds files to it.

Rows are resolved by vertical band, not by the element under the pointer: the gap
between two rows is split between them, so moving down the list never flickers to
"new link" in between. The outline glides between targets with a short spring.

The list has two groups. "Sharing now" holds active shares, newest first, with a
summary such as "2 files · next ends in 7 min" and a Stop all action. "Finished"
collects expired, stopped, and limit-reached shares below it, most recent first.
Arrow keys, number keys, and the command palette follow this display order.

Each active row (64 points) shows, from left to right:

- A lifetime ring around the file-type icon. The ring empties as the lifetime runs
  out and turns amber under two minutes; shares kept until stopped show a calm full
  ring. No thumbnails: generating them would read file contents in the frontend,
  which the architecture forbids.
- Filename (or "3 files") with middle truncation so the extension stays visible,
  and a meta line with size and contents ("2.4 MB · PDF document", or
  "8.2 MB · 2 images, 1 document").
- A timer pill with the countdown ("7:42", or "Until stopped"), accent while active
  and Hatch amber while fading. It replaces the status chip for active shares; the ring
  and pill carry the state together, and the row's accessible name states it.
- A download meter: the count, plus one segment per allowed download for limits up
  to ten, a bar for larger limits, or just the count without a limit. The counter's
  meaning (started downloads, not confirmed saves) is explained in a tooltip and in
  the inspector, matching the semantics the core-sharing issue defines.
- Actions behind a divider: Copy link, Show QR, and an overflow menu with Save QR as
  PNG, lifetime, download limit, Add files…, Copy ZIP link, and Stop sharing. They
  fade in on
  hover, focus, or selection in a reserved slot, so nothing shifts. The keyboard
  reaches the same actions through the row's context menu.

Finished rows are compact (42 points) inside one bordered group: a status dot (red
for limit reached, grey otherwise), the muted filename and size, the outcome with
its time ("Limit reached · 2 of 2 · 9:02 PM"), and "Share again" plus Remove. The
group header shows the count and a Clear action. When nothing is active, the active
group shows a dashed hint to drop files or press Cmd/Ctrl+O.

Selecting any row opens it in the inspector.

### Share inspector

The inspector answers "how does my device get this?" in one view:

1. The share's name, size, and contents at the top, with the file-type glyph. The
   name is the owner's title, or the file name, "N files", or "No files yet". It
   can be renamed inline: a pencil on hover, a double-click, or T opens a field;
   Return saves, Escape cancels, and an empty title returns to the derived name.
   The title also heads the share page.
2. The files: a header with the count (and "up to N per file" when limited) and an
   "Add files…" button, then one row per file with glyph, name, size, download
   count, a button that copies the file's direct link, a QR button that switches
   the inspector's code to that file's direct link ("Downloads Beach.jpg directly",
   with "Show share QR" to switch back), and a remove button while more than one
   file remains. An empty share shows a dashed "No files yet" box instead. Below
   it, a hint explains that dragging files onto the right half of the window adds
   them and that everyone with the link sees them.
3. The QR code on a white card with a generous quiet zone, 240 points wide. The card
   stays white in dark mode because phone cameras scan a dark-on-light code more
   reliably. A small caption underneath reads "Scan with any camera, or open the link".
   An eye button on the card hides the code: it blurs, shows "QR code hidden", and
   the link field masks the token, which helps while screen sharing or presenting.
   Clicking the hidden card reveals it again. Copy actions keep working. General
   settings can hide codes and links by default; H toggles the selected share and
   Shift+H toggles the default.
4. The share link (the page) in a read-only monospace field with a Copy button,
   and "Copy ZIP link" below it when the share holds several files. The QR code
   always encodes the page link. Copying a direct or ZIP link of a share with a
   download limit shows a note that chat-app link previews can use up a download.
5. A details block: expires at a wall-clock time with a remaining-time ring,
   downloads used against the limit or "unlimited", and the creation time.
   Below it, a password card: "Password set" with Change and Remove, or "No
   password" with Add, which opens the same password field inline. A protected
   row shows a small lock and "Password" in the list.
6. Actions: Copy link, Copy QR image, Save PNG... (native save dialog), and Stop
   sharing. Below the QR caption, a collapsed "Can't open the link on another
   device?" lists the usual causes: same network (with the current address),
   guest Wi-Fi and client isolation, VPN routing, the platform's firewall prompt,
   and a check from this computer, plus the plain-HTTP trust note. Stop sharing
   asks for confirmation inline in the button ("Stop sharing? Confirm") instead of
   opening a dialog, so the keyboard flow stays short.
7. A one-line trust note: "Anyone with this link on your network can download its
   files until it expires, including files you add later." Protected shares say
   that the link and the password are needed and that plain HTTP encrypts neither.

When the share expires or is stopped while the inspector is open, the QR fades to
a disabled state with an overlay label, the actions reduce to "Share again" and
"Remove", and the link field is cleared so a dead link cannot be copied.

### Settings

Settings open as a dialog with a left section list on wide windows and stacked
sections on narrow ones. Changes apply on confirmation per section so a failed
network rebind can be reported next to the control that caused it.

- **General**: default lifetime as a segmented control (5, 10, 30, 60 minutes),
  with 10 minutes preselected; an optional default download limit as a switch
  plus a numeric field.
- **Network**: port field with validation and the current bind result shown
  inline ("Listening on 192.168.1.24:8765" or "Port 8765 is in use"); an interface
  select listing each usable address with its interface name; an empty state when
  no address is usable, with plain guidance about Wi-Fi, VPNs, and guest networks.
  Applying a change that fails to bind keeps the previous working configuration and
  says so.
- **Appearance**: System, Light, or Dark.
- **Link profiles**: the built-in share page pinned at the top. Custom app
  templates (#6) add copy actions such as "Copy link for Documents app" rather
  than changing what a share's link opens. A star marks the default, which the QR
  code opens unless the inspector's "QR opens" select picks another for that
  share; a custom-scheme choice shows that a compatible app is needed on the
  scanning device. The editor is a sheet
  with a name field, a monospace template field, placeholder chips that insert the
  exact placeholder token at the caret, a live preview built from an example
  filename and the current address, and validation messages for unknown
  placeholders, missing schemes, control characters, and disallowed schemes. The
  Save button stays disabled while validation fails, so a misleading QR can never
  be generated from a broken template.

### Server status and recovery

The header pill is the single source of truth for the listener:

| State             | Indicator                   | Copy and action                                                     |
| ----------------- | --------------------------- | ------------------------------------------------------------------- |
| Starting          | Neutral dot, subtle spinner | "Starting..."                                                       |
| Online            | Accent dot                  | "192.168.1.24:8765", click opens Network settings                   |
| Address changed   | Accent dot plus banner      | "Your network address changed. QR codes were updated." with Dismiss |
| No usable address | Warning dot                 | "No network address" with "Check network" opening Network settings  |
| Bind failed       | Error dot                   | "Port 8765 is in use" with "Change port"                            |
| Stopping          | Neutral dot                 | "Stopping..." while quit cleanup runs                               |

An offline listener never renders as online, and shares created while offline
are not offered; the drop zone explains that sharing resumes when the server is
back.

### Tray and lifecycle

- The tray icon is the mayfly wing and body as a monochrome template glyph on
  macOS, so the menu bar tints it, and the colored app icon on Windows and Linux.
  It is drawn in `icons/tray-template.svg` and rendered with
  `rsvg-convert -w 44 -h 44 icons/tray-template.svg -o icons/tray-template.png`
  (from `apps/desktop/src-tauri`).
- The menu contains "Open Mayfly", an informational line such as "3 active
  shares · next ends in 4 min" (or "No active shares"), a separator, and "Quit
  Mayfly". The line updates every second when its text changes.
- Closing the window (red button or Cmd/Ctrl+W) hides it. While "Explain closing
  the window" is on (General settings), the window stays open first with "Mayfly
  keeps sharing in the background", the number of active shares, "Don't show this
  again", and the buttons "Quit Mayfly" and "Hide window" (default). Clicking the
  Dock icon on macOS brings the window back.
- Quitting from the tray, the app menu, or Cmd/Ctrl+Q while shares are active
  shows the window with "Quit Mayfly? N active shares stop immediately, and
  downloads in progress are cut off." With nothing active, Mayfly quits at once.
- Without a tray (a Linux desktop without AppIndicator support), closing the window
  goes through the same quit confirmation, because nothing could bring it back.

### Mobile page

The page served at `/s/{token}` is a self-contained HTML document with inline CSS,
no scripts, no external fonts, and no third-party requests. It uses the system
font stack and respects `prefers-color-scheme`.

Layout, top to bottom: a small Mayfly wordmark, a file-type glyph, the escaped
filename in large type with word breaking allowed, the formatted size and type, a
full-width 52-point "Download" button pointing to `/d/{token}/{file}`, the remaining time
and downloads, and a footer line "Shared temporarily from a computer on your
network." with a short trusted-network note and "Mayfly · © year Phillipp
Bertram", where "Mayfly" links to the public website. The page sends no referrer,
so following that link never passes the share URL on. Nothing on the page
identifies the computer, its path, or its user. The content sits on a card at most 560 points
wide, so the same page reads well when the link is opened on another computer.

A bundle (several files behind one link) shows a stacked-files glyph, "N files"
with the total size, a primary "Download all .zip" button pointing to
`/z/{token}`, and below a divider one 56-point row per file: glyph, name, size,
and a 44-point download button pointing to `/d/{token}/{file}`. A file that
reached its limit shows "Limit reached" instead of a button, and the ZIP button
is disabled once any file is exhausted. After the owner added or removed files,
and while the share is empty ("No files yet"), the note adds "The owner may add or
remove files." with a Refresh link; the page has no scripts to update itself.

Error pages share the same frame and replace the content with one glyph, one
headline, and one sentence:

| Case             | Headline               | Sentence                                                   |
| ---------------- | ---------------------- | ---------------------------------------------------------- |
| Expired          | This link expired      | Ask for a new link from the computer that shared the file. |
| Revoked          | Sharing was stopped    | The owner stopped sharing this file.                       |
| Limit reached    | Download limit reached | This file was downloaded as often as allowed.              |
| Not found        | Nothing here           | This link is not valid.                                    |
| File unavailable | File unavailable       | The shared file can't be read right now.                   |

HTTP status codes follow the security requirements; the pages never differ in a
way that reveals whether a token once existed beyond what the headline states.

## Visual language

### Color

The palette is an evening hatch over still water: teal-tinted neutrals ("Still
water" in light, "Dusk" in dark) with a single accent. The accent, River green,
signals a live, local connection and doubles as the Live status color. "Hatch"
amber is reserved for fading shares and the no-address state; danger red for
stopping and listener failures.

| Token                 | Light     | Dark      | Use                                              |
| --------------------- | --------- | --------- | ------------------------------------------------ |
| `--bg`                | `#F5F8F7` | `#0F1A1C` | Window background                                |
| `--surface`           | `#FFFFFF` | `#152224` | Cards, rows, inspector, dialogs                  |
| `--surface-muted`     | `#EEF3F1` | `#1C2B2E` | Drop strip, settings section list, glyph squares |
| `--border`            | `#DFE7E4` | `#26373A` | 1-point borders and separators                   |
| `--text`              | `#142326` | `#E8EFED` | Primary text                                     |
| `--text-muted`        | `#4B5957` | `#A3B3B0` | Secondary text, captions                         |
| `--text-faint`        | `#626F6D` | `#869794` | Tertiary text, hints, device outlines            |
| `--accent`            | `#0E7C66` | `#3DD6A8` | Primary buttons, active dot, focus ring, links   |
| `--accent-foreground` | `#FFFFFF` | `#0B1F19` | Text on accent                                   |
| `--accent-soft`       | `#DDF3EC` | `#163A31` | Live chip background, drag tint                  |
| `--warning`           | `#9A5410` | `#F0A64A` | Fading chip and ring, no-address state           |
| `--warning-soft`      | `#FBEBD8` | `#3A2A14` | Warning chip background                          |
| `--danger`            | `#B42323` | `#F87171` | Stop sharing, bind failure                       |
| `--danger-soft`       | `#FBE1E1` | `#3F1C1C` | Danger chip background                           |
| `--qr-card`           | `#FFFFFF` | `#FFFFFF` | QR card, identical in both themes                |

Text on surfaces meets 4.5:1 contrast; non-text indicators meet 3:1. Status is
always conveyed by label and glyph as well as color.

### Typography

Use the platform UI font: SF Pro on macOS, Segoe UI Variable on Windows, and the
system sans on Linux with Inter as a bundled fallback. Monospace for links and
templates uses SF Mono, Cascadia Mono, or the system monospace.
The product website alone sets the wordmark and display headings in Bricolage
Grotesque (self-hosted, OFL-1.1); the app stays native.

| Role           | Size / line height | Weight   | Notes                                |
| -------------- | ------------------ | -------- | ------------------------------------ |
| Window title   | 15 / 20            | Semibold | Header app name                      |
| Section title  | 13 / 18            | Semibold | List headers, settings sections      |
| Body           | 13 / 18            | Regular  | Rows, settings controls              |
| Caption        | 12 / 16            | Regular  | Secondary line, hints, footer notice |
| Inspector name | 17 / 22            | Semibold | Filename above the QR                |
| Mobile title   | 22 / 28            | Semibold | Filename on the phone page           |

Numbers that change, such as countdowns, sizes, and counters, use tabular figures
so rows do not jitter.

### Shape, depth, and iconography

- Corner radius 6 points on controls, 10 on rows and cards, 14 on sheets and
  dialogs, 16 on the QR card.
- Depth comes from 1-point borders and surface steps, not shadows. Only popovers,
  menus, and dialogs cast a soft shadow.
- Icons are Lucide at 16 points in rows and menus and 20 points in primary
  buttons, with a 1.5-point stroke. File-type glyphs reuse Lucide file icons inside
  a 36-point rounded square on the muted surface.
- The mark is a resting mayfly: an upright wing in the accent color, a curved
  body, and two tails whose tips fade. Below 32 points the tails are dropped. The
  application icon puts the mark on a Dusk (`#0F1A1C`) rounded square with a mint
  wing (`icons/source.svg`; `icons/source-small.svg` for 32 px). The wordmark is
  always lowercase "mayfly". The same mark flies the empty-state arc and heads
  the mobile page.

### Motion

| Interaction               | Duration | Behavior                                         |
| ------------------------- | -------- | ------------------------------------------------ |
| Button and row hover      | 120 ms   | Background color only                            |
| Share row appears         | 160 ms   | Fade in and 4-point slide down                   |
| Inspector opens or closes | 180 ms   | Slide from the right, no bounce                  |
| Drag enters the window    | 120 ms   | Border and tint change                           |
| Copy confirmation         | 1.5 s    | Button label swaps to "Copied" with a check icon |
| Share expires             | 240 ms   | Row and QR fade to the muted state               |

Countdowns update once per second but render only when the visible text changes.
With reduced motion enabled, transitions are replaced by immediate state changes.

## Interaction details

### Keyboard

Mayfly works from the keyboard. Every shortcut is declared once with TanStack
Hotkeys and feeds three places: the global key handling, the Cmd/Ctrl+K command
palette, and the shortcut overview (Cmd/Ctrl+/ and Settings › Shortcuts). Labels use
the platform's symbols. Single-letter keys act on the selected share and are
ignored while typing or while a menu is open; dialogs suspend global shortcuts.

| Shortcut                 | Action                                      |
| ------------------------ | ------------------------------------------- |
| Cmd/Ctrl+K               | Command palette: search shares and commands |
| Cmd/Ctrl+/               | Keyboard shortcut overview                  |
| Cmd/Ctrl+O               | Choose files to share                       |
| Cmd/Ctrl+N               | Create an empty link                        |
| Cmd/Ctrl+,               | Settings                                    |
| Cmd/Ctrl+Shift+L         | Switch light and dark                       |
| J / K, Up / Down         | Next or previous share                      |
| G G / Shift+G            | First or last share                         |
| 1 – 9                    | Select a share by position                  |
| I                        | Show or hide details                        |
| Escape                   | Close the inspector, sheet, or dialog       |
| Cmd/Ctrl+C               | Copy the selected share's link              |
| Cmd/Ctrl+Shift+C         | Copy the selected share's QR image          |
| Cmd/Ctrl+S               | Save the selected share's QR as PNG         |
| Q                        | Highlight the QR code                       |
| H                        | Hide or show the QR code and link token     |
| Shift+H                  | Hide all QR codes and links by default      |
| E                        | Add 10 minutes                              |
| L                        | Change the download limit                   |
| A                        | Add files to the selected share             |
| T                        | Rename the selected share                   |
| R                        | Share an ended file again                   |
| Backspace / Delete       | Stop sharing after inline confirmation      |
| Cmd/Ctrl+Backspace       | Clear finished shares                       |
| Cmd/Ctrl+Shift+Backspace | Stop all shares after confirmation          |
| Cmd/Ctrl+Return          | Share from the options sheet                |
| Cmd/Ctrl+W               | Hide the window (sharing continues)         |
| Cmd/Ctrl+Q               | Quit with confirmation while shares exist   |

Window and quit shortcuts belong to the native application menu, which is part of
the tray and lifecycle work.

### Feedback

- Copy actions confirm inside the triggering button; toasts are reserved for
  background events such as an address change or a failed PNG export.
- Destructive actions confirm inline where possible. Only Quit and Stop all use a
  dialog, because they affect every share.
- Errors name the cause and the next step in one sentence each and never include
  file paths, tokens, or stack traces.

### Time and quantity formatting

- Remaining time: "45 s", "7 min", "1 h 10 min"; under two minutes the chip turns
  to Fading. No expiry is written as "No expiry", never as a far-future date.
- Absolute times use the system locale and 24-hour or 12-hour preference.
- Sizes use decimal units with one decimal place above 1 MB ("2.4 MB", "812 KB").
- Download counters read "0 downloads", "1 of 3", or "3 of 3", with "Limit
  reached" as the chip once exhausted.

## Accessibility

- Every interactive element has an accessible name; icon-only buttons carry a
  tooltip and a label for assistive technology.
- Focus is always visible as a 2-point accent ring with a 2-point offset, in both
  themes, on every control including list rows and the drop zone.
- The share list is a single-selection listbox with arrow-key navigation and a
  context menu; actions do not require hovering.
- The server status pill is a live region with polite announcements; countdowns
  announce only at one minute, thirty seconds, and expiry to avoid noise.
- Hit targets are at least 28 points on the desktop and 44 points on the mobile
  page. The window remains usable at 200 percent system scaling.
- The mobile page works without JavaScript and with screen readers, and the
  download link is a real anchor with the filename in its accessible name.

## Content and tone

Write short sentences in plain English, verbs first on buttons ("Choose files",
"Copy link", "Stop sharing"), and name consequences before they happen ("3 active
shares will stop immediately"). The user-facing verb for revocation is "Stop
sharing"; internal code, DTOs, and documentation keep the term "revoke".

Never show absolute paths, tokens in isolation, interface internals, or technical
error codes to the user. The full share URL is shown on purpose because it is the
artifact the user hands over, and the trust note next to it explains the
consequence.

## Implementation notes

- Express the color tokens above as CSS custom properties consumed by the Tailwind
  and shadcn/ui theme. Light values live on `:root`, dark values under the `.dark`
  class, with the theme setting mapping System to `prefers-color-scheme`.
- Keep the QR card color fixed rather than themed so exported PNGs and on-screen
  codes stay identical.
- Build the share row, status chip, status pill, QR card, and profile editor as
  the first shared components; everything else composes shadcn/ui primitives
  (Button, Badge, Dialog, Sheet, Select, Switch, Tooltip, Input, DropdownMenu,
  ScrollArea).
- Derive every displayed URL, QR, and PNG from the same backend-provided link so
  the inspector cannot show inconsistent artifacts.
- Treat this document as the baseline for the UI work in the application
  foundation and dashboard issues, and record deviations in the relevant issue
  or in `docs/decisions/` when they change the product.

## Alternative directions

The mockups explore two alternatives to the baseline dashboard so the layout
choice is a deliberate one:

- **Variant B, hero QR.** The selected share becomes a hero card with the QR
  code, a large countdown, and the link; other shares are compact cards and the
  drop zone is a permanent column. Warm paper background, indigo accent, pill
  buttons, 14-point base size. It suits a one-share-at-a-time habit but gives
  the list less room.
- **Variant C, compact utility.** A sidebar with views, server details, and
  profiles; a table with column headers and 40-point rows; the inspector as a
  key/value panel. Cool neutrals, amber accent kept separate from the green
  status color, 4-point radii, 12-point base size. It scales to many shares but
  reads as a developer tool.

The baseline (variant A) remains the recommendation: it keeps the list and the
QR visible at once without the density of C or the single-share bias of B.
Adopt individual ideas from B or C, such as the large countdown or the
key/value details, only where they do not change that balance.

## Open design questions

- Final empty-state illustration and application icon artwork.
- The exact tray glyph per platform after testing light and dark menu bars.
