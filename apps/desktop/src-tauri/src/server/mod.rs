//! The public LAN listener: binding, serving, and graceful shutdown.

mod pages;
mod routes;
#[cfg(test)]
mod tests;
mod zip;

use std::io;
use std::net::{Ipv4Addr, SocketAddr};
use std::time::Duration;

use tokio::net::TcpListener;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

pub use routes::HttpState;

/// A running listener. Dropping it does not stop the server; call [`Listener::stop`].
pub struct Listener {
    port: u16,
    shutdown: CancellationToken,
    task: JoinHandle<()>,
}

impl Listener {
    /// Binds the wildcard IPv4 address so any advertised local address works.
    pub async fn bind(port: u16, state: HttpState) -> Result<Self, String> {
        Self::bind_addr(SocketAddr::from((Ipv4Addr::UNSPECIFIED, port)), state).await
    }

    pub async fn bind_addr(addr: SocketAddr, state: HttpState) -> Result<Self, String> {
        let listener = TcpListener::bind(addr)
            .await
            .map_err(|e| bind_error_message(addr.port(), &e))?;
        let port = listener
            .local_addr()
            .map_err(|e| bind_error_message(addr.port(), &e))?
            .port();
        let shutdown = CancellationToken::new();
        let signal = shutdown.clone();
        let app = routes::router(state);
        let task = tokio::spawn(async move {
            // Request logging is deliberately absent: paths contain tokens.
            let _ = axum::serve(listener, app)
                .with_graceful_shutdown(async move { signal.cancelled().await })
                .await;
        });
        Ok(Self {
            port,
            shutdown,
            task,
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    /// Stops accepting connections and waits briefly for open ones to finish.
    /// Callers revoke shares first so running transfers end promptly.
    pub async fn stop(self, grace: Duration) {
        self.shutdown.cancel();
        let abort = self.task.abort_handle();
        if tokio::time::timeout(grace, self.task).await.is_err() {
            abort.abort();
        }
    }
}

fn bind_error_message(port: u16, error: &io::Error) -> String {
    match error.kind() {
        io::ErrorKind::AddrInUse => format!("Port {port} is already in use by another app."),
        io::ErrorKind::PermissionDenied => {
            format!("Mayfly isn't allowed to use port {port}. Choose a port above 1023.")
        }
        _ => format!("Mayfly couldn't start its server on port {port}."),
    }
}
