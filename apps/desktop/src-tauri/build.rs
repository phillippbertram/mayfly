use std::process::Command;

fn main() {
    embed_build_commit();
    tauri_build::build();
}

/// Embeds the short commit hash as `FILEHOP_BUILD_COMMIT` (empty when unknown), so
/// the About dialog can name the exact source of a build. CI provides `GITHUB_SHA`;
/// local builds ask Git and rebuild when HEAD moves.
fn embed_build_commit() {
    println!("cargo:rerun-if-env-changed=GITHUB_SHA");
    let commit = std::env::var("GITHUB_SHA")
        .ok()
        .filter(|sha| sha.len() >= 7 && sha.bytes().all(|b| b.is_ascii_hexdigit()))
        .map(|sha| sha[..7].to_ascii_lowercase())
        .or_else(|| {
            for path in ["HEAD", "packed-refs"] {
                if let Some(path) = git(&["rev-parse", "--git-path", path]) {
                    println!("cargo:rerun-if-changed={path}");
                }
            }
            if let Some(branch) = git(&["symbolic-ref", "-q", "HEAD"]) {
                if let Some(path) = git(&["rev-parse", "--git-path", &branch]) {
                    println!("cargo:rerun-if-changed={path}");
                }
            }
            git(&["rev-parse", "--short=7", "HEAD"])
        })
        .unwrap_or_default();
    println!("cargo:rustc-env=FILEHOP_BUILD_COMMIT={commit}");
}

fn git(args: &[&str]) -> Option<String> {
    let output = Command::new("git").args(args).output().ok()?;
    let text = String::from_utf8(output.stdout).ok()?.trim().to_owned();
    (output.status.success() && !text.is_empty()).then_some(text)
}
