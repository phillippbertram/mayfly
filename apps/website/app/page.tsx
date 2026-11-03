import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Cable,
  Check,
  Fingerprint,
  Globe2,
  Hourglass,
  Link2,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Downloads } from "@/components/downloads";
import { ProductTour } from "@/components/product-tour";
import { Reveal } from "@/components/reveal";
import { Screenshot } from "@/components/screenshot";
import { SiteHeader } from "@/components/site-header";
import { TransferStory } from "@/components/transfer-story";
import { getRelease } from "@/lib/release";

export default function Home() {
  const release = getRelease();
  return (
    <div className="marketing">
      <SiteHeader />
      <main id="main-content">
        <section className="hero section-wrap">
          <Reveal>
            <div className="hero-announcement">
              <span />
              Small utility. Short-lived by design.
              <ArrowUpRight size={13} />
            </div>
            <h1>
              Files that live
              <br />
              <span>for a moment.</span>
            </h1>
            <div className="hero-bottom">
              <p>
                From your computer to any browser on your network.
                <br />
                One file or a few. One link. One quick QR scan.
              </p>
              <div className="hero-actions">
                <Link href="#download" className="button button-primary">
                  Get Mayfly <ArrowDown size={16} />
                </Link>
                <Link href="/docs/" className="button button-quiet">
                  Meet the manual <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </Reveal>
          <Reveal className="hero-product">
            <div className="hero-glow" />
            <Screenshot
              name="dashboard"
              demo="share"
              priority
              alt="The current Mayfly dashboard preview showing sample shares and a three-file link with a QR code and ZIP download action"
              caption="The actual Mayfly interface, running in your browser with sample data. No files are transferred."
            />
          </Reveal>
          <div className="hero-footnote">
            <span>
              <span className="tiny-dot" />
              Local sharing works in the development build. Public release ahead.
            </span>
            <a href="https://github.com/phillippbertram/mayfly/issues/10">
              Follow the build <ArrowUpRight size={13} />
            </a>
          </div>
        </section>
        <section className="principles-strip section-wrap" aria-label="Product principles">
          <span>
            <Wifi size={16} />
            Local by default
          </span>
          <span>
            <Fingerprint size={16} />
            No account for local sharing
          </span>
          <span>
            <Hourglass size={16} />
            Temporary by design
          </span>
          <span>
            <Cable size={16} />
            No companion app
          </span>
        </section>
        <section className="section-wrap narrative-section" id="how-it-works">
          <Reveal>
            <div className="section-intro">
              <div>
                <span className="eyebrow">
                  <span className="mint-square" />
                  THE SHORTEST WAY BETWEEN
                </span>
                <h2>
                  Three small steps.
                  <br />
                  <span>Then get on with your day.</span>
                </h2>
              </div>
              <p>
                Choose your files, scan the code, and download in a browser. Keep both devices on
                the same trusted network, with your computer awake and Mayfly running.
              </p>
            </div>
            <TransferStory />
          </Reveal>
        </section>
        <section className="section-wrap tour-section" aria-labelledby="tour-title">
          <Reveal>
            <div className="section-intro">
              <div>
                <span className="eyebrow">
                  <span className="mint-square" />A CLOSER LOOK
                </span>
                <h2 id="tour-title">
                  A link for the moment.
                  <br />
                  <span>Room for whatever comes next.</span>
                </h2>
              </div>
              <p>
                Start with a file, a few files, or an empty link. Add what you need, give it a name,
                and keep the handoff moving.
              </p>
            </div>
            <ProductTour />
          </Reveal>
        </section>
        <section className="section-wrap detail-section" id="details">
          <Reveal>
            <div className="section-intro">
              <div>
                <span className="eyebrow">
                  <span className="mint-square" />
                  JUST ENOUGH. NOTHING EXTRA.
                </span>
                <h2>
                  Thoughtfully simple.
                  <br />
                  <span>Down to the last detail.</span>
                </h2>
              </div>
              <p>
                A quiet desktop utility, with the controls you need and the breathing room you don’t
                always get.
              </p>
            </div>
          </Reveal>
          <div className="detail-grid">
            <Reveal className="detail-panel">
              <div className="panel-top">
                <Hourglass size={22} strokeWidth={1.4} />
                <span>01 / A LITTLE LESS PERMANENT</span>
              </div>
              <h3>
                Share for a moment.
                <br />
                Not forever.
              </h3>
              <p>
                Give a link five minutes, an hour, a custom lifetime, or until you stop it. Set an
                optional download limit for each file, or revoke the whole link whenever you’re
                done. A full app restart clears every share.
              </p>
              <div className="lifetime-visual" aria-hidden="true">
                <div>
                  <span className="live-pulse" />
                  Share lifetime<span>10:00</span>
                </div>
                <div className="lifetime-line">
                  <i />
                </div>
                <div className="lifetime-options">
                  <span>5 min</span>
                  <span className="selected">
                    10 min
                    <Check size={11} />
                  </span>
                  <span>30 min</span>
                  <span>1 hour</span>
                </div>
              </div>
              <Link href="/docs/expiration/" className="text-link">
                Make it temporary <ArrowRight size={14} />
              </Link>
            </Reveal>
            <Reveal className="detail-panel">
              <div className="panel-top">
                <ShieldCheck size={22} strokeWidth={1.4} />
                <span>02 / CLOSE TO HOME</span>
              </div>
              <h3>
                Your network.
                <br />
                Your little corner.
              </h3>
              <p>
                Mayfly’s default transfers stay on your local network. Files stream from their
                original location, with no cloud upload and no account in between.
              </p>
              <div className="network-visual" aria-hidden="true">
                <div className="network-boundary">
                  <Wifi size={25} strokeWidth={1.2} />
                  <span>YOUR LOCAL NETWORK</span>
                  <div>
                    <i>Computer</i>
                    <span className="network-dots">••••••</span>
                    <i>Phone</i>
                  </div>
                </div>
                <span>HTTP is unencrypted. Trusted networks only.</span>
              </div>
              <Link href="/docs/security/" className="text-link">
                Understand the privacy model <ArrowRight size={14} />
              </Link>
            </Reveal>
          </div>
        </section>
        <section className="section-wrap profiles-section">
          <Reveal>
            <div className="profile-copy">
              <span className="eyebrow">
                <span className="mint-square" />A LINK WITH POSSIBILITIES
              </span>
              <Link2 size={28} strokeWidth={1.2} className="profile-glyph" />
              <h2>
                A short flight.
                <br />
                <span>Into your workflow.</span>
              </h2>
              <p>
                Hand a share’s URL to a compatible app on your phone. Create a link template,
                preview the result, and choose it for your QR code. Your profiles and defaults are
                saved on your computer.
              </p>
              <code className="template-line">
                myapp://import?url=<span>{"{encodedUrl}"}</span>
              </code>
              <Link className="text-link" href="/docs/link-profiles/">
                Explore link profiles <ArrowRight size={14} />
              </Link>
              <small>
                Compatible installed app required. Device-specific handoffs still need verification.
              </small>
            </div>
            <div className="profile-screen">
              <Screenshot
                name="profiles"
                alt="Mayfly’s current profile editor preview showing a Documents app template, placeholders, and a resolved example link"
              />
            </div>
          </Reveal>
        </section>
        <section className="section-wrap manual-section">
          <Reveal>
            <div className="manual-heading">
              <span className="eyebrow">
                <span className="mint-square" />A LITTLE GUIDANCE GOES A LONG WAY
              </span>
              <h2>
                Everything you need.
                <br />
                <span>Easy to find.</span>
              </h2>
            </div>
            <div className="manual-links">
              <Link href="/docs/getting-started/">
                <span className="manual-number">01</span>
                <div>
                  <h3>Get your bearings</h3>
                  <p>Availability, source setup, and your first look around.</p>
                </div>
                <ArrowUpRight size={20} />
              </Link>
              <Link href="/docs/sharing/">
                <span className="manual-number">02</span>
                <div>
                  <h3>Send your first file off</h3>
                  <p>Files, shared links, QR codes, and ZIP downloads.</p>
                </div>
                <ArrowUpRight size={20} />
              </Link>
              <Link href="/docs/remote-sharing/">
                <span className="manual-number">03</span>
                <div>
                  <h3>A little further afield</h3>
                  <p>Understand optional remote-access approaches and their limits.</p>
                </div>
                <Globe2 size={20} />
              </Link>
              <Link href="/docs/troubleshooting/">
                <span className="manual-number">04</span>
                <div>
                  <h3>Find the missing connection</h3>
                  <p>Friendly answers to network and download questions.</p>
                </div>
                <ArrowUpRight size={20} />
              </Link>
            </div>
          </Reveal>
        </section>
        <section className="section-wrap download-section" id="download">
          <Reveal>
            <Downloads release={release} />
          </Reveal>
        </section>
        <section className="section-wrap faq-section">
          <div>
            <span className="eyebrow">THE LITTLE QUESTIONS</span>
            <h2>Good to know.</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>Can I download Mayfly today?</summary>
              <p>
                Public installers are not available yet. With source access, you can run the desktop
                development build, including real local sharing. Phone, second-device, and
                packaged-platform acceptance are still pending.
              </p>
            </details>
            <details>
              <summary>Does my phone need an app?</summary>
              <p>
                The standard sharing workflow uses your phone’s browser. Custom link profiles
                require their target app; private Tailscale access requires a Tailscale connection.
              </p>
            </details>
            <details>
              <summary>Do my files leave my network?</summary>
              <p>
                The default workflow transfers files directly over your local network. Remote access
                is a separate, unverified setup with a different trust model. The Mayfly website
                hosts product information and installers, not shared user files.
              </p>
            </details>
            <details>
              <summary>Can I add more files after sharing the link?</summary>
              <p>
                Yes. Add or remove files in the share details, or drop files onto its row. The link
                stays the same; recipients refresh the page to see the changes. Everyone with the
                link can access the files you add later. Use separate links for different people.
              </p>
            </details>
            <details>
              <summary>Is a share link private?</summary>
              <p>
                A share link is a temporary bearer credential: anyone with it who can reach the
                server can download the file until it expires or is revoked. Local HTTP is
                unencrypted, so use trusted networks.
              </p>
            </details>
          </div>
        </section>
      </main>
      <footer className="site-footer section-wrap">
        <div>
          <Link href="/" aria-label="Mayfly home">
            <Brand />
          </Link>
          <p>A little less between your devices.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/docs/">User manual</Link>
          <Link href="/docs/security/">Privacy & security</Link>
          <Link href="/docs/licenses/">Licenses & notices</Link>
          <a href="https://github.com/phillippbertram/mayfly">
            GitHub <ArrowUpRight size={12} />
          </a>
        </nav>
        <span>
          Built with a little care.
          <br />© {new Date().getUTCFullYear()} Phillipp Bertram
        </span>
      </footer>
    </div>
  );
}
