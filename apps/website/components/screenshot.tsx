import Image from "next/image";
import { asset } from "@/lib/paths";

export function Screenshot({
  name,
  alt,
  caption = "Actual FileHop interface · browser preview with sample data. No files are transferred.",
  priority = false,
}: {
  name: string;
  alt: string;
  caption?: string;
  priority?: boolean;
}) {
  return (
    <figure className="product-figure">
      <div className="screenshot-window">
        <div className="window-toolbar" aria-hidden="true">
          <span />
          <span />
          <span />
          <p>FileHop</p>
          <span className="toolbar-preview">INTERFACE PREVIEW</span>
        </div>
        <a
          href={asset(`/screenshots/${name}.jpg`)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open full-size screenshot: ${alt}`}
        >
          <Image
            src={asset(`/screenshots/${name}.jpg`)}
            alt={alt}
            width={1440}
            height={960}
            sizes="(max-width: 760px) 100vw, 1120px"
            priority={priority}
          />
        </a>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
