//! Self-contained HTML for the public landing, password, and error pages:
//! inline CSS (allowed by hash), inline SVG, no scripts, no external requests.
//! Every value that came from a filename is HTML-escaped.

use std::fmt::Write;
use std::sync::LazyLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use sha2::{Digest, Sha256};

use crate::shares::password::MAX_PASSWORD_CHARS;
use crate::shares::{FileKind, PageView, Unavailable};

/// Mayfly's public website, linked from every page footer and the About dialog.
pub const WEBSITE_URL: &str = "https://phillippbertram.github.io/mayfly/";

/// Content-Security-Policy for every HTML page.
pub static PAGE_CSP: LazyLock<String> = LazyLock::new(|| {
    let hash = STANDARD.encode(Sha256::digest(CSS.as_bytes()));
    format!(
        "default-src 'none'; style-src 'sha256-{hash}'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    )
});

pub fn landing(token: &str, view: &PageView) -> String {
    let token = escape(token);
    let mut body = String::new();
    // Without scripts the page can't update itself; once the owner changed the
    // files, or while there are none, it offers a plain reload.
    let title = view.title.as_deref().map(escape);
    let refresh = if view.edited || view.files.is_empty() {
        format!(r#" The owner may add or remove files. <a href="/s/{token}">Refresh</a>"#)
    } else {
        String::new()
    };
    if let [file] = view.files.as_slice() {
        let _ = write!(
            body,
            r#"<div class="glyph {kind}">{icon}</div>
<h1>{heading}</h1>
<p class="meta">{named}{size} · {label}</p>
<a class="button" href="/d/{token}/{id}" download>{download}Download</a>
<p class="note">{availability}{refresh}</p>"#,
            id = escape(&file.id),
            kind = kind_class(file.kind),
            icon = icon(file.kind),
            // A titled share keeps the file name visible under the title.
            heading = title.clone().unwrap_or_else(|| escape(&file.name)),
            named = if title.is_some() {
                format!("{} · ", escape(&file.name))
            } else {
                String::new()
            },
            size = format_bytes(file.size),
            label = kind_label(file.kind),
            download = DOWNLOAD_ICON,
            availability = availability(view.remaining, file.remaining_downloads),
        );
    } else if view.files.is_empty() {
        let _ = write!(
            body,
            r#"<div class="glyph bundle">{icon}</div>
<h1>{heading}</h1>
<p class="meta">{empty}Files appear here when the owner adds them.</p>
<p class="note">{availability}{refresh}</p>"#,
            icon = icon(FileKind::Bundle),
            heading = title.clone().unwrap_or_else(|| "No files yet".to_owned()),
            empty = if title.is_some() {
                "No files yet. "
            } else {
                ""
            },
            availability = availability(view.remaining, None),
        );
    } else {
        let total: u64 = view.files.iter().map(|f| f.size).sum();
        let button = if view.all_available() {
            format!(
                r#"<a class="button" href="/z/{token}" download>{DOWNLOAD_ICON}Download all<span class="suffix">.zip</span></a>"#
            )
        } else {
            r#"<span class="button disabled" aria-disabled="true">Download all<span class="suffix">.zip</span></span>"#.to_owned()
        };
        let limit = view
            .download_limit
            .map(|l| format!(" Each file can be downloaded {}.", times(l)))
            .unwrap_or_default();
        let _ = write!(
            body,
            r#"<div class="glyph bundle">{icon}</div>
<h1>{heading}</h1>
<p class="meta">{counted}{size} in total</p>
{button}
<p class="note">{availability}{limit}{refresh}</p>
<ul class="files">"#,
            icon = icon(FileKind::Bundle),
            heading = title
                .clone()
                .unwrap_or_else(|| file_count(view.files.len())),
            counted = if title.is_some() {
                format!("{} · ", file_count(view.files.len()))
            } else {
                String::new()
            },
            size = format_bytes(total),
            availability = availability(view.remaining, None),
        );
        for file in &view.files {
            let name = escape(&file.name);
            let id = escape(&file.id);
            let action = if file.remaining_downloads == Some(0) {
                r#"<span class="done">Limit reached</span>"#.to_owned()
            } else {
                format!(
                    r#"<a class="mini" href="/d/{token}/{id}" download aria-label="Download {name}">{DOWNLOAD_ICON}</a>"#
                )
            };
            let _ = write!(
                body,
                r#"<li><div class="glyph small {kind}">{icon}</div><div class="info"><span class="file">{name}</span><span class="meta">{size}</span></div>{action}</li>"#,
                kind = kind_class(file.kind),
                icon = icon(file.kind),
                size = format_bytes(file.size),
            );
        }
        body.push_str("</ul>");
    }
    let page_title = title.unwrap_or_else(|| match view.files.as_slice() {
        [file] => escape(&file.name),
        [] => "No files yet".to_owned(),
        files => file_count(files.len()),
    });
    document(&page_title, &body)
}

/// The password form of a protected share. Reveals nothing about its files,
/// not even the title.
pub fn locked(token: &str, message: Option<&str>) -> String {
    let token = escape(token);
    let (invalid, alert) = match message {
        Some(message) => (
            r#" aria-invalid="true" aria-describedby="password-error""#,
            format!(
                r#"<p id="password-error" class="error" role="alert">{}</p>"#,
                escape(message)
            ),
        ),
        None => ("", String::new()),
    };
    let body = format!(
        r#"<div class="glyph bundle">{LOCK_ICON}</div>
<h1>Password required</h1>
<p class="meta">Enter the password you got from the person sharing these files.</p>
<form class="unlock" method="post" action="/s/{token}">
<label for="password">Password</label>
<input id="password" name="password" type="password" required maxlength="{MAX_PASSWORD_CHARS}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" autofocus{invalid}>
{alert}<button class="button" type="submit">Unlock</button>
</form>"#
    );
    document("Password required", &body)
}

/// A direct file or ZIP link of a protected share opened without unlocking.
pub fn locked_download(token: &str) -> String {
    let body = format!(
        r#"<div class="glyph bundle">{LOCK_ICON}</div>
<h1>Password required</h1>
<p class="meta">These files are protected. Enter the password on the share page first.</p>
<a class="button" href="/s/{token}">Enter password</a>"#,
        token = escape(token),
    );
    document("Password required", &body)
}

pub fn error(reason: Unavailable) -> String {
    let (headline, sentence) = match reason {
        Unavailable::Expired => (
            "This link is gone",
            "Its time ran out. Ask for a new link from the computer that shared the file.",
        ),
        Unavailable::Stopped => (
            "Sharing was stopped",
            "The owner stopped sharing this file.",
        ),
        Unavailable::LimitReached => (
            "Download limit reached",
            "This file was downloaded as often as allowed.",
        ),
        Unavailable::NotFound => ("Nothing here", "This link is not valid."),
        Unavailable::FileUnavailable => (
            "File unavailable",
            "The shared file can't be read right now.",
        ),
        Unavailable::FileRemoved => (
            "File removed",
            "The owner removed this file from the shared link.",
        ),
        Unavailable::Empty => (
            "No files yet",
            "Nothing has been added to this link yet. Try again later.",
        ),
        Unavailable::Locked => (
            "Password required",
            "Open the share link and enter the password first.",
        ),
    };
    let body = format!(
        r#"<div class="glyph muted">{ALERT_ICON}</div>
<h1>{headline}</h1>
<p class="meta">{sentence}</p>"#
    );
    document(headline, &body)
}

fn document(title: &str, body: &str) -> String {
    format!(
        r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex, nofollow">
<title>{title} · Mayfly</title>
<style>{CSS}</style>
</head>
<body>
<main>
<header class="brand"><span class="mark">{MARK_ICON}</span><span class="word">mayfly</span></header>
<section class="card">
{body}
</section>
<footer>Shared for a moment from a computer on your network. No account, no cloud.<br>This page uses unencrypted HTTP. Only use it on networks you trust.<br><a href="{WEBSITE_URL}" rel="noopener noreferrer">Mayfly</a> · © {year} Phillipp Bertram</footer>
</main>
</body>
</html>
"#,
        year = year(SystemTime::now()),
    )
}

/// The UTC calendar year of `time` (proleptic Gregorian; Howard Hinnant's
/// civil-from-days), so the footer needs no date library.
fn year(time: SystemTime) -> i64 {
    let days = time
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_secs() / 86_400) as i64;
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    // Month indices 10 and 11 are January and February of the following year.
    year_of_era + era * 400 + i64::from(month_index >= 10)
}

fn availability(remaining: Option<Duration>, downloads_left: Option<u32>) -> String {
    let time = match remaining {
        None => "Available until the owner stops sharing".to_owned(),
        Some(d) if d < Duration::from_secs(60) => "Lives for less than a minute".to_owned(),
        Some(d) => {
            let minutes = d.as_secs().div_ceil(60);
            if minutes < 90 {
                format!("Lives for about {minutes} more minutes")
            } else {
                format!("Lives for about {} more hours", (minutes + 30) / 60)
            }
        }
    };
    match downloads_left {
        Some(1) => format!("{time} · 1 download left."),
        Some(n) => format!("{time} · {n} downloads left."),
        None => format!("{time}."),
    }
}

fn file_count(n: usize) -> String {
    if n == 1 {
        "1 file".to_owned()
    } else {
        format!("{n} files")
    }
}

fn times(n: u32) -> String {
    match n {
        1 => "once".to_owned(),
        2 => "twice".to_owned(),
        n => format!("{n} times"),
    }
}

/// Decimal units, matching the desktop interface.
pub fn format_bytes(bytes: u64) -> String {
    match bytes {
        b if b < 1_000 => format!("{b} B"),
        b if b < 1_000_000 => format!("{} KB", (b as f64 / 1e3).round()),
        b if b < 1_000_000_000 => format!("{:.1} MB", b as f64 / 1e6),
        b => format!("{:.1} GB", b as f64 / 1e9),
    }
}

pub fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            c => out.push(c),
        }
    }
    out
}

fn kind_label(kind: FileKind) -> &'static str {
    match kind {
        FileKind::Image => "Image",
        FileKind::Document => "Document",
        FileKind::Archive => "Archive",
        FileKind::Audio => "Audio",
        FileKind::Video => "Video",
        FileKind::Other => "File",
        FileKind::Bundle => "Files",
    }
}

fn kind_class(kind: FileKind) -> &'static str {
    match kind {
        FileKind::Image => "image",
        FileKind::Document => "document",
        FileKind::Archive => "archive",
        FileKind::Audio => "audio",
        FileKind::Video => "video",
        FileKind::Other => "other",
        FileKind::Bundle => "bundle",
    }
}

fn icon(kind: FileKind) -> &'static str {
    match kind {
        FileKind::Image => IMAGE_ICON,
        FileKind::Document => DOCUMENT_ICON,
        FileKind::Archive => ARCHIVE_ICON,
        FileKind::Audio => AUDIO_ICON,
        FileKind::Video => VIDEO_ICON,
        FileKind::Other => FILE_ICON,
        FileKind::Bundle => BUNDLE_ICON,
    }
}

// Icons follow the Lucide shapes used by the desktop app.
const FILE_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>"#;
const DOCUMENT_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/></svg>"#;
const IMAGE_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><circle cx="10" cy="12" r="2"/><path d="m20 17-1.3-1.3a2 2 0 0 0-2.8 0L9 22"/></svg>"#;
const ARCHIVE_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 6h2M10 10h2M10 14h2"/><rect x="9" y="17" width="4" height="3" rx="1"/></svg>"#;
const AUDIO_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><circle cx="10" cy="17" r="2"/><path d="M12 17v-6l3 1.5"/></svg>"#;
const VIDEO_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 11 5 3-5 3Z"/></svg>"#;
const BUNDLE_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/></svg>"#;
const DOWNLOAD_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>"#;
const ALERT_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>"#;
const LOCK_ICON: &str = r#"<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>"#;
const MARK_ICON: &str = r#"<svg viewBox="6 2 58 46" aria-hidden="true"><g class="wing"><path class="w" d="M24 37C21 25 25 13 35 5C38 16 36 28 31 37Z"/></g><path class="body" pathLength="1" d="M10 43C20 37 33 36 44 32"/></svg>"#;

const CSS: &str = r#":root{--bg:#f5f8f7;--surface:#fff;--muted-bg:#eef3f1;--border:#dfe7e4;--text:#142326;--muted:#4b5957;--faint:#626f6d;--accent:#0e7c66;--accent-hover:#0b6a57;--accent-fg:#fff;--image:#7c5cd6;--document:#3f6fd1;--archive:#a2641a;--audio:#c2437b;--video:#c24a3a;--shadow:0 1px 2px rgb(15 26 28/.06),0 8px 24px rgb(15 26 28/.06)}
@media (prefers-color-scheme:dark){:root{--bg:#0f1a1c;--surface:#152224;--muted-bg:#1c2b2e;--border:#26373a;--text:#e8efed;--muted:#a3b3b0;--faint:#869794;--accent:#3dd6a8;--accent-hover:#5fe0b9;--accent-fg:#0b1f19;--image:#b7a4f5;--document:#8fb0f2;--archive:#e8b06a;--audio:#f19ac0;--video:#f2998c;--shadow:0 1px 2px rgb(0 0 0/.3),0 8px 24px rgb(0 0 0/.25)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:560px;margin:0 auto;padding:28px 16px 32px;display:flex;flex-direction:column;min-height:100vh}
.brand{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;letter-spacing:-.01em;margin:0 4px 20px}
.mark{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:var(--accent);color:var(--accent-fg)}
.mark svg{width:17px;height:17px;stroke-width:5.5}
.mark .w{fill:currentColor;stroke:none}
.mark{animation:mark-in .5s cubic-bezier(.34,1.56,.64,1) both}
.mark svg{transition:transform .18s ease-out}
.mark .body{stroke-dasharray:1;animation:draw .4s .15s ease-out both}
.mark .wing,.mark .w{transform-box:fill-box;transform-origin:35% 100%}
.mark .w{animation:wing-in .45s .3s cubic-bezier(.34,1.56,.64,1) both}
.word{animation:word-in .35s .25s ease-out both}
.brand:hover .mark svg{transform:translateY(-1.5px) rotate(-6deg)}
.brand:hover .wing{animation:flutter .22s ease-in-out 3}
@keyframes mark-in{from{opacity:0;transform:scale(.5) rotate(-20deg)}}
@keyframes draw{from{stroke-dashoffset:1}}
@keyframes wing-in{from{transform:scaleY(0)}}
@keyframes word-in{from{opacity:0;transform:translateX(-4px)}}
@keyframes flutter{50%{transform:rotate(-14deg) scaleX(.7)}}
svg{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.card{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:32px 24px 24px;box-shadow:var(--shadow);text-align:center}
.glyph{display:flex;align-items:center;justify-content:center;width:64px;height:64px;margin:0 auto 18px;border-radius:16px;background:var(--muted-bg);color:var(--muted)}
.glyph svg{width:30px;height:30px}
.glyph.small{width:40px;height:40px;margin:0;border-radius:11px;flex:none}
.glyph.small svg{width:20px;height:20px}
.image{color:var(--image)}.document{color:var(--document)}.archive{color:var(--archive)}.audio{color:var(--audio)}.video{color:var(--video)}.bundle{color:var(--accent)}.muted{color:var(--faint)}
h1{margin:0;font-size:22px;line-height:28px;font-weight:600;letter-spacing:-.015em;overflow-wrap:anywhere}
.meta{margin:6px 0 0;color:var(--muted);font-size:14px;font-variant-numeric:tabular-nums}
.button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;margin:24px 0 0;border-radius:14px;background:var(--accent);color:var(--accent-fg);font-size:17px;font-weight:600;text-decoration:none;transition:background .15s}
.button:hover{background:var(--accent-hover)}
.button:focus-visible,.mini:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.button svg{width:20px;height:20px;stroke-width:2}
.button .suffix{font-weight:500;opacity:.75}
.button.disabled{background:var(--muted-bg);color:var(--faint)}
.note{margin:14px 0 0;color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
.note a{color:var(--accent);font-weight:500;text-decoration:none}
.note a:hover{text-decoration:underline}
.files{list-style:none;margin:24px -8px 0;padding:8px 0 0;border-top:1px solid var(--border);text-align:left}
.files li{display:flex;align-items:center;gap:12px;padding:8px;border-radius:12px;min-height:56px}
.info{flex:1;min-width:0;display:flex;flex-direction:column}
.file{font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.info .meta{margin:0;font-size:12px}
.mini{display:flex;align-items:center;justify-content:center;width:44px;height:44px;flex:none;border-radius:12px;color:var(--accent);border:1px solid var(--border);transition:background .15s}
.mini:hover{background:var(--muted-bg)}
.mini svg{width:19px;height:19px;stroke-width:1.9}
.done{flex:none;font-size:12px;color:var(--faint)}
.unlock{margin:24px 0 0;text-align:left}
.unlock label{display:block;margin:0 0 6px;font-size:13px;font-weight:500;color:var(--muted)}
.unlock input{display:block;width:100%;min-height:48px;padding:0 14px;border:1px solid var(--border);border-radius:12px;background:var(--bg);color:var(--text);font:inherit;font-size:17px}
.unlock input:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:transparent}
.unlock input[aria-invalid]{border-color:var(--video)}
.error{margin:8px 0 0;color:var(--video);font-size:13px}
button.button{width:100%;border:0;font:inherit;font-size:17px;font-weight:600;cursor:pointer}
footer{margin-top:auto;padding-top:28px;color:var(--faint);font-size:12px;line-height:1.6;text-align:center}
footer a{color:inherit;font-weight:500;text-underline-offset:2px}
footer a:hover{color:var(--muted)}
@media (min-width:600px){main{padding-top:64px}.card{padding:40px 36px 28px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shares::PageFile;

    fn file(name: &str, remaining: Option<u32>) -> PageFile {
        PageFile {
            id: name.replace('.', "_"),
            name: name.into(),
            size: 2_400_000,
            kind: FileKind::Document,
            remaining_downloads: remaining,
        }
    }

    #[test]
    fn escapes_hostile_names() {
        let view = PageView {
            files: vec![file(r#"<script>alert("x")</script>&'.pdf"#, None)],
            remaining: None,
            download_limit: None,
            edited: false,
            title: None,
        };
        let html = landing("TOKEN", &view);
        assert!(!html.contains("<script>"));
        assert!(html.contains("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;.pdf"));
    }

    #[test]
    fn single_page_links_the_download_and_states_limits() {
        let view = PageView {
            files: vec![file("a.pdf", Some(2))],
            remaining: Some(Duration::from_secs(7 * 60 + 1)),
            download_limit: Some(3),
            edited: false,
            title: None,
        };
        let html = landing("TOKEN", &view);
        assert!(html.contains(r#"href="/d/TOKEN/a_pdf""#));
        assert!(!html.contains("Refresh"));
        assert!(html.contains("2.4 MB · Document"));
        assert!(html.contains("about 8 more minutes · 2 downloads left."));
    }

    #[test]
    fn bundle_page_offers_zip_and_individual_files() {
        let view = PageView {
            files: vec![file("a.pdf", Some(1)), file("b.pdf", Some(0))],
            remaining: None,
            download_limit: Some(1),
            edited: false,
            title: None,
        };
        let html = landing("TOKEN", &view);
        assert!(html.contains("2 files"));
        assert!(html.contains(r#"href="/d/TOKEN/a_pdf""#));
        assert!(!html.contains(r#"href="/d/TOKEN/b_pdf""#));
        assert!(html.contains("Limit reached"));
        // One file is exhausted, so the archive isn't offered.
        assert!(!html.contains(r#"href="/z/TOKEN""#));
        assert!(html.contains("Each file can be downloaded once."));
    }

    #[test]
    fn edited_and_empty_shares_offer_a_refresh() {
        let view = PageView {
            files: vec![file("a.pdf", None)],
            remaining: None,
            download_limit: None,
            edited: true,
            title: None,
        };
        let html = landing("TOKEN", &view);
        assert!(html.contains("<h1>a.pdf</h1>"));
        assert!(html.contains(r#"href="/d/TOKEN/a_pdf""#));
        assert!(html.contains(r#"<a href="/s/TOKEN">Refresh</a>"#));

        let empty = PageView {
            files: vec![],
            ..view
        };
        let html = landing("TOKEN", &empty);
        assert!(html.contains("No files yet"));
        assert!(!html.contains("/z/TOKEN"));
    }

    #[test]
    fn titles_head_the_page_and_are_escaped() {
        let view = PageView {
            files: vec![file("a.pdf", None), file("b.pdf", None)],
            remaining: None,
            download_limit: None,
            edited: false,
            title: Some("<b>Holiday</b> photos".into()),
        };
        let html = landing("TOKEN", &view);
        assert!(html.contains("<h1>&lt;b&gt;Holiday&lt;/b&gt; photos</h1>"));
        assert!(html.contains("2 files · "));
        assert!(html.contains("<title>&lt;b&gt;Holiday&lt;/b&gt; photos · Mayfly</title>"));

        let single = PageView {
            files: vec![file("a.pdf", None)],
            title: Some("Contract".into()),
            ..view
        };
        let html = landing("TOKEN", &single);
        assert!(html.contains("<h1>Contract</h1>"));
        assert!(html.contains("a.pdf · 2.4 MB · Document"));
    }

    #[test]
    fn password_form_hides_the_share_and_escapes_messages() {
        let html = locked("TOKEN", Some("<b>wrong</b>"));
        assert!(html.contains(r#"<form class="unlock" method="post" action="/s/TOKEN">"#));
        assert!(html.contains(r#"type="password""#));
        assert!(html.contains(r#"role="alert">&lt;b&gt;wrong&lt;/b&gt;</p>"#));
        assert!(html.contains(r#"aria-invalid="true""#));
        assert!(!locked("TOKEN", None).contains(r#"aria-invalid="true""#));
        assert!(locked_download("TOKEN").contains(r#"href="/s/TOKEN""#));
        assert!(PAGE_CSP.contains("form-action 'self'"));
    }

    #[test]
    fn csp_hash_matches_the_inline_style() {
        assert!(PAGE_CSP.contains("style-src 'sha256-"));
        assert!(!PAGE_CSP.contains("unsafe"));
        assert!(!CSS.contains("</style"));
    }

    #[test]
    fn every_page_credits_mayfly_without_leaking_the_share_url() {
        let footer = format!(
            r#"<a href="{WEBSITE_URL}" rel="noopener noreferrer">Mayfly</a> · © {} Phillipp Bertram</footer>"#,
            year(SystemTime::now())
        );
        let pages = [
            locked("TOKEN", None),
            locked_download("TOKEN"),
            error(Unavailable::Expired),
        ];
        for html in &pages {
            assert!(html.contains(&footer), "{html}");
            assert!(html.contains(r#"<meta name="referrer" content="no-referrer">"#));
        }
    }

    #[test]
    fn computes_the_utc_year() {
        let at = |seconds: u64| year(UNIX_EPOCH + Duration::from_secs(seconds));
        assert_eq!(at(0), 1970);
        assert_eq!(at(951_782_399), 2000); // 2000-02-28 23:59:59
        assert_eq!(at(951_868_800), 2000); // 2000-03-01, after a leap day
        assert_eq!(at(1_767_225_599), 2025); // 2025-12-31 23:59:59
        assert_eq!(at(1_767_225_600), 2026); // 2026-01-01 00:00:00
        assert_eq!(at(1_793_664_000), 2026); // 2026-11-03
    }

    #[test]
    fn formats_sizes_like_the_desktop() {
        assert_eq!(format_bytes(999), "999 B");
        assert_eq!(format_bytes(1_500), "2 KB");
        assert_eq!(format_bytes(2_400_000), "2.4 MB");
        assert_eq!(format_bytes(4_300_000_000), "4.3 GB");
    }
}
