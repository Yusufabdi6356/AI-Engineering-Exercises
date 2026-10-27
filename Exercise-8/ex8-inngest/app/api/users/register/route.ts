import { inngest } from "@/inngest/client";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!email || !name || email.length > 200 || name.length > 100) {
        return NextResponse.json({ error: "email and name are required" }, { status: 400 });
    }

    const user = { id: crypto.randomUUID(), email, name };

    const { ids } = await inngest.send({
        name: "user/registered",
        data: user
    });

    return NextResponse.json({ success: true, user, eventId: ids[0] });
}
