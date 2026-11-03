import Image from "next/image";
import { asset } from "@/lib/paths";

/** An operating-system dialog or settings pane, shown without the app window frame. */
export function SystemScreenshot({
  name,
  alt,
  width,
  height,
  caption,
}: {
  name: string;
  alt: string;
  width: number;
  height: number;
  caption: string;
}) {
  return (
    <figure className="system-figure not-prose">
      <Image src={asset(`/screenshots/${name}.png`)} alt={alt} width={width} height={height} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
