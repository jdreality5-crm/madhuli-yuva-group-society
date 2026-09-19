import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";

async function rpc<T>(name:string,body:Record<string,unknown>){const b=process.env.SUPABASE_URL?.trim().replace(/\/$/,'');const k=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!b||!k)throw Error("CONFIG");const r=await fetch(b+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:k,Authorization:"Bearer "+k,Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});const d=await r.json().catch(()=>null);if(!r.ok)throw Error("RPC");return d as T}
const schema=z.object({setup:z.enum(["APARTMENT","TENAMENT"])});
export async function POST(req:Request){try{const s=await requireAdmin();const {setup}=schema.parse(await req.json());const result=await rpc<any>("initialize_property_setup",{p_society_id:s.societyId,p_setup:setup});return NextResponse.json(result)}catch(e){const status=e instanceof z.ZodError?400:e instanceof Error&&e.message==="FORBIDDEN"?403:500;return NextResponse.json({error:status===400?"Invalid property setup request.":status===403?"Organizer access required.":"Unable to initialize property structure."},{status})}}
