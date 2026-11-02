//! End-to-end checks through real HTTP requests against a bound listener.

use std::io::{Cursor, Read};
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use reqwest::{header, Method, StatusCode};

use super::{HttpState, Listener};
use crate::shares::{test_options, ManualClock, Registry, ShareSnapshot};

struct Harness {
    clock: Arc<ManualClock>,
    registry: Arc<Registry>,
    base: String,
    client: reqwest::Client,
    dir: tempfile::TempDir,
    _listener: Listener,
}

impl Harness {
    async fn new() -> Self {
        let clock = ManualClock::new();
        let registry = Arc::new(Registry::new(clock.clone(), Arc::new(|| {})));
        let listener = Listener::bind_addr(
            SocketAddr::from((Ipv4Addr::LOCALHOST, 0)),
            HttpState {
                registry: registry.clone(),
                clock: clock.clone(),
            },
        )
        .await
        .unwrap();
        Self {
            base: format!("http://127.0.0.1:{}", listener.port()),
            clock,
            registry,
            client: reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap(),
            dir: tempfile::tempdir().unwrap(),
            _listener: listener,
        }
    }

    fn share(
        &self,
        files: &[(&str, &[u8])],
        lifetime: Option<u32>,
        limit: Option<u32>,
        separate: bool,
    ) -> ShareSnapshot {
        let paths = files
            .iter()
            .enumerate()
            .map(|(i, (name, contents))| {
                // Separate folders allow identical names within a bundle.
                let dir = self.dir.path().join(i.to_string());
                std::fs::create_dir_all(&dir).unwrap();
                let path = dir.join(name);
                std::fs::write(&path, contents).unwrap();
                path
            })
            .collect();
        let staged = self.registry.stage(paths);
        assert!(staged.rejected.is_empty());
        let ids: Vec<_> = staged.files.into_iter().map(|f| f.stage_id).collect();
        self.registry
            .create(&ids, &test_options(lifetime, limit), separate)
            .unwrap()
            .remove(0)
    }

    async fn get(&self, path: &str) -> reqwest::Response {
        self.client
            .get(format!("{}{path}", self.base))
            .send()
            .await
            .unwrap()
    }

    async fn request(&self, method: Method, path: &str) -> reqwest::Response {
        self.client
            .request(method, format!("{}{path}", self.base))
            .send()
            .await
            .unwrap()
    }

    fn downloads(&self, id: &str) -> u32 {
        self.registry.get(id).unwrap().download_count()
    }
}

fn header(response: &reqwest::Response, name: header::HeaderName) -> &str {
    response
        .headers()
        .get(name)
        .map(|v| v.to_str().unwrap())
        .unwrap_or("")
}

#[tokio::test]
async fn landing_page_is_escaped_and_hardened() {
    let h = Harness::new().await;
    let share = h.share(
        &[("<img src=x onerror=alert(1)>.txt", b"hi")],
        Some(10),
        None,
        true,
    );
    let response = h.get(&format!("/s/{}", share.token)).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, header::CACHE_CONTROL), "no-store");
    assert_eq!(header(&response, header::REFERRER_POLICY), "no-referrer");
    assert_eq!(header(&response, header::X_CONTENT_TYPE_OPTIONS), "nosniff");
    assert!(header(&response, header::CONTENT_SECURITY_POLICY).starts_with("default-src 'none'"));
    assert!(header(&response, header::CONTENT_TYPE).starts_with("text/html"));
    let html = response.text().await.unwrap();
    assert!(!html.contains("<img"));
    assert!(html.contains("&lt;img src=x onerror=alert(1)&gt;.txt"));
    assert!(!html.contains("<script"));
    assert!(!html.contains(h.dir.path().to_str().unwrap()));
    // Viewing the page never counts.
    assert_eq!(h.downloads(&share.id), 0);
}

#[tokio::test]
async fn downloads_stream_the_original_bytes_with_attachment_headers() {
    let h = Harness::new().await;
    let contents: Vec<u8> = (0..(8 * 1024 * 1024 + 7))
        .map(|i| (i % 253) as u8)
        .collect();
    let share = h.share(&[("Grüße.pdf", &contents)], None, None, true);
    let response = h
        .get(&format!("/d/{}/{}", share.token, share.files[0].id))
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, header::CONTENT_TYPE), "application/pdf");
    assert_eq!(
        header(&response, header::CONTENT_DISPOSITION),
        "attachment; filename=\"Gr__e.pdf\"; filename*=UTF-8''Gr%C3%BC%C3%9Fe.pdf"
    );
    assert_eq!(
        header(&response, header::CONTENT_LENGTH),
        contents.len().to_string()
    );
    assert_eq!(header(&response, header::ACCEPT_RANGES), "none");
    assert_eq!(header(&response, header::CACHE_CONTROL), "no-store");
    let body = response.bytes().await.unwrap();
    assert!(body[..] == contents[..]);
    assert_eq!(h.downloads(&share.id), 1);
}

#[tokio::test]
async fn active_content_is_served_as_binary() {
    let h = Harness::new().await;
    let share = h.share(
        &[("page.html", b"<script>alert(1)</script>")],
        None,
        None,
        true,
    );
    let response = h
        .get(&format!("/d/{}/{}", share.token, share.files[0].id))
        .await;
    assert_eq!(
        header(&response, header::CONTENT_TYPE),
        "application/octet-stream"
    );
    assert!(header(&response, header::CONTENT_SECURITY_POLICY).starts_with("sandbox"));
}

#[tokio::test]
async fn head_reports_without_counting() {
    let h = Harness::new().await;
    let share = h.share(&[("a.txt", b"hello")], None, Some(1), true);
    let response = h
        .request(
            Method::HEAD,
            &format!("/d/{}/{}", share.token, share.files[0].id),
        )
        .await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, header::CONTENT_LENGTH), "5");
    assert_eq!(h.downloads(&share.id), 0);
    assert_eq!(
        h.get(&format!("/d/{}/{}", share.token, share.files[0].id))
            .await
            .status(),
        StatusCode::OK
    );
    let response = h
        .request(
            Method::HEAD,
            &format!("/d/{}/{}", share.token, share.files[0].id),
        )
        .await;
    assert_eq!(response.status(), StatusCode::GONE);
}

#[tokio::test]
async fn range_requests_receive_the_full_file_and_count_once() {
    let h = Harness::new().await;
    let share = h.share(&[("a.txt", b"0123456789")], None, Some(2), true);
    let response = h
        .client
        .get(format!(
            "{}/d/{}/{}",
            h.base, share.token, share.files[0].id
        ))
        .header(header::RANGE, "bytes=2-4")
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.bytes().await.unwrap().as_ref(), b"0123456789");
    assert_eq!(h.downloads(&share.id), 1);
}

#[tokio::test]
async fn download_limit_holds_under_concurrency() {
    let h = Harness::new().await;
    let share = h.share(&[("a.txt", &[7u8; 200_000])], None, Some(3), true);
    let url = format!("{}/d/{}/{}", h.base, share.token, share.files[0].id);
    let requests = (0..20).map(|_| {
        let client = h.client.clone();
        let url = url.clone();
        tokio::spawn(async move {
            let response = client.get(url).send().await.unwrap();
            let status = response.status();
            let _ = response.bytes().await;
            status
        })
    });
    let mut ok = 0;
    let mut gone = 0;
    for request in requests {
        match request.await.unwrap() {
            StatusCode::OK => ok += 1,
            StatusCode::GONE => gone += 1,
            other => panic!("unexpected status {other}"),
        }
    }
    assert_eq!((ok, gone), (3, 17));
    let page = h.get(&format!("/s/{}", share.token)).await;
    assert_eq!(page.status(), StatusCode::GONE);
    assert!(page
        .text()
        .await
        .unwrap()
        .contains("Download limit reached"));
}

#[tokio::test]
async fn expired_and_stopped_shares_are_gone() {
    let h = Harness::new().await;
    let expiring = h.share(&[("a.txt", b"a")], Some(5), None, true);
    let stopped = h.share(&[("b.txt", b"b")], None, None, true);
    h.clock.advance(Duration::from_secs(5 * 60));
    let response = h
        .get(&format!("/d/{}/{}", expiring.token, expiring.files[0].id))
        .await;
    assert_eq!(response.status(), StatusCode::GONE);
    assert!(response.text().await.unwrap().contains("This link expired"));

    h.registry.stop(&stopped.id).unwrap();
    let response = h.get(&format!("/s/{}", stopped.token)).await;
    assert_eq!(response.status(), StatusCode::GONE);
    assert!(response
        .text()
        .await
        .unwrap()
        .contains("Sharing was stopped"));
    assert_eq!(
        h.get(&format!("/d/{}/{}", stopped.token, stopped.files[0].id))
            .await
            .status(),
        StatusCode::GONE
    );
}

#[tokio::test]
async fn stopping_cancels_a_running_transfer() {
    let h = Harness::new().await;
    let contents = vec![1u8; 32 * 1024 * 1024];
    let share = h.share(&[("big.bin", &contents)], None, None, true);
    let mut response = h
        .get(&format!("/d/{}/{}", share.token, share.files[0].id))
        .await;
    let mut received = response.chunk().await.unwrap().map_or(0, |c| c.len());
    h.registry.stop(&share.id).unwrap();
    let mut failed = false;
    loop {
        match response.chunk().await {
            Ok(Some(chunk)) => received += chunk.len(),
            Ok(None) => break,
            Err(_) => {
                failed = true;
                break;
            }
        }
    }
    assert!(failed, "the transfer should end with an error");
    assert!(received < contents.len());
}

#[tokio::test]
async fn malformed_requests_reveal_nothing() {
    let h = Harness::new().await;
    let share = h.share(&[("a.txt", b"a")], None, None, true);
    for path in [
        "/",
        "/s/",
        "/etc/passwd",
        "/s/..%2F..%2Fetc%2Fpasswd",
        "/d/../../etc/passwd",
        "/d/%ff%fe",
        "/s/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        &format!("/d/{}/0/extra", share.token),
        &format!("/d/{}/01", share.token),
        &format!("/d/{}/-1", share.token),
        &format!("/d/{}/+0", share.token),
        &format!("/d/{}", share.token),
    ] {
        let response = h.get(path).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{path}");
        let body = response.text().await.unwrap();
        assert!(body.contains("Nothing here"), "{path}");
    }
    assert_eq!(h.downloads(&share.id), 0);

    let response = h
        .request(Method::POST, &format!("/s/{}", share.token))
        .await;
    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(header(&response, header::ALLOW), "GET, HEAD");
}

#[tokio::test]
async fn changed_files_are_unavailable_and_do_not_count() {
    let h = Harness::new().await;
    let share = h.share(&[("a.txt", b"original")], None, Some(1), true);
    let path = h.dir.path().join("0").join("a.txt");
    std::fs::write(&path, b"changed contents").unwrap();
    let response = h
        .get(&format!("/d/{}/{}", share.token, share.files[0].id))
        .await;
    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert!(response.text().await.unwrap().contains("File unavailable"));
    assert_eq!(h.downloads(&share.id), 0);
}

#[tokio::test]
async fn bundles_serve_single_files_and_a_zip() {
    let h = Harness::new().await;
    let share = h.share(
        &[
            ("a.txt", b"first"),
            ("b.txt", b"second"),
            ("a.txt", b"third"),
        ],
        None,
        Some(2),
        false,
    );
    let page = h
        .get(&format!("/s/{}", share.token))
        .await
        .text()
        .await
        .unwrap();
    assert!(page.contains("3 files"));
    assert!(page.contains(&format!("/z/{}", share.token)));

    assert_eq!(
        h.get(&format!("/d/{}", share.token)).await.status(),
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        h.get(&format!("/d/{}/{}", share.token, "AAAAAAAAAAAAAAAA"))
            .await
            .status(),
        StatusCode::NOT_FOUND
    );
    let second = h
        .get(&format!("/d/{}/{}", share.token, share.files[1].id))
        .await;
    assert_eq!(second.bytes().await.unwrap().as_ref(), b"second");

    let response = h.get(&format!("/z/{}", share.token)).await;
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(header(&response, header::CONTENT_TYPE), "application/zip");
    assert!(header(&response, header::CONTENT_DISPOSITION).contains("FileHop-3-files.zip"));
    let length: usize = header(&response, header::CONTENT_LENGTH).parse().unwrap();
    let body = response.bytes().await.unwrap();
    assert_eq!(body.len(), length);
    let mut archive = zip::ZipArchive::new(Cursor::new(body)).unwrap();
    let mut entries = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).unwrap();
        let mut text = String::new();
        entry.read_to_string(&mut text).unwrap();
        entries.push((entry.name().unwrap().to_string(), text));
    }
    assert_eq!(
        entries,
        [
            ("a.txt".to_string(), "first".to_string()),
            ("b.txt".to_string(), "second".to_string()),
            ("a (2).txt".to_string(), "third".to_string()),
        ]
    );

    // File 1 has now been downloaded twice: the ZIP is no longer offered.
    let snapshot = h.registry.get(&share.id).unwrap();
    assert_eq!(
        snapshot
            .files
            .iter()
            .map(|f| f.downloads)
            .collect::<Vec<_>>(),
        [1, 2, 1]
    );
    assert_eq!(
        h.get(&format!("/z/{}", share.token)).await.status(),
        StatusCode::GONE
    );
    let page = h
        .get(&format!("/s/{}", share.token))
        .await
        .text()
        .await
        .unwrap();
    assert!(!page.contains(&format!("/z/{}", share.token)));
    assert_eq!(
        h.get(&format!("/d/{}/{}", share.token, share.files[0].id))
            .await
            .status(),
        StatusCode::OK
    );
}

#[tokio::test]
async fn reports_port_conflicts() {
    let h = Harness::new().await;
    let port: u16 = h.base.rsplit(':').next().unwrap().parse().unwrap();
    let error = Listener::bind_addr(
        SocketAddr::from((Ipv4Addr::LOCALHOST, port)),
        HttpState {
            registry: h.registry.clone(),
            clock: h.clock.clone(),
        },
    )
    .await
    .err()
    .unwrap();
    assert_eq!(
        error,
        format!("Port {port} is already in use by another app.")
    );
}

#[tokio::test]
async fn stopping_the_listener_refuses_new_connections() {
    let h = Harness::new().await;
    let Harness {
        _listener: listener,
        base,
        client,
        ..
    } = h;
    listener.stop(Duration::from_secs(1)).await;
    assert!(client.get(format!("{base}/")).send().await.is_err());
}

#[tokio::test]
async fn shares_change_behind_one_link() {
    let h = Harness::new().await;
    let share = h.share(&[("a.txt", b"first")], None, None, false);
    let page = h
        .get(&format!("/s/{}", share.token))
        .await
        .text()
        .await
        .unwrap();
    assert!(page.contains("<h1>a.txt</h1>"));
    assert!(!page.contains("Refresh"));
    // There is no bare download route; direct links always name a file.
    assert_eq!(
        h.get(&format!("/d/{}", share.token)).await.status(),
        StatusCode::NOT_FOUND
    );

    let path = h.dir.path().join("added.txt");
    std::fs::write(&path, b"second").unwrap();
    let staged = h.registry.stage(vec![path]);
    let ids: Vec<_> = staged.files.into_iter().map(|f| f.stage_id).collect();
    let share = h.registry.add_files(&share.id, &ids).unwrap();
    let added = share.files[1].id.clone();
    let page = h
        .get(&format!("/s/{}", share.token))
        .await
        .text()
        .await
        .unwrap();
    assert!(page.contains("<h1>2 files</h1>"));
    assert!(page.contains("Refresh"));

    let zip = h
        .get(&format!("/z/{}", share.token))
        .await
        .bytes()
        .await
        .unwrap();
    let archive = zip::ZipArchive::new(Cursor::new(zip)).unwrap();
    assert_eq!(archive.len(), 2);

    h.registry.remove_file(&share.id, &added).unwrap();
    let response = h.get(&format!("/d/{}/{}", share.token, added)).await;
    assert_eq!(response.status(), StatusCode::GONE);
    assert!(response.text().await.unwrap().contains("File removed"));

    h.registry
        .remove_file(&share.id, &share.files[0].id)
        .unwrap();
    let page = h.get(&format!("/s/{}", share.token)).await;
    assert_eq!(page.status(), StatusCode::OK);
    assert!(page.text().await.unwrap().contains("No files yet"));
    let response = h.get(&format!("/z/{}", share.token)).await;
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(response.text().await.unwrap().contains("No files yet"));
}

#[tokio::test]
async fn removing_a_file_cuts_off_its_running_download() {
    let h = Harness::new().await;
    let contents = vec![3u8; 32 * 1024 * 1024];
    let share = h.share(&[("big.bin", &contents)], None, None, false);
    let file = share.files[0].id.clone();
    let mut response = h.get(&format!("/d/{}/{}", share.token, file)).await;
    assert_eq!(response.status(), StatusCode::OK);
    let _ = response.chunk().await.unwrap();
    h.registry.remove_file(&share.id, &file).unwrap();
    let mut failed = false;
    loop {
        match response.chunk().await {
            Ok(Some(_)) => {}
            Ok(None) => break,
            Err(_) => {
                failed = true;
                break;
            }
        }
    }
    assert!(failed, "the transfer should end with an error");
}
