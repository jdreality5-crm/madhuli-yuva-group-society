import React from 'react';

type Name='dashboard'|'property'|'users'|'calendar'|'notice'|'gallery'|'payment'|'report'|'edit'|'trash'|'document'|'camera'|'refresh'|'check'|'home'|'add'|'close';
export function UiIcon({name,size=18,className=''}:{name:Name;size?:number;className?:string}){
 const common={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,ariaHidden:true};
 const paths:Record<Name,React.ReactNode>={
 dashboard:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
 property:<><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5"/><path d="M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/></>,
 users:<><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M17 11a4 4 0 1 0 0-8"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></>,
 calendar:<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
 notice:<><path d="M4 5h16v14H4z"/><path d="M7 9h10M7 13h7"/></>,
 gallery:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 16-5-5-6 6-3-3-4 4"/></>,
 payment:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
 report:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
 edit:<><path d="m4 20 4.5-1L19 8.5a2.12 2.12 0 0 0-3-3L5.5 16z"/><path d="m14 7 3 3"/></>,
 trash:<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></>,
 document:<><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
 camera:<><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></>,
 refresh:<><path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 5v4h4"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 19v-4h-4"/></>,
 check:<><path d="m5 12 4 4L19 7"/></>,
 home:<><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 21v-6h6v6"/></>,
 add:<><path d="M12 5v14M5 12h14"/></>,
 close:<><path d="m6 6 12 12M18 6 6 18"/></>
 };
 return <svg {...common} className={className}>{paths[name]}</svg>;
}
