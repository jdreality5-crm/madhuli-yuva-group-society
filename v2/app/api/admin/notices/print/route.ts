import { NextResponse } from 'next/server';
import { requireSubAdminPermission, prisma } from '@/lib/auth';

const esc=(v:unknown)=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));

export async function GET(req:Request){
  try{
    const session=await requireSubAdminPermission('NOTICES');
    const id=new URL(req.url).searchParams.get('id');
    if(!id) return NextResponse.json({error:'Notice id is required'},{status:400});
    const notice=await prisma.notice.findFirst({where:{id,societyId:session.societyId}});
    if(!notice) return NextResponse.json({error:'Notice not found'},{status:404});
    const title=notice.gujaratiTitle||notice.title;
    const content=notice.gujaratiContent||notice.content;
    const html=`<!doctype html><html lang="gu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font-family:'Noto Sans Gujarati','Nirmala UI',Arial,sans-serif;color:#292523}.paper{width:210mm;min-height:297mm;position:relative;background:url('/letterhead.jpg') center/100% 100% no-repeat;margin:0 auto}.content{position:absolute;left:14%;right:14%;top:27%;bottom:13%;padding:7mm 9mm;background:rgba(255,255,255,.97);overflow:hidden}.date{text-align:right;font-family:Arial,sans-serif;font-size:11px;color:#746b65}.heading{text-align:center;color:#641d2a;font-size:22px;font-weight:800;margin:7mm 0 5mm}.body{white-space:pre-wrap;font-size:14px;line-height:2;color:#292523}.important{display:inline-block;background:#e7d5a8;color:#641d2a;border-radius:999px;padding:3px 8px;font:700 10px Arial,sans-serif;margin-bottom:4mm}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.paper{break-after:page}}</style></head><body><main class="paper"><section class="content"><div class="date">તારીખ: ${new Date(notice.date).toLocaleDateString('en-IN')}</div>${notice.important?'<div class="important">IMPORTANT / અગત્યની સૂચના</div>':''}<h1 class="heading">${esc(title)}</h1><div class="body">${esc(content)}</div></section></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))</script></body></html>`;
    return new NextResponse(html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition:' : 'inline'}});
  }catch{return NextResponse.json({error:'Forbidden'},{status:403})}
}
