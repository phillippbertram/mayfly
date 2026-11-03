export const repositoryUrl = "https://github.com/phillippbertram/mayfly";

const manualDirectory = "apps/website/content/docs";

/** Opens GitHub's editor for a manual page; visitors without access get a fork. */
export function manualEditUrl(path: string): string {
  return `${repositoryUrl}/edit/main/${manualDirectory}/${path}`;
}
