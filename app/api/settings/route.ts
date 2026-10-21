import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { PERMISSIONS } from "../../../lib/permissions";
import { getRequestUser } from "@/lib/request-user";
import { parseAllowedWhatsAppApiUrl } from "@/lib/whatsapp-security";

const publicSettingsSelect = {
    id: true,
    appName: true,
    logoUrl: true,
    printHeader: true,
    printFooter: true,
    printTerms: true,
    themeColor: true,
    whatsappAutoSend: true,
    whatsappApiUrl: true,
    whatsappApiKey: true,
    updatedAt: true,
} as const;

function toPublicSettings(settings: {
    id: string;
    appName: string;
    logoUrl: string | null;
    printHeader: string | null;
    printFooter: string | null;
    printTerms: string | null;
    themeColor: string;
    whatsappAutoSend: boolean;
    whatsappApiUrl: string | null;
    whatsappApiKey: string | null;
    updatedAt: Date;
}) {
    const { whatsappApiKey, ...publicSettings } = settings;
    return { ...publicSettings, hasWhatsappApiKey: Boolean(whatsappApiKey) };
}

const settingsSchema = z.object({
    appName: z.string().trim().min(1).max(100).optional(),
    logoUrl: z.string().max(2048).nullable().optional(),
    printHeader: z.string().max(2000).nullable().optional(),
    printFooter: z.string().max(2000).nullable().optional(),
    printTerms: z.string().max(5000).nullable().optional(),
    themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    whatsappAutoSend: z.boolean().optional(),
    whatsappApiUrl: z.preprocess(
        (value) => value === "" ? null : value,
        z.string().url().nullable().optional()
    ),
    whatsappApiKey: z.string().max(1000).optional(),
    clearWhatsappApiKey: z.boolean().optional(),
});

export async function GET() {
    try {
        const user = await getRequestUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let settings = await prisma.systemSettings.findUnique({
            where: { id: "default" },
            select: publicSettingsSelect,
        });

        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: { id: "default", appName: "سلطان", themeColor: "#796453" },
                select: publicSettingsSelect,
            });
        }

        return NextResponse.json(toPublicSettings(settings));
    } catch {
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user?.permissions.includes(PERMISSIONS.SETTINGS_MANAGE)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const parsed = settingsSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
        }

        const body = parsed.data;
        const providedApiKey = body.whatsappApiKey?.trim();
        if (body.whatsappApiUrl) {
            if (!parseAllowedWhatsAppApiUrl(body.whatsappApiUrl)) {
                return NextResponse.json({ error: "WhatsApp API URL must use HTTPS and an operator-allowlisted hostname" }, { status: 400 });
            }
        }

        if (body.whatsappAutoSend === true) {
            const currentSettings = await prisma.systemSettings.findUnique({
                where: { id: "default" },
                select: { whatsappApiUrl: true, whatsappApiKey: true },
            });
            const effectiveApiUrl = Object.prototype.hasOwnProperty.call(body, "whatsappApiUrl")
                ? body.whatsappApiUrl
                : currentSettings?.whatsappApiUrl;
            const effectiveApiKey = providedApiKey || (body.clearWhatsappApiKey ? null : currentSettings?.whatsappApiKey);
            if (!effectiveApiUrl || !parseAllowedWhatsAppApiUrl(effectiveApiUrl) || !effectiveApiKey) {
                return NextResponse.json({ error: "Configure an allowlisted HTTPS endpoint and API key before enabling automatic WhatsApp messages" }, { status: 400 });
            }
        }

        const apiKeyUpdate = providedApiKey
            ? { whatsappApiKey: providedApiKey }
            : body.clearWhatsappApiKey
                ? { whatsappApiKey: null }
                : {};

        const settings = await prisma.systemSettings.upsert({
            where: { id: "default" },
            update: {
                appName: body.appName,
                logoUrl: body.logoUrl,
                printHeader: body.printHeader,
                printFooter: body.printFooter,
                printTerms: body.printTerms,
                themeColor: body.themeColor,
                whatsappAutoSend: body.whatsappAutoSend,
                whatsappApiUrl: body.whatsappApiUrl,
                ...apiKeyUpdate,
            },
            create: {
                id: "default",
                appName: body.appName ?? "سلطان",
                logoUrl: body.logoUrl,
                printHeader: body.printHeader,
                printFooter: body.printFooter,
                printTerms: body.printTerms,
                themeColor: body.themeColor ?? "#d97706",
                whatsappAutoSend: body.whatsappAutoSend ?? false,
                whatsappApiUrl: body.whatsappApiUrl,
                whatsappApiKey: providedApiKey || null,
            },
            select: publicSettingsSelect,
        });

        return NextResponse.json(toPublicSettings(settings));
    } catch (error) {
        console.error("Settings update error:", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
