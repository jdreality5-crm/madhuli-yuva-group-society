import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, requireOrganizer } from "@/lib/auth";

const schema = z.object({ setup: z.enum(["APARTMENT", "TENAMENT"]) });

export async function POST(req: Request) {
  try {
    const session = await requireOrganizer();
    const { setup } = schema.parse(await req.json());

    const result = await prisma.$transaction(async tx => {
      if (setup === "APARTMENT") {
        let createdProperties = 0;
        let createdUnits = 0;
        for (const block of ["A", "B", "C"]) {
          const propertyNumber = block;
          const existing = await tx.property.findUnique({
            where: { societyId_type_propertyNumber: { societyId: session.societyId, type: "APARTMENT", propertyNumber } },
            select: { id: true },
          });
          const property = existing
            ? existing
            : await tx.property.create({
                data: {
                  societyId: session.societyId,
                  type: "APARTMENT",
                  name: "Sarang Apartment",
                  propertyNumber,
                  block,
                },
                select: { id: true },
              });
          if (!existing) createdProperties += 1;
          const units = Array.from({ length: 26 }, (_, index) => ({
            propertyId: property.id,
            label: String(index + 1),
            floorNumber: 0,
            floorLabel: "Flat",
          }));
          const inserted = await tx.propertyUnit.createMany({ data: units, skipDuplicates: true });
          createdUnits += inserted.count;
        }
        return { setup, createdProperties, createdUnits, apartmentUnits: 78 };
      }

      let createdProperties = 0;
      for (let number = 1; number <= 27; number += 1) {
        const propertyNumber = String(number);
        const existing = await tx.property.findUnique({
          where: { societyId_type_propertyNumber: { societyId: session.societyId, type: "TENAMENT", propertyNumber } },
          select: { id: true },
        });
        if (!existing) {
          await tx.property.create({
            data: {
              societyId: session.societyId,
              type: "TENAMENT",
              name: "Pramukhpark Society",
              propertyNumber,
            },
          });
          createdProperties += 1;
        }
      }
      return { setup, createdProperties, tenaments: 27 };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof Error && error.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 400 ? "Invalid property setup request." : status === 403 ? "Organizer access required." : "Unable to initialize property structure." }, { status });
  }
}
