//! Public LAN routes. Only landing pages, the password form, and downloads
//! exist here; request paths are matched against in-memory tokens and never
//! touch the filesystem.

use std::sync::Arc;
use std::time::Duration;

use axum::body::{to_bytes, Body};
use axum::extract::rejection::PathRejection;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::middleware::map_response;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};
use tokio::sync::Semaphore;
use zeroize::Zeroizing;

use super::pages;
use super::zip::{self, ZipPlan};
use crate::shares::password::MAX_PASSWORD_CHARS;
use crate::shares::{
    self, Clock, Registry, SharedFile, Target, Unavailable, UnlockRefusal, Unlocked,
};

/// Password checks running at once. Each takes 19 MiB and a core for a moment.
const MAX_PASSWORD_CHECKS: usize = 2;
/// Enough for a percent-encoded password of the longest allowed length.
const MAX_FORM_BYTES: usize = 2_048;
const UNLOCK_COOKIE: &str = "mayfly_unlock";

#[derive(Clone)]
pub struct HttpState {
    pub registry: Arc<Registry>,
    pub clock: Arc<dyn Clock>,
    password_checks: Arc<Semaphore>,
}

impl HttpState {
    pub fn new(registry: Arc<Registry>, clock: Arc<dyn Clock>) -> Self {
        Self {
            registry,
            clock,
            password_checks: Arc::new(Semaphore::new(MAX_PASSWORD_CHECKS)),
        }
    }
}

pub fn router(state: HttpState) -> Router {
    Router::new()
        .route("/s/{token}", get(landing).post(unlock))
        .route("/d/{token}/{file}", get(download_file))
        .route("/z/{token}", get(download_all))
        .fallback(not_found)
        .layer(map_response(common_headers))
        .with_state(state)
}

async fn landing(
    State(state): State<HttpState>,
    headers: HeaderMap,
    token: Result<Path<String>, PathRejection>,
) -> Response {
    let Ok(Path(token)) = token else {
        return error(Unavailable::NotFound);
    };
    match state.registry.page(&token, credential(&headers)) {
        Ok(view) => html(StatusCode::OK, pages::landing(&token, &view)),
        Err(Unavailable::Locked) => html(StatusCode::OK, pages::locked(&token, None)),
        Err(reason) => error(reason),
    }
}

/// `POST /s/{token}` with `password=…`. A correct password sets a cookie that
/// unlocks this share's page and downloads for this browser only. Attempts are
/// throttled per share and never count as downloads.
async fn unlock(
    State(state): State<HttpState>,
    headers: HeaderMap,
    token: Result<Path<String>, PathRejection>,
    body: Body,
) -> Response {
    let Ok(Path(token)) = token else {
        return error(Unavailable::NotFound);
    };
    match state.registry.page(&token, None) {
        Err(Unavailable::Locked) => {}
        Ok(_) => return see_other(&token, None),
        Err(reason) => return error(reason),
    }
    let form = |status, message: &str| html(status, pages::locked(&token, Some(message)));
    if !same_origin(&headers) {
        return form(
            StatusCode::FORBIDDEN,
            "Open the link again and enter the password on that page.",
        );
    }
    let Ok(bytes) = to_bytes(body, MAX_FORM_BYTES).await else {
        return form(StatusCode::PAYLOAD_TOO_LARGE, "That password is too long.");
    };
    let password = form_urlencoded::parse(&bytes)
        .find(|(name, _)| name == "password")
        .map(|(_, value)| Zeroizing::new(value.into_owned()));
    drop(bytes);
    let Some(password) = password.filter(|p| !p.is_empty()) else {
        return form(StatusCode::BAD_REQUEST, "Enter the password.");
    };
    if password.chars().count() > MAX_PASSWORD_CHARS {
        return form(StatusCode::BAD_REQUEST, "That password is too long.");
    }
    let Ok(permit) = state.password_checks.clone().try_acquire_owned() else {
        return retry_after(
            form(
                StatusCode::SERVICE_UNAVAILABLE,
                "Mayfly is busy. Try again in a moment.",
            ),
            Duration::from_secs(2),
        );
    };
    let attempt = match state.registry.begin_unlock(&token) {
        Ok(attempt) => attempt,
        Err(UnlockRefusal::NotProtected) => return see_other(&token, None),
        Err(UnlockRefusal::Unavailable(reason)) => return error(reason),
        Err(UnlockRefusal::Throttled(wait)) => {
            let seconds = wait.as_secs() + u64::from(wait.subsec_nanos() > 0);
            return retry_after(
                form(
                    StatusCode::TOO_MANY_REQUESTS,
                    &format!("Too many attempts. Try again in {seconds} seconds."),
                ),
                wait,
            );
        }
    };
    let verifier = attempt.verifier.clone();
    let matched = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        verifier.matches(&password)
    })
    .await
    .unwrap_or(false);
    if !matched {
        return form(StatusCode::FORBIDDEN, "That password isn't right.");
    }
    match state.registry.finish_unlock(attempt) {
        Ok(unlocked) => see_other(&token, Some(&unlocked)),
        // The owner changed the password while this one was checked.
        Err(Unavailable::Locked) => form(StatusCode::FORBIDDEN, "That password isn't right."),
        Err(reason) => error(reason),
    }
}

async fn download_file(
    State(state): State<HttpState>,
    method: Method,
    headers: HeaderMap,
    params: Result<Path<(String, String)>, PathRejection>,
) -> Response {
    let Ok(Path((token, file))) = params else {
        return error(Unavailable::NotFound);
    };
    // File IDs are opaque base64url strings; anything else is rejected unread.
    if !shares::token::is_well_formed_id(&file) {
        return error(Unavailable::NotFound);
    }
    download(&state, &method, &headers, &token, Target::File(file)).await
}

async fn download_all(
    State(state): State<HttpState>,
    method: Method,
    headers: HeaderMap,
    token: Result<Path<String>, PathRejection>,
) -> Response {
    let Ok(Path(token)) = token else {
        return error(Unavailable::NotFound);
    };
    download(&state, &method, &headers, &token, Target::All).await
}

/// Counting rules: HEAD never counts. GET reserves capacity atomically before
/// the response starts and returns it only if the file can't be served at all.
/// Once streaming starts the download counts, even if the client aborts.
/// Range headers are ignored; every GET receives the complete file. Protected
/// shares need the unlock cookie for HEAD and GET alike.
async fn download(
    state: &HttpState,
    method: &Method,
    headers: &HeaderMap,
    token: &str,
    target: Target,
) -> Response {
    let credential = credential(headers);
    if method == Method::HEAD {
        return match state.registry.peek(token, credential, target.clone()) {
            Ok(files) if files.iter().any(|f| f.check_unchanged().is_err()) => {
                error(Unavailable::FileUnavailable)
            }
            Ok(files) => {
                let (headers, _) = attachment(state, files, &target);
                (StatusCode::OK, headers).into_response()
            }
            Err(reason) => refused(token, reason),
        };
    }

    let reservation = match state.registry.reserve(token, credential, target.clone()) {
        Ok(reservation) => reservation,
        Err(reason) => return refused(token, reason),
    };
    if reservation
        .files
        .iter()
        .any(|f| f.check_unchanged().is_err())
    {
        state.registry.release(reservation);
        return error(Unavailable::FileUnavailable);
    }
    let cancel = reservation.cancel.clone();
    let (headers, plan) = attachment(state, reservation.files.clone(), &target);
    let body = match plan {
        Some(plan) => Body::from_stream(zip::stream(Arc::new(plan), cancel)),
        None => Body::from_stream(shares::stream(reservation.files[0].clone(), cancel)),
    };
    (StatusCode::OK, headers, body).into_response()
}

/// Response headers for a download, plus the archive layout for ZIP targets.
fn attachment(
    state: &HttpState,
    files: Vec<Arc<SharedFile>>,
    target: &Target,
) -> (HeaderMap, Option<ZipPlan>) {
    let mut headers = HeaderMap::new();
    let (name, media_type, len, plan) = if *target == Target::All {
        let name = format!("Mayfly-{}-files.zip", files.len());
        let plan = ZipPlan::new(files, state.clock.wall_ms());
        (name, "application/zip".to_owned(), plan.len(), Some(plan))
    } else {
        let file = &files[0];
        (
            file.name().to_owned(),
            file.download_media_type().to_owned(),
            file.size(),
            None,
        )
    };
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&media_type)
            .unwrap_or_else(|_| HeaderValue::from_static("application/octet-stream")),
    );
    headers.insert(header::CONTENT_LENGTH, HeaderValue::from(len));
    headers.insert(header::CONTENT_DISPOSITION, content_disposition(&name));
    headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("none"));
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("sandbox; default-src 'none'"),
    );
    (headers, plan)
}

/// RFC 6266 attachment with an ASCII fallback and an RFC 5987 UTF-8 name.
fn content_disposition(name: &str) -> HeaderValue {
    const ATTR: &AsciiSet = &NON_ALPHANUMERIC
        .remove(b'!')
        .remove(b'#')
        .remove(b'$')
        .remove(b'&')
        .remove(b'+')
        .remove(b'-')
        .remove(b'.')
        .remove(b'^')
        .remove(b'_')
        .remove(b'`')
        .remove(b'|')
        .remove(b'~');
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_control() || c == '/' || c == '\\' {
                '_'
            } else {
                c
            }
        })
        .collect();
    let fallback: String = cleaned
        .chars()
        .map(|c| {
            if c.is_ascii_graphic() && c != '"' && c != '%' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let encoded = utf8_percent_encode(&cleaned, ATTR);
    HeaderValue::from_str(&format!(
        "attachment; filename=\"{fallback}\"; filename*=UTF-8''{encoded}"
    ))
    .unwrap_or_else(|_| HeaderValue::from_static("attachment"))
}

async fn not_found() -> Response {
    error(Unavailable::NotFound)
}

/// A download refusal; a locked share points back to its password form.
fn refused(token: &str, reason: Unavailable) -> Response {
    match reason {
        Unavailable::Locked => html(StatusCode::FORBIDDEN, pages::locked_download(token)),
        reason => error(reason),
    }
}

fn error(reason: Unavailable) -> Response {
    let status = match reason {
        Unavailable::NotFound | Unavailable::Empty => StatusCode::NOT_FOUND,
        Unavailable::Expired
        | Unavailable::Stopped
        | Unavailable::LimitReached
        | Unavailable::FileRemoved => StatusCode::GONE,
        Unavailable::FileUnavailable => StatusCode::SERVICE_UNAVAILABLE,
        Unavailable::Locked => StatusCode::FORBIDDEN,
    };
    html(status, pages::error(reason))
}

/// The unlock cookie, if the browser sent one. Its path limits it to one share.
fn credential(headers: &HeaderMap) -> Option<&str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .find_map(|pair| pair.trim().strip_prefix(UNLOCK_COOKIE)?.strip_prefix('='))
}

/// Password forms are accepted only from the share page itself. Pages send no
/// referrer, so browsers report `Origin: null`; Fetch Metadata covers the rest.
/// Every value of a repeated header must pass.
fn same_origin(headers: &HeaderMap) -> bool {
    let values = |name| {
        headers
            .get_all(name)
            .iter()
            .map(|v: &HeaderValue| v.to_str().unwrap_or("invalid"))
    };
    let host = headers.get(header::HOST).and_then(|v| v.to_str().ok());
    values(header::HeaderName::from_static("sec-fetch-site"))
        .all(|site| site == "same-origin" || site == "none")
        && values(header::ORIGIN).all(|origin| {
            origin == "null" || host.is_some_and(|h| origin.strip_prefix("http://") == Some(h))
        })
}

/// Back to the share page, unlocked when a password was just accepted. The
/// cookie is scoped to this share's page, file, and ZIP paths.
fn see_other(token: &str, unlocked: Option<&Unlocked>) -> Response {
    let mut headers = HeaderMap::new();
    if let Ok(location) = HeaderValue::from_str(&format!("/s/{token}")) {
        headers.insert(header::LOCATION, location);
    }
    if let Some(unlocked) = unlocked {
        let max_age = unlocked.max_age.as_secs().max(1);
        for prefix in ["s", "d", "z"] {
            let cookie = format!(
                "{UNLOCK_COOKIE}={}; Path=/{prefix}/{token}; Max-Age={max_age}; HttpOnly; SameSite=Strict",
                unlocked.credential
            );
            if let Ok(value) = HeaderValue::from_str(&cookie) {
                headers.append(header::SET_COOKIE, value);
            }
        }
    }
    (StatusCode::SEE_OTHER, headers).into_response()
}

fn retry_after(mut response: Response, wait: Duration) -> Response {
    let seconds = wait.as_secs() + u64::from(wait.subsec_nanos() > 0);
    response
        .headers_mut()
        .insert(header::RETRY_AFTER, HeaderValue::from(seconds.max(1)));
    response
}

fn html(status: StatusCode, body: String) -> Response {
    (
        status,
        [
            (header::CONTENT_TYPE, "text/html; charset=utf-8"),
            (header::CONTENT_SECURITY_POLICY, pages::PAGE_CSP.as_str()),
        ],
        body,
    )
        .into_response()
}

async fn common_headers(mut response: Response) -> Response {
    let headers = response.headers_mut();
    for (name, value) in [
        (header::CACHE_CONTROL, "no-store"),
        (header::REFERRER_POLICY, "no-referrer"),
        (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        (header::X_FRAME_OPTIONS, "DENY"),
        (
            header::HeaderName::from_static("cross-origin-resource-policy"),
            "same-origin",
        ),
    ] {
        headers.insert(name, HeaderValue::from_static(value));
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_disposition_handles_unicode_and_hostile_names() {
        let value = content_disposition("Bericht \"Q3\"\r\n/../ü.pdf");
        assert_eq!(
            value.to_str().unwrap(),
            "attachment; filename=\"Bericht _Q3____..__.pdf\"; filename*=UTF-8''Bericht%20%22Q3%22___.._%C3%BC.pdf"
        );
    }
}
