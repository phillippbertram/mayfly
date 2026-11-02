import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import defaultComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Screenshot } from "./screenshot";

export function getMDXComponents(): MDXComponents {
  return { ...defaultComponents, Callout, Card, Cards, Screenshot };
}
