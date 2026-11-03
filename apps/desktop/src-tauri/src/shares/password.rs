//! Share passwords: plaintext handling, generated passwords, and Argon2id
//! verifiers. Only verifiers are kept; plaintext is wiped when dropped.

use argon2::{Algorithm, Argon2, Params, Version};
use serde::{Deserialize, Deserializer};
use zeroize::Zeroizing;

use super::registry::ShareError;

/// Longest accepted password, in characters.
pub const MAX_PASSWORD_CHARS: usize = 128;
/// Generated passwords avoid look-alike characters such as 0/o and 1/l/i.
const ALPHABET: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";
const GROUPS: usize = 3;
const GROUP_LEN: usize = 4;
const SALT_LEN: usize = 16;
const HASH_LEN: usize = 32;

/// A plaintext password, wiped from memory when dropped and never printed.
#[derive(Clone)]
pub struct Password(Zeroizing<String>);

impl<'de> Deserialize<'de> for Password {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        String::deserialize(deserializer).map(Self::new)
    }
}

impl std::fmt::Debug for Password {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Password(…)")
    }
}

impl Password {
    pub fn new(value: String) -> Self {
        Self(Zeroizing::new(value))
    }

    pub fn expose(&self) -> &str {
        &self.0
    }

    /// Passwords are used as typed: no trimming, but blank ones, control
    /// characters, and overlong ones are refused.
    pub fn validate(&self) -> Result<(), ShareError> {
        if self.0.trim().is_empty() {
            return Err(ShareError("Enter a password.".into()));
        }
        if self.0.chars().any(char::is_control) {
            return Err(ShareError(
                "Passwords can't contain line breaks or control characters.".into(),
            ));
        }
        if self.0.chars().count() > MAX_PASSWORD_CHARS {
            return Err(ShareError(format!(
                "Keep the password under {MAX_PASSWORD_CHARS} characters."
            )));
        }
        Ok(())
    }
}

/// A random password such as `k7mp-x3qa-9rtd`: about 59 bits, easy to type on a phone.
pub fn generate() -> Result<Password, ShareError> {
    let mut out = Zeroizing::new(String::with_capacity(GROUPS * (GROUP_LEN + 1)));
    // Rejection sampling keeps every character equally likely.
    let limit = (256 / ALPHABET.len() * ALPHABET.len()) as u8;
    let mut picked = 0;
    while picked < GROUPS * GROUP_LEN {
        let mut bytes = Zeroizing::new([0u8; 32]);
        getrandom::fill(bytes.as_mut())
            .map_err(|_| ShareError("Mayfly couldn't create a password.".into()))?;
        for &b in bytes.iter().filter(|&&b| b < limit) {
            if picked == GROUPS * GROUP_LEN {
                break;
            }
            if picked > 0 && picked % GROUP_LEN == 0 {
                out.push('-');
            }
            out.push(ALPHABET[usize::from(b) % ALPHABET.len()] as char);
            picked += 1;
        }
    }
    Ok(Password(out))
}

/// An Argon2id hash with its own random salt.
#[derive(Clone)]
pub struct Verifier {
    salt: [u8; SALT_LEN],
    hash: Zeroizing<[u8; HASH_LEN]>,
}

impl std::fmt::Debug for Verifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Verifier(…)")
    }
}

impl Verifier {
    /// Hashes a validated password. Takes tens of milliseconds; call it off the
    /// async runtime and outside any lock.
    pub fn new(password: &Password) -> Result<Self, ShareError> {
        password.validate()?;
        let failed = || ShareError("Mayfly couldn't protect this share.".into());
        let mut salt = [0u8; SALT_LEN];
        getrandom::fill(&mut salt).map_err(|_| failed())?;
        let mut hash = Zeroizing::new([0u8; HASH_LEN]);
        argon2()
            .hash_password_into(password.expose().as_bytes(), &salt, hash.as_mut())
            .map_err(|_| failed())?;
        Ok(Self { salt, hash })
    }

    /// Compares in constant time. As slow as [`Verifier::new`].
    pub fn matches(&self, candidate: &str) -> bool {
        let mut hash = Zeroizing::new([0u8; HASH_LEN]);
        if argon2()
            .hash_password_into(candidate.as_bytes(), &self.salt, hash.as_mut())
            .is_err()
        {
            return false;
        }
        constant_time_eq(hash.as_ref(), self.hash.as_ref())
    }
}

/// OWASP's baseline for Argon2id: 19 MiB, two passes, one lane.
fn argon2() -> Argon2<'static> {
    let params = Params::new(19 * 1024, 2, 1, Some(HASH_LEN)).expect("valid Argon2 parameters");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn verifies_only_the_right_password() {
        let verifier = Verifier::new(&Password::new("correct horse".into())).unwrap();
        assert!(verifier.matches("correct horse"));
        assert!(!verifier.matches("correct horse "));
        assert!(!verifier.matches("Correct horse"));
        assert!(!verifier.matches(""));
    }

    #[test]
    fn salts_are_unique() {
        let password = Password::new("same".into());
        let a = Verifier::new(&password).unwrap();
        let b = Verifier::new(&password).unwrap();
        assert_ne!(a.salt, b.salt);
        assert_ne!(*a.hash, *b.hash);
        assert!(a.matches("same") && b.matches("same"));
    }

    #[test]
    fn rejects_blank_control_and_overlong_passwords() {
        for bad in ["", "   ", "a\nb", "a\u{7}b"] {
            assert!(Password::new(bad.into()).validate().is_err(), "{bad:?}");
        }
        assert!(Password::new("x".repeat(MAX_PASSWORD_CHARS + 1))
            .validate()
            .is_err());
        assert!(Password::new("ü".repeat(MAX_PASSWORD_CHARS))
            .validate()
            .is_ok());
        assert!(Verifier::new(&Password::new(" ".into())).is_err());
    }

    #[test]
    fn generated_passwords_are_grouped_and_distinct() {
        let mut seen = HashSet::new();
        for _ in 0..200 {
            let password = generate().unwrap();
            let text = password.expose();
            assert_eq!(text.len(), 14);
            let groups: Vec<_> = text.split('-').collect();
            assert_eq!(groups.len(), 3);
            assert!(groups
                .iter()
                .all(|g| g.len() == 4 && g.bytes().all(|b| ALPHABET.contains(&b))));
            assert!(password.validate().is_ok());
            assert!(seen.insert(text.to_owned()));
        }
    }

    #[test]
    fn secrets_never_show_in_debug_output() {
        let password = Password::new("hunter2".into());
        let verifier = Verifier::new(&password).unwrap();
        assert!(!format!("{password:?}{verifier:?}").contains("hunter2"));
    }
}
