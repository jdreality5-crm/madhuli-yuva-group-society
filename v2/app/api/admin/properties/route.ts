import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";

const createSchema = z.object({
  type: z.enum(["APARTMENT", "TENAMENT"]),
  name: z.string().trim().min(1).max(120),
  propertyNumber: z.string().trim().min(1).max(50),
  block: z.string().trim().max(20).optional().nullable(),
});

type PropertyRow = {
  id:string; societyId:string; type:"APARTMENT"|"TENAMENT"; name:string;
  propertyNumber:string; block:string|null; status:string; createdAt:string; updatedAt:string;
};
type UnitRow = {
  id:string; propertyId:string; label:string; floorNumber:number; floorLabel:string;
  residentType:"OWNER"|"TENANT"|null; ownerName:string|null; ownerMobile:string|null;
  ownerEmail:string|null; residentUserId:string|null; status:string; createdAt:string;
  updatedAt:string; signupEnabled:boolean;
};

async function supabaseRest<T>(table:string, params:Record<string,string>, init?:RequestInit):Promise<T>{
  const base=process.env.SUPABASE_URL?.trim().replace(/\/$/,"");
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!base||!key) throw new Error("Supabase server configuration is missing");
  const url=new URL(base+"/rest/v1/"+table);
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  const response=await fetch(url.toString(),{
    ...init,
    headers:{
      apikey:key,Authorization:"Bearer "+key,Accept:"application/json",
      ...(init?.body?{"Content-Type":"application/json",Prefer:"return=representation"}:{}),
      ...(init?.headers||{})
    },
    cache:"no-store"
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error("Supabase "+table+" request failed");
  return data as T;
}

async function requireOrganizer(){
  const session=await requireSession();
  if(session.role!=="MASTER_ADMIN" && session.role!=="ORGANIZER") throw new Error("FORBIDDEN");
  return session;
}

export async function GET(){
  try{
    const session=await requireOrganizer();
    const properties=await supabaseRest<PropertyRow[]>("Property",{
      select:"*",
      societyId:"eq."+session.societyId,
      status:"eq.ACTIVE",
      order:"type.asc,block.asc,propertyNumber.asc"
    });
    const propertyIds=properties.map(property=>property.id);
    const units=propertyIds.length
      ? await supabaseRest<UnitRow[]>("PropertyUnit",{
          select:"*",
          status:"eq.ACTIVE",
          propertyId:"in.("+propertyIds.join(",")+")",
          order:"floorNumber.asc,label.asc"
        })
      : [];
    const byProperty=new Map<string,UnitRow[]>();
    for(const unit of units){
      const list=byProperty.get(unit.propertyId)||[];
      list.push(unit);
      byProperty.set(unit.propertyId,list);
    }
    return NextResponse.json({
      properties:properties.map(property=>({
        ...property,
        units:byProperty.get(property.id)||[]
      }))
    });
  }catch(error){
    const message=error instanceof Error?error.message:"";
    const status=message==="UNAUTHORIZED"?401:message==="FORBIDDEN"?403:500;
    return NextResponse.json({error:status===401?"Unauthorized":status===403?"Forbidden":"Unable to load properties"},{status});
  }
}

export async function POST(request:NextRequest){
  try{
    const session=await requireOrganizer();
    const body=createSchema.parse(await request.json());
    const propertyNumber=body.propertyNumber.trim();
    const existing=await supabaseRest<PropertyRow[]>("Property",{
      select:"id",
      societyId:"eq."+session.societyId,
      type:"eq."+body.type,
      propertyNumber:"eq."+propertyNumber,
      limit:"1"
    });
    if(existing.length) return NextResponse.json({error:"Property already exists"},{status:409});
    const now=new Date().toISOString();
    const property=await supabaseRest<PropertyRow[]>("Property",{},{
      method:"POST",
      body:JSON.stringify({
        id:crypto.randomUUID(),
        societyId:session.societyId,
        type:body.type,
        name:body.name.trim(),
        propertyNumber,
        block:body.block?.trim()||null,
        createdAt:now,
        updatedAt:now
      })
    });
    return NextResponse.json({property:property[0]},{status:201});
  }catch(error:any){
    const status=error?.name==="ZodError"?400:error?.message==="UNAUTHORIZED"?401:error?.message==="FORBIDDEN"?403:500;
    return NextResponse.json({error:error?.message||"Unable to create property"},{status});
  }
}
