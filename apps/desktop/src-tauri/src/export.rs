//! Checks for images the interface asks to save, such as QR code PNGs. The
//! webview supplies only the bytes and a suggested name; the user picks the
//! destination in the native save dialog.

const PNG_SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";
/// QR codes are a few kilobytes; anything far larger is not what we generate.
pub const MAX_PNG_BYTES: usize = 4 * 1024 * 1024;
const MAX_NAME_CHARS: usize = 120;

/// Accepts only PNG data of a plausible size.
pub fn validate_png(data: &[u8]) -> Result<(), String> {
    if data.len() > MAX_PNG_BYTES {
        return Err("The image is too large to save.".into());
    }
    if !data.starts_with(PNG_SIGNATURE) {
        return Err("FileHop can only save PNG images here.".into());
    }
    Ok(())
}

/// A plain file name ending in `.png`: no directories, control characters, or
/// characters that common file systems reject.
pub fn png_file_name(suggested: &str) -> String {
    let base = suggested.rsplit(['/', '\\']).next().unwrap_or_default();
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, ':' | '*' | '?' | '"' | '<' | '>' | '|') {
                '_'
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned.trim();
    let stem = trimmed
        .strip_suffix(".png")
        .or_else(|| trimmed.strip_suffix(".PNG"))
        .unwrap_or(trimmed)
        // No hidden files.
        .trim_start_matches('.');
    let stem: String = stem.chars().take(MAX_NAME_CHARS).collect();
    let stem = stem.trim();
    if stem.is_empty() {
        "filehop-qr.png".to_owned()
    } else {
        format!("{stem}.png")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_png_of_plausible_size() {
        let mut png = PNG_SIGNATURE.to_vec();
        png.extend_from_slice(&[0; 32]);
        assert!(validate_png(&png).is_ok());
        assert!(validate_png(b"GIF89a....").is_err());
        assert!(validate_png(&[]).is_err());
        let mut huge = PNG_SIGNATURE.to_vec();
        huge.resize(MAX_PNG_BYTES + 1, 0);
        assert!(validate_png(&huge).is_err());
    }

    #[test]
    fn names_are_plain_png_file_names() {
        assert_eq!(png_file_name("Report-qr.png"), "Report-qr.png");
        assert_eq!(png_file_name("Report-qr"), "Report-qr.png");
        assert_eq!(png_file_name("../../etc/passwd"), "passwd.png");
        assert_eq!(png_file_name("C:\\Users\\a\\x.png"), "x.png");
        assert_eq!(png_file_name("a:b*c?\"d\"<e>|\n.png"), "a_b_c__d__e___.png");
        assert_eq!(png_file_name(".hidden"), "hidden.png");
        assert_eq!(png_file_name("   "), "filehop-qr.png");
        assert_eq!(png_file_name(".png"), "filehop-qr.png");
        assert_eq!(png_file_name(&"x".repeat(300)).chars().count(), 124);
    }
}
