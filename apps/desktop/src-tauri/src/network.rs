//! Discovers local IPv4 addresses that can be advertised in share links.

use std::net::Ipv4Addr;

use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct NetworkInterface {
    /// The OS interface name; stable enough to remember a selection.
    pub id: String,
    pub name: String,
    pub address: String,
}

/// Usable addresses, best candidates first. One address per interface.
pub fn discover() -> Vec<NetworkInterface> {
    let Ok(interfaces) = if_addrs::get_if_addrs() else {
        return Vec::new();
    };
    let mut found: Vec<(u8, NetworkInterface)> = Vec::new();
    for interface in interfaces {
        let if_addrs::IfAddr::V4(v4) = &interface.addr else {
            continue;
        };
        if matches!(
            interface.oper_status,
            if_addrs::IfOperStatus::Down | if_addrs::IfOperStatus::NotPresent
        ) || !usable(v4.ip)
        {
            continue;
        }
        if found.iter().any(|(_, f)| f.id == interface.name) {
            continue;
        }
        let rank = rank(&interface.name, v4.ip);
        found.push((
            rank,
            NetworkInterface {
                name: label(&interface.name),
                id: interface.name,
                address: v4.ip.to_string(),
            },
        ));
    }
    found.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.id.cmp(&b.1.id)));
    found.into_iter().map(|(_, i)| i).collect()
}

/// The selected interface if it is present, otherwise the best candidate.
pub fn choose<'a>(
    interfaces: &'a [NetworkInterface],
    preferred: Option<&str>,
) -> Option<&'a NetworkInterface> {
    preferred
        .and_then(|id| interfaces.iter().find(|i| i.id == id))
        .or_else(|| interfaces.first())
}

fn usable(ip: Ipv4Addr) -> bool {
    !(ip.is_loopback()
        || ip.is_link_local()
        || ip.is_unspecified()
        || ip.is_multicast()
        || ip.is_broadcast()
        || ip.is_documentation())
}

fn is_vpn(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    [
        "utun",
        "tun",
        "tap",
        "wg",
        "ppp",
        "ipsec",
        "tailscale",
        "zt",
    ]
    .iter()
    .any(|prefix| name.starts_with(prefix))
}

fn is_virtual(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    [
        "bridge",
        "vmnet",
        "vboxnet",
        "docker",
        "br-",
        "veth",
        "virbr",
        "vethernet",
    ]
    .iter()
    .any(|prefix| name.starts_with(prefix))
}

/// Lower is better: private LAN ranges on physical interfaces first.
fn rank(name: &str, ip: Ipv4Addr) -> u8 {
    let lan = ip.is_private();
    match (lan, is_vpn(name), is_virtual(name)) {
        (true, false, false) => 0,
        (false, false, false) => 1,
        (_, false, true) => 2,
        _ => 3,
    }
}

fn label(name: &str) -> String {
    if is_vpn(name) {
        format!("VPN ({name})")
    } else if is_virtual(name) {
        format!("Virtual ({name})")
    } else {
        name.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn iface(id: &str) -> NetworkInterface {
        NetworkInterface {
            id: id.into(),
            name: id.into(),
            address: "192.168.1.2".into(),
        }
    }

    #[test]
    fn prefers_private_physical_interfaces() {
        let lan = Ipv4Addr::new(192, 168, 1, 20);
        let cgnat = Ipv4Addr::new(100, 101, 1, 1);
        assert!(rank("en0", lan) < rank("utun3", cgnat));
        assert!(rank("en0", lan) < rank("bridge100", Ipv4Addr::new(192, 168, 64, 1)));
        assert!(rank("en0", lan) < rank("en5", cgnat));
        assert_eq!(label("utun3"), "VPN (utun3)");
    }

    #[test]
    fn excludes_unusable_addresses() {
        assert!(!usable(Ipv4Addr::LOCALHOST));
        assert!(!usable(Ipv4Addr::new(169, 254, 3, 4)));
        assert!(usable(Ipv4Addr::new(10, 0, 0, 12)));
    }

    #[test]
    fn falls_back_when_the_selection_disappears() {
        let list = vec![iface("en0"), iface("en7")];
        assert_eq!(choose(&list, Some("en7")).unwrap().id, "en7");
        assert_eq!(choose(&list, Some("gone")).unwrap().id, "en0");
        assert_eq!(choose(&list, None).unwrap().id, "en0");
        assert!(choose(&[], None).is_none());
    }
}
