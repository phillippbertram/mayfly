//! Share management: validated files, tokens, lifetimes, and download limits.
//! Nothing here depends on Tauri or HTTP.

mod file;
mod registry;
pub mod token;

pub use file::{read_chunk, stream, FileKind, SharedFile};
pub use registry::{
    Clock, FileSnapshot, PageFile, PageView, Registry, Reservation, ShareError, ShareOptions,
    SharePatch, ShareSnapshot, ShareStatus, StagedFiles, SystemClock, Target, Unavailable,
};

#[cfg(test)]
pub use registry::tests::{options as test_options, ManualClock};
