//! Public LAN routes. Only landing pages and downloads exist here; request
//! paths are matched against in-memory tokens and never touch the filesystem.

use std::sync::Arc;

use axum::body::Body;
use axum::extract::rejection::PathRejection;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::middleware::map_response;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use percent_encoding::{utf8_percent_encode, AsciiSet, NON_ALPHANUMERIC};

use super::pages;
use super::zip::{self, ZipPlan};
use crate::shares::{self, Clock, Registry, SharedFile, Target, Unavailable};

#[derive(Clone)]
pub struct HttpState {
    pub registry: Arc<Registry>,
    pub clock: Arc<dyn Clock>,
}

pub fn router(state: HttpState) -> Router {
    Router::new()
        .route("/s/{token}", get(landing))
        .route("/d/{token}", get(download_single))
        .route("/d/{token}/{index}", get(download_file))
        .route("/z/{token}", get(download_all))
        .fallback(not_found)
        .method_not_allowed_fallback(method_not_allowed)
        .layer(map_response(common_headers))
        .with_state(state)
}

async fn landing(
    State(state): State<HttpState>,
    token: Result<Path<String>, PathRejection>,
) -> Response {
    let Ok(Path(token)) = token else {
        return error(Unavailable::NotFound);
    };
    match state.registry.page(&token) {
        Ok(view) => html(StatusCode::OK, pages::landing(&token, &view)),
        Err(reason) => error(reason),
    }
}

async fn download_single(
    State(state): State<HttpState>,
    method: Method,
    token: Result<Path<String>, PathRejection>,
) -> Response {
    let Ok(Path(token)) = token else {
        return error(Unavailable::NotFound);
    };
    download(&state, &method, &token, Target::Single).await
}

async fn download_file(
    State(state): State<HttpState>,
    method: Method,
    params: Result<Path<(String, String)>, PathRejection>,
) -> Response {
    let Ok(Path((token, index))) = params else {
        return error(Unavailable::NotFound);
    };
    // Plain decimal only: no signs, no leading zeros, nothing path-like.
    let valid = !index.is_empty()
        && index.len() <= 5
        && index.bytes().all(|b| b.is_ascii_digit())
        && (index == "0" || !index.starts_with('0'));
    let Some(index) = index.parse().ok().filter(|_| valid) else {
        return error(Unavailable::NotFound);
    };
    download(&state, &method, &token, Target::File(index)).await
}

async fn download_all(
    State(state): State<HttpState>,
    method: Method,
    token: Result<Path<String>, PathRejection>,
) -> Response {
    let Ok(Path(token)) = token else {
        return error(Unavailable::NotFound);
    };
    download(&state, &method, &token, Target::All).await
}

/// Counting rules: HEAD never counts. GET reserves capacity atomically before
/// the response starts and returns it only if the file can't be served at all.
/// Once streaming starts the download counts, even if the client aborts.
/// Range headers are ignored; every GET receives the complete file.
async fn download(state: &HttpState, method: &Method, token: &str, target: Target) -> Response {
    if method == Method::HEAD {
        return match state.registry.peek(token, target) {
            Ok(files) if files.iter().any(|f| f.check_unchanged().is_err()) => {
                error(Unavailable::FileUnavailable)
            }
            Ok(files) => {
                let (headers, _) = attachment(state, files, target);
                (StatusCode::OK, headers).into_response()
            }
            Err(reason) => error(reason),
        };
    }

    let reservation = match state.registry.reserve(token, target) {
        Ok(reservation) => reservation,
        Err(reason) => return error(reason),
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
    let (headers, plan) = attachment(state, reservation.files.clone(), target);
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
    target: Target,
) -> (HeaderMap, Option<ZipPlan>) {
    let mut headers = HeaderMap::new();
    let (name, media_type, len, plan) = if target == Target::All {
        let name = format!("FileHop-{}-files.zip", files.len());
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

async fn method_not_allowed() -> Response {
    (
        StatusCode::METHOD_NOT_ALLOWED,
        [(header::ALLOW, "GET, HEAD")],
    )
        .into_response()
}

fn error(reason: Unavailable) -> Response {
    let status = match reason {
        Unavailable::NotFound => StatusCode::NOT_FOUND,
        Unavailable::Expired | Unavailable::Stopped | Unavailable::LimitReached => StatusCode::GONE,
        Unavailable::FileUnavailable => StatusCode::SERVICE_UNAVAILABLE,
    };
    html(status, pages::error(reason))
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
