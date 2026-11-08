import { createContext } from "react";

/**
 * Where menus and tooltips portal to. A modal <dialog> sits in the browser's top
 * layer and makes the rest of the page inert, so popovers rendered into <body>
 * would be hidden behind it and unclickable; inside a dialog they portal into it.
 */
export const PortalContainer = createContext<HTMLElement | null>(null);
