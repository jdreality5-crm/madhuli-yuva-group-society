import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  floorNumber: z.number().int().min(0),
  floorLabel: z.string().trim().min(1).max(40),
  residentType: z.enum(["OWNER", "TENANT"]).optional().nullable(),
  ownerName: z.string().trim().max(120).optional().nullable(),
  ownerMobile: z.string().trim().max(20).optional().nullable(),
  ownerEmail: z.string().trim().email().max(320).optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireOrganizer();
    const { id } = await context.params;
    const property = await prisma.property.findFirst({ where: { id, societyId: session.societyId } });
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });
    const body = createSchema.parse(await request.json());
    const unit = await prisma.propertyUnit.create({
      data: {
        propertyId: property.id,
        label: body.label,
        floorNumber: body.floorNumber,
        floorLabel: body.floorLabel,
        residentType: body.residentType || null,
        ownerName: body.ownerName || null,
        ownerMobile: body.ownerMobile || null,
        ownerEmail: body.ownerEmail || null,
      },
    });
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error: any) {
    const status = error?.code === "P2002" ? 409 : error?.name === "ZodError" ? 400 : error?.status || 500;
    return NextResponse.json({ error: error?.code === "P2002" ? "Unit already exists" : error?.message || "Unable to create unit" }, { status });
  }
}
