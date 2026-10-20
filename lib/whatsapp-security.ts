const HOSTNAME_PATTERN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;

export function getWhatsAppAllowedHosts(raw = process.env.WHATSAPP_API_ALLOWED_HOSTS): Set<string> {
    return new Set(
        (raw ?? "")
            .split(",")
            .map((hostname) => hostname.trim().toLowerCase())
            .filter((hostname) => HOSTNAME_PATTERN.test(hostname) && !hostname.includes("..")),
    );
}

/** Only allow HTTPS endpoints whose exact hostname was provisioned by an operator. */
export function parseAllowedWhatsAppApiUrl(
    rawUrl: string,
    allowedHosts = getWhatsAppAllowedHosts(),
): URL | null {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return null;
    }

    if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash ||
        !allowedHosts.has(url.hostname.toLowerCase())
    ) {
        return null;
    }

    return url;
}
