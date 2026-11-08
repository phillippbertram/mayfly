import type { Share, StagedFiles } from "../lib/backend";

// Synthetic values only: these links and stage handles never authorize files.
export function shareFixture(patch: Partial<Share> = {}): Share {
  return {
    id: "share-test",
    fileName: "Example.pdf",
    title: null,
    byteSize: 1024,
    kind: "document",
    files: [
      {
        id: "file-test",
        name: "Example.pdf",
        byteSize: 1024,
        kind: "document",
        downloadCount: 0,
        link: "http://example.invalid/d/test/file-test",
      },
    ],
    createdAt: Date.now() - 60_000,
    expiresAt: Date.now() + 600_000,
    endedAt: null,
    downloadCount: 0,
    downloadLimit: null,
    status: "active",
    link: "http://example.invalid/s/test",
    zipLink: "http://example.invalid/z/test",
    appLinks: [],
    protected: false,
    ...patch,
  };
}

export const stagedFixture: StagedFiles = {
  files: [{ stageId: "stage-test", fileName: "Example.pdf", byteSize: 1024, kind: "document" }],
  rejected: [],
};
