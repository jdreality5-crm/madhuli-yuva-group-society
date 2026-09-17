import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";

const createSchema = z.object({
  type: z.enum(["APARTMENT", "TENAMENT"]),
  name: z.string().trim().min(1).max(120),
  propertyNumber: z.string().trim().min(1).max(50),
  block: z.string().trim().max(20).optional().nullable(),
});

export async function GET() {
  try {
    const session = await requireOrganizer();
    const properties = await prisma.property.findMany({
      where: { societyId: session.societyId },
      include: { units: { orderBy: [{ floorNumber: "asc" }, { label: "asc" }] } },
      orderBy: [{ type: "asc" }, { propertyNumber: "asc" }],
    });
    return NextResponse.json({ properties });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unauthorized" }, { status: error?.status || 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireOrganizer();
    const body = createSchema.parse(await request.json());
    const propertyNumber = body.propertyNumber.trim();
    const existing = await prisma.property.findUnique({
      where: { societyId_type_propertyNumber: { societyId: session.societyId, type: body.type, propertyNumber } },
    });
    if (existing) return NextResponse.json({ error: "Property already exists" }, { status: 409 });

    const property = await prisma.property.create({
      data: {
        societyId: session.societyId,
        type: body.type,
        name: body.name.trim(),
        propertyNumber,
        block: body.block?.trim() || null,
      },
    });
    return NextResponse.json({ property }, { status: 201 });
  } catch (error: any) {
    const status = error?.name === "ZodError" ? 400 : error?.status || 500;
    return NextResponse.json({ error: error?.message || "Unable to create property" }, { status });
  }
}
