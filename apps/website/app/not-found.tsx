import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found" id="main-content">
      <span className="eyebrow">404 / THIS PAGE IS GONE</span>
      <h1>Nothing landed here.</h1>
      <p>This page may have moved. Let’s get you back on track.</p>
      <Link className="button button-primary" href="/">
        Back to Mayfly
      </Link>
      <Link className="text-link" href="/docs/">
        Open the user manual
      </Link>
    </main>
  );
}
