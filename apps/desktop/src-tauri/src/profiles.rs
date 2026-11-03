//! Link profiles: named URL templates that turn a share link into a link for a
//! compatible app, such as `myapp://import?url={encodedUrl}`.
//!
//! Templates are data. They are validated when saved and loaded, resolved in a
//! single pass so inserted values are never interpreted again, and never opened
//! or executed by Mayfly.

use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};

use crate::shares::token;

pub const MAX_PROFILES: usize = 20;
const MAX_NAME_CHARS: usize = 40;
const MAX_TEMPLATE_CHARS: usize = 2_000;
const PLACEHOLDERS: [&str; 5] = ["url", "encodedUrl", "filename", "encodedFilename", "token"];
/// Schemes that could run code or reach local resources if a link were followed.
const BLOCKED_SCHEMES: [&str; 6] = ["javascript", "data", "vbscript", "file", "blob", "about"];

/// `encodeURIComponent`: everything but unreserved characters is percent-encoded.
const COMPONENT: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'!')
    .remove(b'~')
    .remove(b'*')
    .remove(b'\'')
    .remove(b'(')
    .remove(b')');

/// A user-defined profile. The built-in share page has no template.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub template: String,
}

/// What templates can insert for one share.
pub struct Values<'a> {
    /// The share page URL.
    pub url: &'a str,
    /// The share's display name: its title, its file's name, or "N files".
    pub filename: &'a str,
    pub token: &'a str,
}

/// Checks a template and reports whether it uses a scheme other than HTTP(S).
pub fn validate_template(template: &str) -> Result<bool, String> {
    let template = template.trim();
    if template.is_empty() {
        return Err("Enter a URL template.".into());
    }
    if template.chars().count() > MAX_TEMPLATE_CHARS {
        return Err("Keep the template under 2,000 characters.".into());
    }
    if template.chars().any(char::is_control) {
        return Err("Remove line breaks and control characters.".into());
    }
    let scheme = scheme_of(template)
        .ok_or_else(|| "Start with a scheme, such as myapp:// or https://.".to_owned())?;
    if BLOCKED_SCHEMES.contains(&scheme.as_str()) {
        return Err(format!("The {scheme}: scheme isn't allowed."));
    }
    let mut rest = template;
    while let Some(start) = rest.find(['{', '}']) {
        if rest[start..].starts_with('}') {
            return Err("A brace is unmatched. Use placeholders like {encodedUrl}.".into());
        }
        let after = &rest[start + 1..];
        let Some(end) = after
            .find(['{', '}'])
            .filter(|&i| after[i..].starts_with('}'))
        else {
            return Err("A brace is unmatched. Use placeholders like {encodedUrl}.".into());
        };
        let name = &after[..end];
        if !PLACEHOLDERS.contains(&name) {
            return Err(format!("Unknown placeholder {{{name}}}."));
        }
        rest = &after[end + 1..];
    }
    Ok(!matches!(scheme.as_str(), "http" | "https"))
}

/// Replaces placeholders in one pass. Inserted values are copied literally, so
/// braces in a file name never become placeholders. Expects a valid template.
pub fn resolve(template: &str, values: &Values) -> String {
    let template = template.trim();
    let mut out = String::with_capacity(template.len() + values.url.len());
    let mut rest = template;
    while let Some(start) = rest.find('{') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        let Some(end) = after.find('}') else {
            out.push_str(&rest[start..]);
            return out;
        };
        match &after[..end] {
            "url" => out.push_str(values.url),
            "encodedUrl" => out.extend(utf8_percent_encode(values.url, COMPONENT)),
            "filename" => out.push_str(values.filename),
            "encodedFilename" => out.extend(utf8_percent_encode(values.filename, COMPONENT)),
            "token" => out.push_str(values.token),
            other => {
                out.push('{');
                out.push_str(other);
                out.push('}');
            }
        }
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    out
}

/// Trims and checks a profile name.
pub fn validate_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Give the profile a name.".into());
    }
    if name.chars().any(char::is_control) {
        return Err("Names can't contain line breaks or control characters.".into());
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err("Keep the name under 40 characters.".into());
    }
    Ok(name.to_owned())
}

/// Checks a stored profile as a whole, for loading.
pub fn validate_profile(profile: &Profile) -> Result<Profile, String> {
    if !token::is_well_formed_id(&profile.id) {
        return Err("invalid id".into());
    }
    validate_template(&profile.template)?;
    Ok(Profile {
        id: profile.id.clone(),
        name: validate_name(&profile.name)?,
        template: profile.template.trim().to_owned(),
    })
}

fn scheme_of(template: &str) -> Option<String> {
    let (scheme, _) = template.split_once(':')?;
    let mut chars = scheme.chars();
    let valid = chars.next().is_some_and(|c| c.is_ascii_alphabetic())
        && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'));
    valid.then(|| scheme.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    const URL: &str = "http://192.168.1.20:8765/s/TOKEN";

    fn values(filename: &str) -> Values<'_> {
        Values {
            url: URL,
            filename,
            token: "TOKEN",
        }
    }

    #[test]
    fn resolves_every_placeholder() {
        let template =
            "myapp://import?u={url}&e={encodedUrl}&f={filename}&ef={encodedFilename}&t={token}";
        assert_eq!(validate_template(template), Ok(true));
        assert_eq!(
            resolve(template, &values("Bericht Ü 100% {url}.pdf")),
            "myapp://import?u=http://192.168.1.20:8765/s/TOKEN\
             &e=http%3A%2F%2F192.168.1.20%3A8765%2Fs%2FTOKEN\
             &f=Bericht Ü 100% {url}.pdf\
             &ef=Bericht%20%C3%9C%20100%25%20%7Burl%7D.pdf\
             &t=TOKEN"
        );
    }

    #[test]
    fn inserted_values_are_never_resolved_again() {
        let out = resolve("x://{filename}/{token}", &values("{token}{encodedUrl}"));
        assert_eq!(out, "x://{token}{encodedUrl}/TOKEN");
    }

    #[test]
    fn encodes_like_encode_uri_component() {
        let out = resolve(
            "x://?n={encodedFilename}",
            &values("a b+c/d?e#f&g=h!~*'()-_.é"),
        );
        assert_eq!(out, "x://?n=a%20b%2Bc%2Fd%3Fe%23f%26g%3Dh!~*'()-_.%C3%A9");
    }

    #[test]
    fn https_templates_are_not_custom_schemes() {
        assert_eq!(
            validate_template("https://example.com/open?u={encodedUrl}"),
            Ok(false)
        );
        assert_eq!(validate_template("HTTP://example.com/{token}"), Ok(false));
    }

    #[test]
    fn rejects_malformed_and_unsafe_templates() {
        for (template, reason) in [
            ("", "Enter"),
            ("   ", "Enter"),
            ("no-scheme/{url}", "scheme"),
            ("://x", "scheme"),
            ("1app://x", "scheme"),
            ("javascript:alert({url})", "javascript"),
            ("JavaScript:alert(1)", "javascript"),
            ("data:text/html,{url}", "data"),
            ("file:///etc/{token}", "file"),
            ("vbscript:x", "vbscript"),
            ("myapp://{unknown}", "Unknown placeholder {unknown}"),
            ("myapp://{URL}", "Unknown placeholder {URL}"),
            ("myapp://{url", "unmatched"),
            ("myapp://url}", "unmatched"),
            ("myapp://{{url}}", "unmatched"),
            ("myapp://{}", "Unknown placeholder {}"),
            ("myapp://a\nb", "control"),
            ("myapp://a\u{7}b", "control"),
        ] {
            let error = validate_template(template).unwrap_err();
            assert!(error.contains(reason), "{template:?}: {error}");
        }
        assert!(validate_template(&format!("x://{}", "a".repeat(2_000))).is_err());
    }

    #[test]
    fn names_are_trimmed_and_bounded() {
        assert_eq!(validate_name("  Documents  ").unwrap(), "Documents");
        assert!(validate_name("").is_err());
        assert!(validate_name("a\tb").is_err());
        assert!(validate_name(&"x".repeat(41)).is_err());
    }

    #[test]
    fn stored_profiles_need_a_valid_id() {
        let mut profile = Profile {
            id: token::generate_id().unwrap(),
            name: " App ".into(),
            template: " myapp://{encodedUrl} ".into(),
        };
        let valid = validate_profile(&profile).unwrap();
        assert_eq!(valid.name, "App");
        assert_eq!(valid.template, "myapp://{encodedUrl}");
        profile.id = "../x".into();
        assert!(validate_profile(&profile).is_err());
    }
}
