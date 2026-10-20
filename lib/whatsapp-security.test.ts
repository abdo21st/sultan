import { getWhatsAppAllowedHosts, parseAllowedWhatsAppApiUrl } from "./whatsapp-security";
import { DEFAULT_ROLES, PERMISSIONS } from "./permissions";

describe("WhatsApp API endpoint restrictions", () => {
    it("keeps send permission independent from status-change permissions", () => {
        expect(DEFAULT_ROLES.ADMIN).toContain(PERMISSIONS.WHATSAPP_SEND);
        expect(DEFAULT_ROLES.MANAGER).not.toContain(PERMISSIONS.WHATSAPP_SEND);
    });

    it("parses exact operator-allowlisted HTTPS hosts", () => {
        const hosts = getWhatsAppAllowedHosts("api.example.com, messaging.example.net");
        expect(parseAllowedWhatsAppApiUrl("https://api.example.com/v1/send", hosts)?.hostname).toBe("api.example.com");
        expect(parseAllowedWhatsAppApiUrl("https://messaging.example.net/send", hosts)?.pathname).toBe("/send");
    });

    it.each([
        "http://api.example.com/send",
        "https://evil.example.com/send",
        "https://api.example.com:8443/send",
        "https://user:secret@api.example.com/send",
        "https://api.example.com/send?token=secret",
    ])("rejects unsafe or unconfigured endpoint %s", (url) => {
        expect(parseAllowedWhatsAppApiUrl(url, new Set(["api.example.com"]))).toBeNull();
    });

    it("ignores malformed allowlist entries", () => {
        expect([...getWhatsAppAllowedHosts("api.example.com, .., localhost:8443, evil host")]).toEqual(["api.example.com"]);
    });
});
