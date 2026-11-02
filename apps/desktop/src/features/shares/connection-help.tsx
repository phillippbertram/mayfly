import { ChevronDown, CircleHelp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { isMac, isWindows } from "../../lib/platform";
import { useServer } from "../../lib/queries";

/**
 * Troubleshooting for the common reasons another device can't open a link:
 * different networks, guest Wi-Fi or client isolation, VPN routing, and the
 * firewall. Collapsed by default so it doesn't compete with the QR code.
 */
export function ConnectionHelp() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const server = useServer().data;
  const address = server?.kind === "online" ? `${server.address}:${server.port}` : null;
  const port = server && "port" in server ? server.port : 8765;

  const firewall = isMac
    ? "If macOS asked whether FileHop may accept incoming connections, allow it. You can check this in System Settings → Network → Firewall."
    : isWindows
      ? "When Windows Defender Firewall asks, allow FileHop on private networks. A network marked as public blocks it."
      : `Allow incoming TCP connections on port ${port} in your firewall, for example with ufw.`;

  const tips = [
    {
      title: "Same network",
      text: `The other device must be on the same Wi-Fi or wired network as this computer${address ? ` (${address})` : ""}.`,
    },
    {
      title: "Guest Wi-Fi and client isolation",
      text: "Guest networks, hotel and office Wi-Fi often keep devices from reaching each other. Use your main network.",
    },
    {
      title: "VPN",
      text: "A VPN on either device can send the link elsewhere. Pause it, or pick another address in Settings → Network.",
    },
    { title: "Firewall", text: firewall },
    {
      title: "Check from here",
      text: "Open the link in a browser on this computer. If it works here but not on the other device, the network is blocking it.",
    },
  ];

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 self-center rounded-md px-1.5 py-0.5 text-[12px] text-muted transition-colors hover:text-fg"
      >
        <CircleHelp aria-hidden="true" size={13} strokeWidth={1.6} />
        Can't open the link on another device?
        <ChevronDown
          aria-hidden="true"
          size={12}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id={id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 flex flex-col gap-2 overflow-hidden rounded-xl border border-line bg-bg/60 p-3"
          >
            {tips.map((tip) => (
              <li key={tip.title} className="flex flex-col gap-0.5 text-[12px] leading-[17px]">
                <span className="font-medium text-fg">{tip.title}</span>
                <span className="text-muted">{tip.text}</span>
              </li>
            ))}
            <li className="border-t border-line pt-2 text-[11.5px] text-faint">
              Links use plain HTTP, so anyone on the network could see what is transferred. Only
              share on networks you trust.
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
