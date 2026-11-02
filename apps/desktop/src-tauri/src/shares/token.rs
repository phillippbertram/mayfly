//! Share access tokens and opaque identifiers.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;

/// 32 random bytes encode to 43 base64url characters without padding.
pub const TOKEN_LEN: usize = 43;

/// A 256-bit token from the operating system's CSPRNG, encoded as base64url.
pub fn generate() -> Result<String, getrandom::Error> {
    random_string::<32>()
}

/// Opaque identifier for shares and staged files. IDs are not credentials.
pub fn generate_id() -> Result<String, getrandom::Error> {
    random_string::<12>()
}

/// Cheap shape check so malformed tokens are rejected before any lookup.
pub fn is_well_formed(candidate: &str) -> bool {
    candidate.len() == TOKEN_LEN
        && candidate
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn random_string<const N: usize>() -> Result<String, getrandom::Error> {
    let mut bytes = [0u8; N];
    getrandom::fill(&mut bytes)?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn tokens_are_url_safe_and_well_formed() {
        for _ in 0..200 {
            let token = generate().unwrap();
            assert_eq!(token.len(), TOKEN_LEN);
            assert!(is_well_formed(&token), "{token} should be well formed");
        }
    }

    #[test]
    fn tokens_are_unique() {
        let tokens: HashSet<_> = (0..10_000).map(|_| generate().unwrap()).collect();
        assert_eq!(tokens.len(), 10_000);
    }

    #[test]
    fn rejects_malformed_tokens() {
        let valid = generate().unwrap();
        assert!(!is_well_formed(""));
        assert!(!is_well_formed(&valid[1..]));
        assert!(!is_well_formed(&format!("{valid}A")));
        assert!(!is_well_formed(&format!("{}/", &valid[1..])));
        assert!(!is_well_formed(&format!("{}.", &valid[1..])));
        assert!(!is_well_formed(&format!("{}%", &valid[1..])));
        assert!(!is_well_formed(
            "../../../../../../../../../../../etc/passwd"
        ));
    }
}
