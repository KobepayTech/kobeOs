// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Building2, Hotel, LayoutGrid, Wallet, BookOpen, TrendingUp, Plus, Copy, Check, Search, ScanLine,
  CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Clock, KeyRound, Share2, RefreshCw, ChevronRight,
  Bell, Pencil, Smartphone, LogIn, LogOut, BedDouble, Users, MessageCircle, Layers
} from "lucide-react";

/* ================= Persistence =================
 * Swapped from the original window.storage shim to localStorage so the
 * KobeOS desktop persists state across reloads. Falls back to an
 * in-memory map when localStorage is disabled (private mode etc.).
 */
const _mem: Record<string, string> = {};
const store = {
  async get(k: string) {
    try {
      const v = window.localStorage.getItem(k);
      if (v !== null) return { key: k, value: v };
    } catch { /* fall through */ }
    if (k in _mem) return { key: k, value: _mem[k] };
    throw new Error("nf");
  },
  async set(k: string, v: string) {
    try { window.localStorage.setItem(k, v); }
    catch { _mem[k] = v; }
    return { key: k, value: v };
  },
};
const DB_KEY = "posys:db:v3";

/* ================= QR encoder (local, offline) ================= */
function qrMatrix(text){
  const EXP=new Array(256),LOG=new Array(256); let x=1;
  for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&0x100)x^=0x11d;} EXP[255]=EXP[0];
  const gmul=(a,b)=>(a===0||b===0?0:EXP[(LOG[a]+LOG[b])%255]);
  const bytes=[]; for(const ch of text){const cp=ch.codePointAt(0); if(cp<0x80)bytes.push(cp); else if(cp<0x800)bytes.push(0xc0|(cp>>6),0x80|(cp&0x3f)); else bytes.push(0xe0|(cp>>12),0x80|((cp>>6)&0x3f),0x80|(cp&0x3f));}
  const n=bytes.length;
  const VERS=[{v:1,size:21,dataCW:16,ec:10,blocks:1,align:null},{v:2,size:25,dataCW:28,ec:16,blocks:1,align:18},{v:3,size:29,dataCW:44,ec:26,blocks:1,align:22},{v:4,size:33,dataCW:64,ec:18,blocks:2,align:26}];
  let V=VERS.find(c=>n+2<=c.dataCW)||VERS[VERS.length-1];
  const size=V.size,totalDataCW=V.dataCW,ecLen=V.ec,nb=V.blocks;
  const bits=[]; const pushBits=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>i)&1);};
  pushBits(0b0100,4); pushBits(n,8); for(const b of bytes)pushBits(b,8);
  const cap=totalDataCW*8; for(let i=0;i<Math.min(4,cap-bits.length);i++)bits.push(0);
  while(bits.length%8!==0)bits.push(0); const PAD=[0xEC,0x11]; let pi=0; while(bits.length<cap){pushBits(PAD[pi%2],8);pi++;}
  const dataCW=[]; for(let i=0;i<bits.length;i+=8){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bits[i+j];dataCW.push(b);}
  let gen=[1]; for(let i=0;i<ecLen;i++){const g2=new Array(gen.length+1).fill(0);for(let j=0;j<gen.length;j++){g2[j]^=gen[j];g2[j+1]^=gmul(gen[j],EXP[i]);}gen=g2;}
  const rsEncode=(msg)=>{const res=msg.concat(new Array(ecLen).fill(0));for(let i=0;i<msg.length;i++){const c=res[i];if(c!==0)for(let j=0;j<gen.length;j++)res[i+j]^=gmul(gen[j],c);}return res.slice(msg.length);};
  const perBlock=totalDataCW/nb,blocks=[],eccBlocks=[];
  for(let b=0;b<nb;b++){const blk=dataCW.slice(b*perBlock,(b+1)*perBlock);blocks.push(blk);eccBlocks.push(rsEncode(blk));}
  const finalCW=[]; for(let i=0;i<perBlock;i++)for(let b=0;b<nb;b++)finalCW.push(blocks[b][i]); for(let i=0;i<ecLen;i++)for(let b=0;b<nb;b++)finalCW.push(eccBlocks[b][i]);
  const mat=Array.from({length:size},()=>new Array(size).fill(0)); const res=Array.from({length:size},()=>new Array(size).fill(false));
  const setF=(r,c,val)=>{if(r<0||r>=size||c<0||c>=size)return;mat[r][c]=val?1:0;res[r][c]=true;};
  const finder=(r0,c0)=>{for(let r=-1;r<=7;r++)for(let c=-1;c<=7;c++){const inb=(r>=0&&r<=6&&(c===0||c===6))||(c>=0&&c<=6&&(r===0||r===6))||(r>=2&&r<=4&&c>=2&&c<=4);setF(r0+r,c0+c,inb);}};
  finder(0,0);finder(0,size-7);finder(size-7,0);
  for(let i=8;i<size-8;i++){if(!res[6][i])setF(6,i,i%2===0);if(!res[i][6])setF(i,6,i%2===0);}
  setF(size-8,8,true);
  if(V.align!=null){const a=V.align;for(let r=-2;r<=2;r++)for(let c=-2;c<=2;c++)setF(a+r,a+c,Math.max(Math.abs(r),Math.abs(c))!==1);}
  for(let r=0;r<=8;r++)res[r][8]=true; for(let c=0;c<=8;c++)res[8][c]=true; for(let r=size-7;r<size;r++)res[r][8]=true; for(let c=size-8;c<size;c++)res[8][c]=true;
  const totalBits=finalCW.length*8; let bitIndex=0;
  for(let col=size-1;col>=1;col-=2){if(col===6)col=5;const up=((col+1)&2)===0;for(let vert=0;vert<size;vert++){const row=up?size-1-vert:vert;for(let k=0;k<2;k++){const cc=col-k;if(!res[row][cc]){let bit=0;if(bitIndex<totalBits)bit=(finalCW[bitIndex>>3]>>(7-(bitIndex&7)))&1;bitIndex++;mat[row][cc]=bit;}}}}
  const maskBit=(m,r,c)=>{switch(m){case 0:return(r+c)%2===0;case 1:return r%2===0;case 2:return c%3===0;case 3:return(r+c)%3===0;case 4:return(Math.floor(r/2)+Math.floor(c/3))%2===0;case 5:return((r*c)%2)+((r*c)%3)===0;case 6:return(((r*c)%2)+((r*c)%3))%2===0;default:return(((r+c)%2)+((r*c)%3))%2===0;}};
  const bitLen=(v)=>{let l=0;while(v){l++;v>>=1;}return l;};
  const placeFormat=(T,m)=>{const data=(0b00<<3)|m;let d=data<<10;const G=0x537;while(bitLen(d)>=bitLen(G))d^=G<<(bitLen(d)-bitLen(G));const fmt=(((data<<10)|d)^0x5412)&0x7fff;for(let i=0;i<15;i++){const bit=(fmt>>i)&1;if(i<6)T[i][8]=bit;else if(i<8)T[i+1][8]=bit;else T[size-15+i][8]=bit;}for(let i=0;i<15;i++){const bit=(fmt>>i)&1;if(i<8)T[8][size-1-i]=bit;else if(i===8)T[8][7]=bit;else T[8][14-i]=bit;}T[size-8][8]=1;};
  const penalty=(M)=>{let p=0;for(let r=0;r<size;r++){let run=1;for(let c=1;c<size;c++){if(M[r][c]===M[r][c-1])run++;else{if(run>=5)p+=3+(run-5);run=1;}}if(run>=5)p+=3+(run-5);}for(let c=0;c<size;c++){let run=1;for(let r=1;r<size;r++){if(M[r][c]===M[r-1][c])run++;else{if(run>=5)p+=3+(run-5);run=1;}}if(run>=5)p+=3+(run-5);}for(let r=0;r<size-1;r++)for(let c=0;c<size-1;c++){const v=M[r][c];if(v===M[r][c+1]&&v===M[r+1][c]&&v===M[r+1][c+1])p+=3;}const pat=[1,0,1,1,1,0,1,0,0,0,0],patR=[0,0,0,0,1,0,1,1,1,0,1];const m11=(arr,r,c,h)=>{for(let k=0;k<11;k++){const v=h?M[r][c+k]:M[r+k][c];if(v!==arr[k])return false;}return true;};for(let r=0;r<size;r++)for(let c=0;c<=size-11;c++)if(m11(pat,r,c,true)||m11(patR,r,c,true))p+=40;for(let c=0;c<size;c++)for(let r=0;r<=size-11;r++)if(m11(pat,r,c,false)||m11(patR,r,c,false))p+=40;let dark=0;for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(M[r][c])dark++;p+=Math.floor(Math.abs((dark*100)/(size*size)-50)/5)*10;return p;};
  let best=null,bestP=Infinity;
  for(let m=0;m<8;m++){const T=mat.map(row=>row.slice());for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(!res[r][c]&&maskBit(m,r,c))T[r][c]^=1;placeFormat(T,m);const pen=penalty(T);if(pen<bestP){bestP=pen;best=T;}}
  return best;
}
function QRCode({value,size=150}){
  const matrix=useMemo(()=>{try{return qrMatrix(value);}catch{return null;}},[value]);
  if(!matrix)return null;
  const n=matrix.length,m=4,dim=n+2*m,rects=[];
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(matrix[r][c])rects.push(<rect key={r+"-"+c} x={c+m} y={r+m} width={1.02} height={1.02}/>);
  return(<svg width={size} height={size} viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" style={{display:"block"}}><rect x={0} y={0} width={dim} height={dim} fill="#FFFFFF"/><g fill="#16213E">{rects}</g></svg>);
}

/* ================= Helpers ================= */
const fmtAmt=(n)=>new Intl.NumberFormat("en-US").format(Math.round(Number(n)||0));
const pad2=(n)=>String(n).padStart(2,"0");
const monthKeyOf=(d)=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
// Computed at call site (not module-load) so a till left open across
// the 1st of the month writes into the correct month instead of the
// snapshot captured at first import. Exposed as a getter so all
// call sites reflect the same wall-clock month.
const curMonth=()=>monthKeyOf(new Date());
const GRACE_DAY=7, TOKEN_TTL_MIN=30;
const rid=(p)=>p+Math.random().toString(36).slice(2,8);
const genToken=()=>String(Math.floor(100000+Math.random()*900000));
const MONTHS={sw:["Jan","Feb","Mac","Apr","Mei","Jun","Jul","Ago","Sep","Okt","Nov","Des"],en:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]};
const monthName=(key,lang)=>{const[y,m]=key.split("-").map(Number);return`${MONTHS[lang][m-1]} ${y}`;};
const fmtDateTime=(iso,lang)=>{const d=new Date(iso);return`${pad2(d.getDate())} ${MONTHS[lang][d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;};
const fmtDay=(iso,lang)=>{const d=new Date(iso);return`${pad2(d.getDate())} ${MONTHS[lang][d.getMonth()]}`;};
const TYPE={sw:{shop:"Duka",room:"Chumba",office:"Ofisi",apartment:"Nyumba",storage:"Ghala"},en:{shop:"Shop",room:"Room",office:"Office",apartment:"Apartment",storage:"Storage"}};
const HTYPE={sw:{standard:"Kawaida",deluxe:"Deluxe",suite:"Suite"},en:{standard:"Standard",deluxe:"Deluxe",suite:"Suite"}};
const waNum=(phone)=>{let d=String(phone||"").replace(/\D/g,"");if(d.startsWith("0"))d="255"+d.slice(1);else if(!d.startsWith("255"))d="255"+d;return d;};

function unitStatus(u,monthKey){
  if(u.vacant||!u.tenantName)return"vacant";
  if(u.paid&&u.paid[monthKey])return"paid";
  if(monthKey<curMonth())return"overdue";
  if(monthKey===curMonth())return new Date().getDate()>GRACE_DAY?"overdue":"due";
  return"due";
}
function findUnit(db,unitId){for(const p of db.properties){const u=p.units.find(x=>x.id===unitId);if(u)return{property:p,unit:u};}return null;}
function remindedThisMonth(db,unitId){return db.reminders.some(r=>r.unitId===unitId&&r.monthKey===curMonth());}

/* mutations */
function applyPayment(db,unitId,amount,method,code){
  const at=new Date().toISOString();
  const properties=db.properties.map(p=>({...p,units:p.units.map(u=>u.id===unitId?{...u,paid:{...u.paid,[curMonth()]:{amount,method,at,code:code||undefined}}}:u)}));
  const f=findUnit(db,unitId);
  const payment={id:rid("p_"),unitId,propertyName:f.property.name,label:f.unit.label,tenantName:f.unit.tenantName,amount,method,code:code||null,monthKey:curMonth(),at};
  return{...db,properties,payments:[...db.payments,payment]};
}
function logReminder(db,unitId){
  const f=findUnit(db,unitId); if(!f)return db;
  if(remindedThisMonth(db,unitId))return db;
  const rem={id:rid("rem_"),unitId,label:f.unit.label,tenantName:f.unit.tenantName,monthKey:curMonth(),at:new Date().toISOString()};
  return{...db,reminders:[...db.reminders,rem]};
}
function addProperty(db,name,location){return{...db,properties:[...db.properties,{id:rid("prop_"),name,location,floors:[{id:rid("fl_"),name:"G",corridors:1}],units:[]}]};}
function nextSlot(units,floorId,corridor,side){const on=units.filter(u=>u.floorId===floorId&&(u.corridor||0)===corridor&&u.side===side);return on.length?Math.max(...on.map(u=>u.slot??0))+1:0;}
function addUnit(db,propertyId,unit){return{...db,properties:db.properties.map(p=>{if(p.id!==propertyId)return p;const slot=nextSlot(p.units,unit.floorId,unit.corridor||0,unit.side);return{...p,units:[...p.units,{id:rid("u_"),paid:{},corridor:0,...unit,slot}]};})};}
function addUnitsBulk(db,propertyId,{prefix,start,count,type,rent,floorId,corridor,side}){return{...db,properties:db.properties.map(p=>{if(p.id!==propertyId)return p;let slot=nextSlot(p.units,floorId,corridor||0,side);const ns=[];for(let i=0;i<count;i++)ns.push({id:rid("u_"),label:`${prefix}${start+i}`,type,monthlyRent:rent,vacant:true,tenantName:null,tenantPhone:null,paid:{},floorId,corridor:corridor||0,side,slot:slot+i});return{...p,units:[...p.units,...ns]};})};}
function addFloor(db,propertyId,name){return{...db,properties:db.properties.map(p=>p.id!==propertyId?p:{...p,floors:[...(p.floors||[]),{id:rid("fl_"),name,corridors:1}]})};}
function setFloorCorridors(db,propertyId,floorId,n){return{...db,properties:db.properties.map(p=>p.id!==propertyId?p:{...p,floors:(p.floors||[]).map(f=>f.id===floorId?{...f,corridors:n}:f)})};}
function setUnitRent(db,unitId,newRent){return{...db,properties:db.properties.map(p=>({...p,units:p.units.map(u=>u.id===unitId?{...u,monthlyRent:newRent}:u)}))};}
function applyRentIncrease(db,propertyId,pct){return{...db,properties:db.properties.map(p=>p.id!==propertyId?p:{...p,units:p.units.map(u=>(!u.vacant&&u.tenantName)?{...u,monthlyRent:Math.round(u.monthlyRent*(1+pct/100))}:u)})};}
function hotelAddRoom(db,room){return{...db,hotel:{...db.hotel,rooms:[...db.hotel.rooms,{id:rid("r_"),...room}]}};}
function hotelCheckIn(db,data){
  const room=db.hotel.rooms.find(r=>r.id===data.roomId);
  const ci=new Date(data.checkInDate+"T12:00:00"); const co=new Date(ci); co.setDate(co.getDate()+data.nights);
  const stay={id:rid("s_"),guestName:data.guestName,phone:data.phone,roomId:data.roomId,roomLabel:room?.label,nights:data.nights,ratePerNight:data.rate,checkIn:ci.toISOString(),checkOut:co.toISOString(),status:"in",createdAt:new Date().toISOString()};
  return{...db,hotel:{...db.hotel,stays:[...db.hotel.stays,stay]}};
}
function hotelCheckOut(db,stayId){return{...db,hotel:{...db.hotel,stays:db.hotel.stays.map(s=>s.id===stayId?{...s,status:"out",checkedOutAt:new Date().toISOString()}:s)}};}

/* ================= Seed ================= */
function seedHistory(rent,{paidCurrent,gaps=[]}){const paid={};const now=new Date();const y=now.getFullYear();const curM=now.getMonth();for(let m=0;m<=curM;m++){if(m===curM&&!paidCurrent)continue;if(gaps.includes(m))continue;paid[`${y}-${pad2(m+1)}`]={amount:rent,method:"cash",at:new Date(y,m,3,10,15).toISOString()};}return paid;}
function normalizeDb(db){
  if(!db||!db.properties)return db;
  const props=db.properties.map(p=>{
    const floors=(p.floors&&p.floors.length)?p.floors:[{id:rid("fl_"),name:"G",corridors:1}];
    const fset=new Set(floors.map(f=>f.id)); const f0=floors[0].id;
    const units=(p.units||[]).map(u=>({...u,floorId:(u.floorId&&fset.has(u.floorId))?u.floorId:f0,corridor:u.corridor||0,side:u.side==="right"?"right":"left"}));
    return {...p,floors,units};
  });
  return {...db,properties:props};
}
function seedDb(){
  const fG=rid("fl_"),f1=rid("fl_");
  const mk=(label,type,name,phone,rent,opts,side,slot)=>({id:rid("u_"),label,type,tenantName:name,tenantPhone:phone,monthlyRent:rent,vacant:!name,paid:name?seedHistory(rent,opts||{paidCurrent:false}):{},floorId:fG,corridor:0,side,slot});
  const prop={id:rid("prop_"),name:"Kariakoo Plaza",location:"Kariakoo, Dar es Salaam",floors:[{id:fG,name:"G",corridors:1},{id:f1,name:"1",corridors:1}],units:[
    mk("A1","shop","Salehe Sigala","0712 884 220",250000,{paidCurrent:true},"left",0),
    mk("A2","shop","Fatuma Hassan","0765 220 203",300000,{paidCurrent:false},"right",0),
    mk("A3","shop",null,null,280000,null,"left",1),
    mk("B1","room","Amina Said","0688 145 902",180000,{paidCurrent:false,gaps:[new Date().getMonth()-1]},"right",1),
    mk("B2","office","Neema Mtega","0769 887 170",400000,{paidCurrent:true},"left",2),
  ]};
  const r1=rid("r_"),r2=rid("r_"),r3=rid("r_");
  const hotel={rooms:[{id:r1,label:"101",type:"standard",rate:40000},{id:r2,label:"102",type:"standard",rate:45000},{id:r3,label:"201",type:"deluxe",rate:70000}],
    stays:[{id:rid("s_"),guestName:"Hamisi Juma",phone:"0713 220 905",roomId:r2,roomLabel:"102",nights:2,ratePerNight:45000,checkIn:new Date().toISOString(),checkOut:new Date(Date.now()+2*864e5).toISOString(),status:"in",createdAt:new Date().toISOString()}]};
  return{properties:[prop],tokens:{},payments:[],reminders:[],hotel,seeded:true};
}

/* ================= Strings ================= */
const STR={
  sw:{brand:"POSys",tagline:"Jengo na Hoteli",modeRent:"Pango",modeHotel:"Hoteli",
    tUnits:"Jengo",tCollect:"Lipa",tSim:"Ripoti",tBook:"Kitabu",
    collected:"Imekusanywa",rate:"Kiwango",paidUnits:"Zimelipa",pendingUnits:"Hazijalipa",
    newProperty:"Jengo jipya",addRoom:"Ongeza chumba",noProps:"Bado huna jengo. Tengeneza la kwanza.",createFirst:"Tengeneza jengo",
    statusPaid:"Imelipwa",statusDue:"Inadaiwa",statusOverdue:"Imechelewa",statusVacant:"Wazi",
    paidShort:"Imelipwa",dueShort:"Inadai",overdueShort:"Chelewa",vacant:"Wazi",
    tenant:"Mpangaji",phone:"Simu",rent:"Kodi",cycle:"Mzunguko wa malipo",monthsPaid:"miezi",back:"Rudi",perMonth:"mwezi",
    recordPay:"Rekodi malipo",issueToken:"Tengeneza token",editRent:"Badili kodi",sendReminder:"Tuma kumbusho",reminded:"Imekumbushwa",
    propName:"Jina la jengo",propLocation:"Mahali",create:"Tengeneza",
    roomLabel:"Namba ya chumba",roomType:"Aina",monthlyRent:"Kodi ya mwezi (TZS)",isOccupied:"Kuna mpangaji?",tenantName:"Jina la mpangaji",add:"Ongeza",save:"Hifadhi",
    amount:"Kiasi (TZS)",newRent:"Kodi mpya (TZS)",
    remindAll:"Kumbusha wote",remindTitle:"Tuma kumbusho",remindSub:"Tuma ujumbe au rekodi kumbusho.",whatsapp:"WhatsApp",copy:"Nakili",copied:"Imenakiliwa",share:"Tuma",done:"Sawa",markAll:"Weka wote wamekumbushwa",remindedN:"Wamekumbushwa",
    tokenTitle:"TOKEN YA MALIPO",expired:"Imeisha muda",enterCode:"Namba ya token",copyCode:"Nakili",cancelToken:"Futa token",showTenant:"Mpe mpangaji namba/QR au alipie kwa simu.",
    payByMobile:"Lipa kwa simu",payRef:"Kumbukumbu",payProto:"Itafungua simu kupiga USSD. (Majaribio)",
    collectTitle:"Pokea malipo kwa token",collectSub:"Ingiza au changanua token kuthibitisha kabla ya kupokea fedha.",find:"Tafuta",scan:"Changanua QR",
    notFound:"HAIPO",notFoundSub:"Hakuna token yenye namba hii.",usedTitle:"IMESHATUMIKA",usedSub:"Token hii ilishatumika.",expiredTitle:"IMEISHA MUDA",expiredSub:"Token imepita muda. Tengeneza nyingine.",
    confirmTitle:"Thibitisha malipo",received:"Kiasi kilicholipwa (TZS)",confirmPay:"Thibitisha na pokea",recordedTitle:"IMEPOKELEWA",recordedSub:"Malipo yamerekodiwa na mwezi umewekwa alama.",payAnother:"Pokea nyingine",scanHint:"Elekeza QR ndani ya fremu",cancel:"Ghairi",unit:"Kibanda",method:"Njia",
    simTitle:"Mwigo wa kodi",simSub:"Jaribu ongezeko la kodi kisha tumia kuunda kodi mpya.",increaseBy:"Ongeza kwa",currentTot:"Sasa",projected:"Itakuwa",change:"Badiliko",perUnit:"Kwa kila kibanda",riskLow:"Hatari ndogo",riskMod:"Wastani",riskHigh:"Kubwa",estRetention:"Wanaobaki (kadirio)",applyRents:"Tumia kodi mpya",appliedMsg:"Kodi mpya zimewekwa.",noOccupied:"Hakuna vibanda vyenye wapangaji.",
    bookTitle:"Kitabu cha malipo",searchPh:"Tafuta kibanda, jina au token",empty:"Bado hakuna malipo.",noRes:"Hakuna matokeo.",methodCash:"Taslimu",methodToken:"Token",resetDemo:"Anzisha upya data ya majaribio",
    hOverview:"Vyumba",hGuests:"Wageni",occToday:"Leo",occupancy:"Vyumba vilivyochukuliwa",available:"Wazi",occupied:"Imechukuliwa",revenueIn:"Mapato (waliopo)",addHotelRoom:"Ongeza chumba",checkIn:"Ingiza mgeni",guestName:"Jina la mgeni",room:"Chumba",nights:"Usiku",ratePerNight:"Bei kwa usiku (TZS)",checkInDate:"Tarehe ya kuingia",total:"Jumla",checkOut:"Toa mgeni",currentGuests:"Wageni waliopo",pastGuests:"Waliotoka",noGuests:"Hakuna mgeni aliyepo.",noRooms:"Ongeza chumba kwanza.",hRoomType:"Aina ya chumba",checkInBtn:"Ingiza",nightsShort:"usiku",
    floor:"Ghorofa",addFloor:"Ongeza ghorofa",single:"Kimoja",bulk:"Wingi",prefix:"Herufi",startAt:"Anza",count:"Idadi",left:"Kushoto",right:"Kulia",viewList:"Orodha",viewPlan:"Ramani",corridor:"Korido",corridors:"Korido",roomsOnFloor:"vyumba",
  },
  en:{brand:"POSys",tagline:"Property & Hotel",modeRent:"Rentals",modeHotel:"Hotel",
    tUnits:"Property",tCollect:"Collect",tSim:"Insights",tBook:"Ledger",
    collected:"Collected",rate:"Rate",paidUnits:"Paid",pendingUnits:"Pending",
    newProperty:"New property",addRoom:"Add room",noProps:"No properties yet. Create your first.",createFirst:"Create property",
    statusPaid:"Paid",statusDue:"Due",statusOverdue:"Overdue",statusVacant:"Vacant",
    paidShort:"Paid",dueShort:"Due",overdueShort:"Overdue",vacant:"Vacant",
    tenant:"Tenant",phone:"Phone",rent:"Rent",cycle:"Payment cycle",monthsPaid:"months",back:"Back",perMonth:"mo",
    recordPay:"Record payment",issueToken:"Issue token",editRent:"Change rent",sendReminder:"Send reminder",reminded:"Reminded",
    propName:"Property name",propLocation:"Location",create:"Create",
    roomLabel:"Room number",roomType:"Type",monthlyRent:"Monthly rent (TZS)",isOccupied:"Has a tenant?",tenantName:"Tenant name",add:"Add",save:"Save",
    amount:"Amount (TZS)",newRent:"New rent (TZS)",
    remindAll:"Remind all",remindTitle:"Send reminder",remindSub:"Send a message or log a reminder.",whatsapp:"WhatsApp",copy:"Copy",copied:"Copied",share:"Share",done:"Done",markAll:"Mark all reminded",remindedN:"Reminded",
    tokenTitle:"PAYMENT TOKEN",expired:"Expired",enterCode:"Token code",copyCode:"Copy",cancelToken:"Cancel token",showTenant:"Give the tenant the code/QR, or let them pay by phone.",
    payByMobile:"Pay by mobile money",payRef:"Reference",payProto:"Opens the dialer for USSD. (Prototype)",
    collectTitle:"Collect rent by token",collectSub:"Enter or scan a token to verify before taking cash.",find:"Find",scan:"Scan QR",
    notFound:"NOT FOUND",notFoundSub:"No token with that code.",usedTitle:"ALREADY USED",usedSub:"This token was already used.",expiredTitle:"EXPIRED",expiredSub:"This token has expired. Issue a new one.",
    confirmTitle:"Confirm payment",received:"Amount received (TZS)",confirmPay:"Confirm & collect",recordedTitle:"RECORDED",recordedSub:"Payment recorded and the month marked paid.",payAnother:"Collect another",scanHint:"Point the QR inside the frame",cancel:"Cancel",unit:"Unit",method:"Method",
    simTitle:"Rent simulation",simSub:"Try a rent increase, then apply it to create new rents.",increaseBy:"Increase by",currentTot:"Current",projected:"Projected",change:"Change",perUnit:"Per unit",riskLow:"Low risk",riskMod:"Moderate",riskHigh:"High",estRetention:"Est. retention",applyRents:"Apply new rents",appliedMsg:"New rents applied.",noOccupied:"No occupied units to simulate.",
    bookTitle:"Payment ledger",searchPh:"Search unit, name or token",empty:"No payments yet.",noRes:"No results.",methodCash:"Cash",methodToken:"Token",resetDemo:"Reset demo data",
    hOverview:"Rooms",hGuests:"Guests",occToday:"Today",occupancy:"Rooms occupied",available:"Available",occupied:"Occupied",revenueIn:"In-house revenue",addHotelRoom:"Add room",checkIn:"Check in a guest",guestName:"Guest name",room:"Room",nights:"Nights",ratePerNight:"Rate per night (TZS)",checkInDate:"Check-in date",total:"Total",checkOut:"Check out",currentGuests:"Current guests",pastGuests:"Checked out",noGuests:"No guests checked in.",noRooms:"Add a room first.",hRoomType:"Room type",checkInBtn:"Check in",nightsShort:"nights",
    floor:"Floor",addFloor:"Add floor",single:"Single",bulk:"Bulk",prefix:"Prefix",startAt:"Start",count:"Count",left:"Left",right:"Right",viewList:"List",viewPlan:"Plan",corridor:"Corridor",corridors:"Corridors",roomsOnFloor:"rooms",
  },
};

/* ================= Styles ================= */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
.posys *{box-sizing:border-box;margin:0;padding:0}
.posys{--navy:#16213E;--brand:#0F3460;--brand-d:#0c2a4f;--ink:#1A1A2E;--muted:#6C757D;--bg:#F5F7FA;--card:#FFF;--line:#E6EAF0;--green:#06A77D;--green-bg:#E2F5EF;--amber:#E8A317;--amber-bg:#FCF1D8;--red:#E94560;--red-bg:#FCE4E8;--grey:#8A94A6;--grey-bg:#EEF1F5;font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;width:100%;-webkit-font-smoothing:antialiased}
.posys .wrap{max-width:480px;margin:0 auto;padding:0 0 60px}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace}
.topbar{background:var(--navy);color:#fff;padding:14px 18px 11px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:20}
.brandwrap{display:flex;align-items:center;gap:10px}
.brandwrap .mark{width:33px;height:33px;border-radius:9px;background:var(--brand);display:flex;align-items:center;justify-content:center}
.brandname{font-weight:800;font-size:16px;letter-spacing:-.01em}
.brandtag{font-size:10.5px;color:#9FB0CC;margin-top:1px}
.lang{display:flex;background:rgba(255,255,255,.10);border-radius:8px;padding:3px;gap:2px}
.lang button{border:0;background:transparent;color:#C3CEE2;font-family:inherit;font-weight:600;font-size:12px;padding:5px 9px;border-radius:6px;cursor:pointer}
.lang button.on{background:#fff;color:var(--navy)}
.modebar{background:var(--navy);padding:0 12px 9px;position:sticky;top:57px;z-index:19}
.modeseg{display:flex;background:rgba(255,255,255,.10);border-radius:10px;padding:3px;gap:3px}
.modeseg button{flex:1;border:0;background:transparent;color:#C3CEE2;font-family:inherit;font-weight:700;font-size:13px;padding:8px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}
.modeseg button.on{background:#fff;color:var(--navy)}
.modeseg svg{width:16px;height:16px}
.tabs{display:flex;background:var(--navy);padding:0 10px 10px;position:sticky;top:100px;z-index:18}
.tabs button{flex:1;border:0;background:transparent;color:#8294B5;font-family:inherit;font-weight:600;font-size:12px;padding:8px 3px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;border-radius:9px}
.tabs button.on{background:rgba(255,255,255,.08);color:#fff}
.tabs svg{width:17px;height:17px}
.page{padding:18px 16px 0;animation:fade .22s ease}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--brand)}
.h1{font-size:21px;font-weight:800;margin:5px 0 2px;letter-spacing:-.01em}
.sub{font-size:13px;color:var(--muted);line-height:1.45;margin-bottom:16px}
.propbar{display:flex;gap:8px;overflow-x:auto;padding:2px 0 14px}
.propchip{flex:0 0 auto;border:1.5px solid var(--line);background:var(--card);border-radius:20px;padding:8px 14px;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:7px;color:var(--ink)}
.propchip.on{background:var(--brand);color:#fff;border-color:var(--brand)}
.propchip.add{border-style:dashed;color:var(--brand)}
.propchip.add svg{width:15px;height:15px}
.sumcard{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:15px 16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(20,30,60,.04)}
.sumtop{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:11px}
.sumtop .lab{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.sumtop .mo{font-size:12.5px;font-weight:600;color:var(--brand)}
.sumamt{font-size:26px;font-weight:800;letter-spacing:-.02em}
.sumamt small{font-size:13px;font-weight:600;margin-left:5px}.sumamt .of{color:var(--muted)}
.bar{height:8px;border-radius:6px;background:var(--grey-bg);overflow:hidden;margin:11px 0 10px}
.bar>div{height:100%;background:var(--green);border-radius:6px;transition:width .4s}
.sumfoot{display:flex;gap:16px;font-size:12px}.sumfoot b{font-family:'JetBrains Mono',monospace}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}
.banner{display:flex;align-items:center;gap:10px;background:var(--amber-bg);border:1px solid #F0DDA8;border-radius:12px;padding:11px 13px;margin-bottom:14px}
.banner .bi{color:#9a6a00}.banner svg{width:18px;height:18px}
.banner .bt{flex:1;font-size:12.5px;color:#7a5500;font-weight:600}
.banner button{border:0;background:#9a6a00;color:#fff;font-family:inherit;font-weight:700;font-size:12px;padding:7px 12px;border-radius:8px;cursor:pointer;white-space:nowrap}
.addbtn{width:100%;border:1.5px dashed var(--line);background:var(--card);border-radius:12px;padding:13px;font-family:inherit;font-weight:700;font-size:13.5px;color:var(--brand);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px}
.addbtn svg{width:17px;height:17px}
.gridhead{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--muted);margin:0 2px 10px}.gridhead svg{width:15px;height:15px}
.ugrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.utile{border:1px solid var(--line);border-radius:13px;padding:12px 13px;background:var(--card);cursor:pointer;text-align:left;transition:transform .05s;box-shadow:0 1px 2px rgba(20,30,60,.04)}
.utile:active{transform:scale(.985)}
.utile .ut{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
.utile .ulabel{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:17px}
.utile .uname{font-size:13px;font-weight:600;line-height:1.2}
.utile .utype{font-size:11px;color:var(--muted);margin-top:1px}
.ustat{font-size:11px;font-weight:700;display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;margin-top:9px}
.utile .ustat{margin-top:9px}
.s-paid{background:var(--green-bg);color:var(--green)}.s-paid .pd{background:var(--green)}
.s-due{background:var(--amber-bg);color:#9a6a00}.s-due .pd{background:var(--amber)}
.s-overdue{background:var(--red-bg);color:var(--red)}.s-overdue .pd{background:var(--red)}
.s-vacant{background:var(--grey-bg);color:var(--grey)}.s-vacant .pd{background:var(--grey)}
.pd{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px}
.remind-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:var(--brand);background:#EAF0FB;padding:2px 7px;border-radius:20px;margin-top:6px}
.remind-badge svg{width:11px;height:11px}
.backbtn{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:var(--brand);font-family:inherit;font-weight:600;font-size:13px;cursor:pointer;padding:4px 0;margin-bottom:8px}.backbtn svg{width:16px;height:16px}
.dcard{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:16px 17px;margin-bottom:14px;box-shadow:0 1px 2px rgba(20,30,60,.04)}
.dhead{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
.dlabel{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:24px}
.dtype{font-size:12px;color:var(--muted);margin-top:2px}
.drows{display:flex;flex-direction:column;gap:10px}
.drow{display:flex;justify-content:space-between;gap:14px;font-size:13.5px}.drow .k{color:var(--muted)}.drow .v{font-weight:600;text-align:right}.drow .v.amt{font-family:'JetBrains Mono',monospace}
.cyclewrap{margin:6px 0 16px}
.cyclelab{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:9px}
.cycle{display:flex;justify-content:space-between;gap:3px}
.cyc{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px}
.cyc .cd{width:100%;max-width:22px;aspect-ratio:1;border-radius:50%}
.cyc .cm{font-size:9.5px;color:var(--muted);font-weight:600}
.cd-paid{background:var(--green)}.cd-due{background:var(--amber)}.cd-overdue{background:var(--red)}.cd-future{background:transparent;border:1.5px solid var(--line)}
.actcol{display:flex;flex-direction:column;gap:9px}
.actrow{display:flex;gap:9px}.actrow .btn{flex:1}
.btn{width:100%;border:0;border-radius:12px;padding:14px;font-family:inherit;font-weight:700;font-size:14.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .15s,transform .05s}
.btn:active{transform:scale(.99)}
.btn.primary{background:var(--brand);color:#fff}.btn.primary:hover{background:var(--brand-d)}
.btn.green{background:var(--green);color:#fff}
.btn.ghost{background:var(--card);color:var(--ink);border:1.5px solid var(--line)}
.btn.amber{background:var(--amber);color:#3d2c00}
.btn svg{width:18px;height:18px}
.field{margin-bottom:13px}
.field label{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.field input,.field select{width:100%;border:1.5px solid var(--line);background:var(--card);border-radius:11px;padding:13px 14px;font-family:inherit;font-size:15px;color:var(--ink)}
.field input:focus,.field select:focus{outline:none;border-color:var(--brand)}
.field.amt input{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:18px}
.field.code input{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:22px;letter-spacing:.18em;text-align:center}
.row2{display:flex;gap:10px}.row2 .field{flex:1}
.seg{display:flex;gap:8px;margin-bottom:13px}
.seg button{flex:1;border:1.5px solid var(--line);background:var(--card);border-radius:11px;padding:11px;font-family:inherit;font-weight:600;font-size:13.5px;cursor:pointer;color:var(--muted)}
.seg button.on{border-color:var(--brand);background:#F0F5FB;color:var(--brand)}
.token{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(20,30,60,.06)}
.tktop{padding:15px 17px}
.tkhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.tkbrand{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.09em;color:var(--brand)}.tkbrand svg{width:15px;height:15px}
.tktimer{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;font-family:'JetBrains Mono',monospace;color:#9a6a00;background:var(--amber-bg);padding:4px 9px;border-radius:20px}
.tktimer.dead{color:var(--red);background:var(--red-bg)}.tktimer svg{width:13px;height:13px}
.tkamt{font-size:30px;font-weight:800;letter-spacing:-.02em}.tkamt small{font-size:14px;color:var(--muted);font-weight:600;margin-left:5px}
.tkmeta{margin-top:10px;font-size:13px;color:var(--muted)}.tkmeta b{color:var(--ink);font-weight:600}
.perf{position:relative;height:2px;border-top:2px dashed var(--line);margin:4px 14px}
.perf::before,.perf::after{content:"";position:absolute;top:-11px;width:20px;height:20px;border-radius:50%;background:var(--bg);border:1.5px solid var(--line)}
.perf::before{left:-25px}.perf::after{right:-25px}
.tkstub{padding:13px 17px 17px;text-align:center}
.qrwrap{display:flex;justify-content:center;margin-bottom:11px}
.qrcard{background:#fff;padding:9px;border:1.5px solid var(--line);border-radius:13px;line-height:0}
.stublbl{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.tkcode{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:30px;letter-spacing:.22em;margin-top:4px}
.tkhint{text-align:center;font-size:11.5px;color:var(--muted);margin:10px 4px 0;line-height:1.45}
.copyrow{display:flex;gap:9px;margin-bottom:10px}.copyrow .btn{flex:1}
.paybox{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 15px;margin-bottom:12px}
.paybox .pt{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--brand);margin-bottom:4px}
.paybox .pt svg{width:15px;height:15px}
.paybox .pr{font-size:12px;color:var(--muted);margin-bottom:11px}.paybox .pr b{color:var(--ink);font-family:'JetBrains Mono',monospace}
.pmgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.pm{display:flex;align-items:center;justify-content:center;gap:7px;border:1.5px solid var(--line);border-radius:10px;padding:11px;font-weight:700;font-size:13px;color:var(--ink);text-decoration:none;cursor:pointer}
.pm:active{background:#F0F5FB}
.pm .pmdot{width:9px;height:9px;border-radius:50%}
.payproto{font-size:11px;color:var(--muted);margin-top:9px;text-align:center}
.verdict{border-radius:16px;padding:24px 20px;text-align:center;color:#fff;animation:pop .3s cubic-bezier(.2,.7,.3,1.2);margin-bottom:14px}
@keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
.verdict.green{background:var(--green)}.verdict.red{background:var(--red)}.verdict.amber{background:#C8841A}
.verdict .vicon{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.17);display:flex;align-items:center;justify-content:center;margin:0 auto 13px}.verdict .vicon svg{width:33px;height:33px}
.verdict h2{font-size:22px;font-weight:800}.verdict p{font-size:13px;opacity:.92;margin-top:7px;line-height:1.45}
.vcard{background:rgba(255,255,255,.13);border-radius:12px;padding:13px 14px;margin-top:15px;text-align:left}
.vcard .ln{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0}.vcard .ln .k{opacity:.85}.vcard .ln .v{font-weight:700;text-align:right}.vcard .amt{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:18px}
.detailcard{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 17px;margin-bottom:14px}
.dtop{display:flex;justify-content:space-between;align-items:center;margin-bottom:11px}
.dcode{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:20px;letter-spacing:.1em}
.payrow{display:flex;gap:10px;margin-top:4px}.payrow .btn{flex:1}
.scanov{position:fixed;inset:0;background:#0A0F1C;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center}
.scanvid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scanframe{position:relative;width:64vw;max-width:280px;aspect-ratio:1;border-radius:22px;box-shadow:0 0 0 100vmax rgba(10,15,28,.64);border:3px solid rgba(255,255,255,.9);z-index:2}
.scanframe::before,.scanframe::after{content:"";position:absolute;width:30px;height:30px;border:4px solid var(--green)}
.scanframe::before{top:-3px;left:-3px;border-right:0;border-bottom:0;border-top-left-radius:22px}
.scanframe::after{bottom:-3px;right:-3px;border-left:0;border-top:0;border-bottom-right-radius:22px}
.scanhint{position:relative;z-index:2;color:#fff;font-size:14px;font-weight:600;margin-top:26px;text-align:center;padding:0 30px}
.scancancel{position:relative;z-index:2;margin-top:22px;width:auto;padding:12px 26px;background:rgba(255,255,255,.14);color:#fff;border:1.5px solid rgba(255,255,255,.3)}
.alert{background:var(--red-bg);border:1px solid #F3C2CC;border-radius:11px;padding:11px 13px;font-size:12.5px;color:#9c2536;display:flex;gap:9px;align-items:center;margin-bottom:13px;line-height:1.4}.alert svg{width:16px;height:16px;flex-shrink:0}
.okline{background:var(--green-bg);border:1px solid #BFE6D6;border-radius:11px;padding:11px 13px;font-size:12.5px;color:var(--green);font-weight:600;display:flex;gap:9px;align-items:center;margin-bottom:13px}.okline svg{width:16px;height:16px}
.simrow{display:flex;justify-content:space-between;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:10px}
.simrow .sl{font-size:13px;color:var(--muted)}.simrow .sv{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:17px}
.simrow .sv.up{color:var(--green)}
.chips{display:flex;gap:8px;margin-bottom:13px}
.chips button{flex:1;border:1.5px solid var(--line);background:var(--card);border-radius:10px;padding:10px;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer;color:var(--muted)}
.chips button.on{border-color:var(--brand);background:#F0F5FB;color:var(--brand)}
.puList{margin:6px 0 14px}
.puItem{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:8px 0;border-bottom:1px solid var(--line)}
.puItem .pname{color:var(--muted)}.puItem .pval{font-family:'JetBrains Mono',monospace;font-weight:600}.puItem .pval b{color:var(--green)}
.entry{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:12px 15px;margin-bottom:10px}
.entry .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.entry .lab{display:flex;align-items:center;gap:9px}
.entry .ec{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:15px}
.entry .en{font-size:13px;color:var(--muted)}
.entry .eamt{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px}
.entry .meta{font-size:11.5px;color:var(--muted);display:flex;justify-content:space-between;gap:10px}
.chip{font-size:10px;font-weight:700;letter-spacing:.04em;padding:2px 8px;border-radius:20px;text-transform:uppercase}
.chip.cash{background:var(--grey-bg);color:var(--grey)}.chip.token{background:#EAF0FB;color:var(--brand)}
.searchbar{position:relative;margin-bottom:14px}
.searchbar svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:var(--muted)}
.searchbar input{width:100%;border:1.5px solid var(--line);background:var(--card);border-radius:11px;padding:12px 13px 12px 38px;font-family:inherit;font-size:14px}
.searchbar input:focus{outline:none;border-color:var(--brand)}
.empty{text-align:center;color:var(--muted);font-size:13px;padding:34px 20px;line-height:1.5}
.resetbtn{display:block;margin:18px auto 0;border:0;background:transparent;color:var(--muted);font-family:inherit;font-size:12px;cursor:pointer;text-decoration:underline}
.guest{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:11px}
.guest .gtop{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px}
.guest .gname{font-weight:700;font-size:15px}
.guest .groom{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:13px;color:var(--brand);background:#EAF0FB;padding:3px 9px;border-radius:20px}
.guest .grow{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);margin-bottom:4px}
.guest .grow b{color:var(--ink);font-weight:600}
.guest .gtot{font-family:'JetBrains Mono',monospace}
.subhead{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:6px 2px 11px}
.bp{border:2px solid #C8D2E2;border-radius:12px;background:#fff;padding:12px;margin-bottom:13px}
.bp-corridors{display:flex;gap:12px;overflow-x:auto}
.bp-group{display:grid;grid-template-columns:1fr 24px 1fr;gap:7px;grid-auto-rows:54px;flex:1;min-width:210px}
.bp-cell{border:1.5px solid var(--line);border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;padding:3px;text-align:center;transition:transform .05s}
.bp-cell:active{transform:scale(.97)}
.bp-cell .bl{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:14px}
.bp-cell .bsd{display:inline-flex;align-items:center}.bp-cell .pd{margin:0}
.bp-cell.left{border-right:3px solid var(--brand)}
.bp-cell.right{border-left:3px solid var(--brand)}
.bp-add{border:1.5px dashed #C2CFE0;border-radius:9px;display:flex;align-items:center;justify-content:center;color:var(--brand);background:#F7F9FC;cursor:pointer}
.bp-add svg{width:18px;height:18px}
.bp-corr{background:repeating-linear-gradient(45deg,#EEF2F8,#EEF2F8 6px,#E3EAF3 6px,#E3EAF3 12px);border-radius:5px;display:flex;align-items:center;justify-content:center;min-width:24px}
.bp-corr span{writing-mode:vertical-rl;text-orientation:mixed;font-size:8.5px;letter-spacing:.25em;color:var(--muted);text-transform:uppercase;font-weight:700}
.bp-foot{display:flex;align-items:center;justify-content:flex-end;gap:9px;margin-top:11px;font-size:12px;color:var(--muted);font-weight:600}
.bp-cseg{display:flex;border:1.5px solid var(--line);border-radius:8px;overflow:hidden}
.bp-cseg button{border:0;background:#fff;padding:6px 13px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;color:var(--muted)}
.bp-cseg button.on{background:var(--brand);color:#fff}
@media (prefers-reduced-motion:reduce){.posys *{animation:none!important;transition:none!important}}
`;

/* ================= App ================= */
export default function App(){
  const [lang,setLang]=useState("sw");
  const [mode,setMode]=useState("rent");
  const [rtab,setRtab]=useState("units");
  const [htab,setHtab]=useState("overview");
  const [db,setDb]=useState(null);
  const [pid,setPid]=useState(null);
  const t=(k)=>STR[lang][k];

  useEffect(()=>{(async()=>{
    let loaded=null; try{const r=await store.get(DB_KEY);if(r&&r.value)loaded=JSON.parse(r.value);}catch{}
    if(!loaded||!loaded.seeded){loaded=seedDb();}
    loaded=normalizeDb(loaded);
    try{await store.set(DB_KEY,JSON.stringify(loaded));}catch{}
    setDb(loaded); setPid(loaded.properties[0]?.id||null);
  })();},[]);
  const save=async(next)=>{setDb(next);try{await store.set(DB_KEY,JSON.stringify(next));}catch{}};
  const resetDemo=async()=>{const fresh=seedDb();await save(fresh);setPid(fresh.properties[0]?.id||null);setMode("rent");setRtab("units");};

  if(!db) return <div className="posys" data-surface="light"><style>{CSS}</style><div className="wrap"><div className="page"><div className="sub">…</div></div></div></div>;

  return(
    <div className="posys" data-surface="light">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="topbar">
          <div className="brandwrap"><div className="mark"><Building2 strokeWidth={2.2} color="#fff"/></div>
            <div><div className="brandname">{t("brand")}</div><div className="brandtag">{t("tagline")}</div></div></div>
          <div className="lang"><button className={lang==="sw"?"on":""} onClick={()=>setLang("sw")}>SW</button><button className={lang==="en"?"on":""} onClick={()=>setLang("en")}>EN</button></div>
        </div>
        <div className="modebar">
          <div className="modeseg">
            <button className={mode==="rent"?"on":""} onClick={()=>setMode("rent")}><Building2 strokeWidth={2.2}/>{t("modeRent")}</button>
            <button className={mode==="hotel"?"on":""} onClick={()=>setMode("hotel")}><Hotel strokeWidth={2.2}/>{t("modeHotel")}</button>
          </div>
        </div>
        {mode==="rent"?(
          <div className="tabs">
            <button className={rtab==="units"?"on":""} onClick={()=>setRtab("units")}><LayoutGrid strokeWidth={2.1}/>{t("tUnits")}</button>
            <button className={rtab==="collect"?"on":""} onClick={()=>setRtab("collect")}><Wallet strokeWidth={2.1}/>{t("tCollect")}</button>
            <button className={rtab==="sim"?"on":""} onClick={()=>setRtab("sim")}><TrendingUp strokeWidth={2.1}/>{t("tSim")}</button>
            <button className={rtab==="book"?"on":""} onClick={()=>setRtab("book")}><BookOpen strokeWidth={2.1}/>{t("tBook")}</button>
          </div>
        ):(
          <div className="tabs">
            <button className={htab==="overview"?"on":""} onClick={()=>setHtab("overview")}><BedDouble strokeWidth={2.1}/>{t("hOverview")}</button>
            <button className={htab==="guests"?"on":""} onClick={()=>setHtab("guests")}><Users strokeWidth={2.1}/>{t("hGuests")}</button>
          </div>
        )}

        {mode==="rent"&&rtab==="units"&&<UnitsView db={db} lang={lang} t={t} save={save} pid={pid} setPid={setPid}/>}
        {mode==="rent"&&rtab==="collect"&&<CollectView db={db} lang={lang} t={t} save={save}/>}
        {mode==="rent"&&rtab==="sim"&&<SimView db={db} lang={lang} t={t} save={save} pid={pid} setPid={setPid}/>}
        {mode==="rent"&&rtab==="book"&&<BookView db={db} lang={lang} t={t} resetDemo={resetDemo}/>}
        {mode==="hotel"&&htab==="overview"&&<HotelOverview db={db} lang={lang} t={t} save={save}/>}
        {mode==="hotel"&&htab==="guests"&&<HotelGuests db={db} lang={lang} t={t} save={save}/>}
      </div>
    </div>
  );
}

/* ================= Property selector ================= */
function PropertyChips({db,pid,setPid,t,onNew}){
  return(
    <div className="propbar">
      {db.properties.map(p=>(<button key={p.id} className={"propchip"+(p.id===pid?" on":"")} onClick={()=>setPid(p.id)}>{p.name}</button>))}
      <button className="propchip add" onClick={onNew}><Plus strokeWidth={2.4}/>{t("newProperty")}</button>
    </div>
  );
}

/* ================= Units / Property ================= */
function UnitsView({db,lang,t,save,pid,setPid}){
  const [view,setView]=useState("board");
  const [selId,setSelId]=useState(null);
  const [floorId,setFloorId]=useState(null);
  const [bview,setBview]=useState("list");
  const [addPreset,setAddPreset]=useState(null);
  const prop=db.properties.find(p=>p.id===pid)||db.properties[0]||null;
  const unit=selId?prop?.units.find(u=>u.id===selId):null;
  const statusLabel=(s)=>({paid:t("paidShort"),due:t("dueShort"),overdue:t("overdueShort"),vacant:t("vacant")}[s]);

  if(view==="newprop") return <NewProperty t={t} onBack={()=>setView("board")} onCreate={async(name,loc)=>{const next=addProperty(db,name,loc);await save(next);setPid(next.properties[next.properties.length-1].id);setView("board");}}/>;

  if(!prop) return (<div className="page"><div className="empty">{t("noProps")}</div><button className="btn primary" onClick={()=>setView("newprop")}><Plus strokeWidth={2.3}/>{t("createFirst")}</button></div>);

  if(view==="addroom") return <AddRoom t={t} lang={lang} floors={prop.floors||[]} currentFloorId={floorId} preset={addPreset} onBack={()=>setView("board")} onSingle={async(u)=>{await save(addUnit(db,prop.id,u));setView("board");}} onBulk={async(params)=>{await save(addUnitsBulk(db,prop.id,params));setView("board");}}/>;
  if(view==="remindall") return <RemindAll prop={prop} db={db} lang={lang} t={t} save={save} onBack={()=>setView("board")}/>;
  if(unit&&view==="pay") return <PayForm unit={unit} lang={lang} t={t} db={db} save={save} onDone={()=>setView("detail")}/>;
  if(unit&&view==="token") return <IssueToken unit={unit} lang={lang} t={t} db={db} save={save} onBack={()=>setView("detail")}/>;
  if(unit&&view==="rent") return <EditRent unit={unit} t={t} db={db} save={save} onBack={()=>setView("detail")}/>;
  if(unit&&view==="remind") return <RemindOne unit={unit} prop={prop} db={db} lang={lang} t={t} save={save} onBack={()=>setView("detail")}/>;

  if(unit){
    const y=new Date().getFullYear();
    const months=MONTHS[lang].map((_,i)=>{const key=`${y}-${pad2(i+1)}`;if(unit.paid[key])return"paid";if(key<curMonth())return"overdue";if(key===curMonth())return new Date().getDate()>GRACE_DAY?"overdue":"due";return"future";});
    const st=unitStatus(unit,curMonth()); const unpaid=st!=="paid"&&st!=="vacant";
    return(
      <div className="page">
        <button className="backbtn" onClick={()=>{setSelId(null);setView("board");}}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
        <div className="dcard">
          <div className="dhead"><div><div className="dlabel">{unit.label}</div><div className="dtype">{TYPE[lang][unit.type]||unit.type}</div></div>
            <span className={"ustat s-"+st}><span className="pd"/>{statusLabel(st)}</span></div>
          {unit.vacant?(<div className="drow"><span className="k">{t("statusVacant")}</span><span className="v amt">{fmtAmt(unit.monthlyRent)} TZS</span></div>):(
            <div className="drows">
              <div className="drow"><span className="k">{t("tenant")}</span><span className="v">{unit.tenantName}</span></div>
              <div className="drow"><span className="k">{t("phone")}</span><span className="v">{unit.tenantPhone}</span></div>
              <div className="drow"><span className="k">{t("rent")}</span><span className="v amt">{fmtAmt(unit.monthlyRent)} / {t("perMonth")}</span></div>
              <div className="drow"><span className="k">{monthName(curMonth(),lang)}</span><span className="v">{statusLabel(st)}</span></div>
            </div>)}
        </div>
        {!unit.vacant&&(<>
          <div className="cyclewrap"><div className="cyclelab">{t("cycle")} · {Object.keys(unit.paid).length} {t("monthsPaid")}</div>
            <div className="cycle">{months.map((s,i)=>(<div className="cyc" key={i}><div className={"cd cd-"+s}/><div className="cm">{MONTHS[lang][i][0]}</div></div>))}</div></div>
          <div className="actcol">
            {unpaid&&<div className="actrow">
              <button className="btn green" onClick={()=>setView("pay")}><Check strokeWidth={2.3}/>{t("recordPay")}</button>
              <button className="btn amber" onClick={()=>setView("remind")}><Bell strokeWidth={2.2}/>{t("sendReminder")}</button>
            </div>}
            <div className="actrow">
              <button className="btn primary" onClick={()=>setView("token")}><KeyRound strokeWidth={2.2}/>{t("issueToken")}</button>
              <button className="btn ghost" onClick={()=>setView("rent")}><Pencil strokeWidth={2.1}/>{t("editRent")}</button>
            </div>
          </div>
        </>)}
        {unit.vacant&&<button className="btn primary" onClick={()=>setView("rent")}><Pencil strokeWidth={2.1}/>{t("editRent")}</button>}
      </div>
    );
  }

  const floors=prop.floors||[];
  const floor=floors.find(f=>f.id===floorId)||floors[0]||null;
  const fid=floor?.id;
  const floorIdSet=new Set(floors.map(f=>f.id));
  const onFirst=!!floor&&floors[0]&&floor.id===floors[0].id;
  const floorUnits=prop.units.filter(u=>u.floorId===fid||(onFirst&&(!u.floorId||!floorIdSet.has(u.floorId))));
  const occ=prop.units.filter(u=>!u.vacant&&u.tenantName);
  const expected=occ.reduce((s,u)=>s+u.monthlyRent,0);
  const collected=occ.reduce((s,u)=>s+(u.paid[curMonth()]?.amount||0),0);
  const paidCount=occ.filter(u=>u.paid[curMonth()]).length;
  const rate=expected?Math.round((collected/expected)*100):0;
  const unpaidCount=occ.length-paidCount;
  const addFloorNext=async()=>{const names=floors.map(x=>x.name);let nm="G";if(names.includes("G")){let i=1;while(names.includes(String(i)))i++;nm=String(i);}const next=addFloor(db,prop.id,nm);await save(next);const nf=next.properties.find(p=>p.id===prop.id).floors;setFloorId(nf[nf.length-1].id);};
  return(
    <div className="page">
      <PropertyChips db={db} pid={prop.id} setPid={setPid} t={t} onNew={()=>setView("newprop")}/>
      <div className="propbar">
        {floors.map(f=>(<button key={f.id} className={"propchip"+(f.id===fid?" on":"")} onClick={()=>setFloorId(f.id)}><Layers strokeWidth={2.2} width={14} height={14}/>{t("floor")} {f.name}</button>))}
        <button className="propchip add" onClick={addFloorNext}><Plus strokeWidth={2.4}/>{t("addFloor")}</button>
      </div>
      <div className="sumcard">
        <div className="sumtop"><span className="lab">{t("collected")}</span><span className="mo">{monthName(curMonth(),lang)}</span></div>
        <div className="sumamt">{fmtAmt(collected)} <small className="of">/ {fmtAmt(expected)} TZS</small></div>
        <div className="bar"><div style={{width:rate+"%"}}/></div>
        <div className="sumfoot"><span><span className="dot" style={{background:"var(--green)"}}/>{rate}% {t("rate")}</span><span><b>{paidCount}</b> {t("paidUnits")}</span><span><b>{unpaidCount}</b> {t("pendingUnits")}</span></div>
      </div>
      {unpaidCount>0&&(<div className="banner"><span className="bi"><Bell strokeWidth={2.2}/></span><span className="bt">{unpaidCount} {t("pendingUnits")}</span><button onClick={()=>setView("remindall")}>{t("remindAll")}</button></div>)}
      <div className="seg" style={{marginBottom:12}}>
        <button className={bview==="list"?"on":""} onClick={()=>setBview("list")}>{t("viewList")}</button>
        <button className={bview==="plan"?"on":""} onClick={()=>setBview("plan")}>{t("viewPlan")}</button>
      </div>
      <button className="addbtn" onClick={()=>{setAddPreset(null);setView("addroom");}}><Plus strokeWidth={2.3}/>{t("addRoom")}</button>
      <div className="gridhead"><LayoutGrid strokeWidth={2.2}/>{floorUnits.length} {t("roomsOnFloor")} · {t("floor")} {floor?.name} · {prop.location}</div>
      {bview==="plan"&&floor?(
        <BlueprintFloor floor={floor} units={floorUnits} lang={lang} t={t} statusLabel={statusLabel}
          onTapRoom={(id)=>{setSelId(id);setView("detail");}}
          onAddAt={(pos)=>{setAddPreset({floorId:fid,corridor:pos.corridor,side:pos.side});setView("addroom");}}
          onSetCorridors={async(nn)=>{await save(setFloorCorridors(db,prop.id,fid,nn));}}/>
      ):(
        floorUnits.length===0?(<div className="empty">{t("addRoom")} →</div>):(
          <div className="ugrid">{floorUnits.map(u=>{const s=unitStatus(u,curMonth());const rem=!u.vacant&&s!=="paid"&&remindedThisMonth(db,u.id);return(
            <button className="utile" key={u.id} onClick={()=>{setSelId(u.id);setView("detail");}}>
              <div className="ut"><span className="ulabel">{u.label}</span><ChevronRight strokeWidth={2.2} width={16} height={16} color="#B6BFCD"/></div>
              <div className="uname">{u.vacant?t("vacant"):u.tenantName}</div>
              <div className="utype">{TYPE[lang][u.type]||u.type}{!u.vacant?` · ${fmtAmt(u.monthlyRent)}`:""}</div>
              <div><span className={"ustat s-"+s}><span className="pd"/>{statusLabel(s)}</span></div>
              {rem&&<div className="remind-badge"><Bell strokeWidth={2.4}/>{t("reminded")}</div>}
            </button>);})}</div>
        )
      )}
    </div>
  );
}

function NewProperty({t,onBack,onCreate}){
  const [name,setName]=useState(""); const [loc,setLoc]=useState("");
  return(<div className="page"><button className="backbtn" onClick={onBack}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
    <div className="eyebrow">{t("newProperty")}</div><div className="h1">{t("newProperty")}</div><div className="sub">&nbsp;</div>
    <div className="field"><label>{t("propName")}</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Kariakoo Plaza"/></div>
    <div className="field"><label>{t("propLocation")}</label><input value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Kariakoo, Dar"/></div>
    <button className="btn primary" disabled={!name.trim()} onClick={()=>name.trim()&&onCreate(name.trim(),loc.trim())}><Plus strokeWidth={2.3}/>{t("create")}</button>
  </div>);
}

function AddRoom({t,lang,floors,currentFloorId,preset,onBack,onSingle,onBulk}){
  const [mode,setMode]=useState("single");
  const validCurrent=floors.some(f=>f.id===currentFloorId)?currentFloorId:null;
  const [floorId,setFloorId]=useState(preset?.floorId||validCurrent||floors[0]?.id||"");
  const [side,setSide]=useState(preset?.side||"left");
  const [corridor,setCorridor]=useState(preset?.corridor||0);
  const [type,setType]=useState("shop"); const [rent,setRent]=useState("");
  const [label,setLabel]=useState(""); const [occupied,setOccupied]=useState(false); const [tn,setTn]=useState(""); const [tp,setTp]=useState("");
  const [prefix,setPrefix]=useState("A"); const [start,setStart]=useState("1"); const [count,setCount]=useState("5");
  const types=["shop","room","office","apartment","storage"];
  const floor=floors.find(f=>f.id===floorId)||floors[0]; const corrCount=floor?.corridors||1;
  const rentN=Number(String(rent).replace(/[^\d.]/g,""));
  const okS=label.trim()&&rentN>0&&(!occupied||tn.trim());
  const startN=parseInt(start||"1",10)||1, countN=Math.max(1,parseInt(count||"1",10)||1);
  const okB=prefix.trim()&&rentN>0&&countN>0;
  const submit=()=>{
    if(mode==="single") onSingle({label:label.trim(),type,monthlyRent:rentN,vacant:!occupied,tenantName:occupied?tn.trim():null,tenantPhone:occupied?tp.trim():null,floorId,corridor,side});
    else onBulk({prefix:prefix.trim(),start:startN,count:countN,type,rent:rentN,floorId,corridor,side});
  };
  return(<div className="page"><button className="backbtn" onClick={onBack}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
    <div className="eyebrow">{t("addRoom")}</div><div className="h1">{t("addRoom")}</div><div className="sub">&nbsp;</div>
    {floors.length>0&&(<><div className="cyclelab" style={{margin:"0 2px 8px"}}>{t("floor")}</div>
      <div className="propbar">{floors.map(f=>(<button key={f.id} className={"propchip"+(f.id===floorId?" on":"")} onClick={()=>setFloorId(f.id)}>{t("floor")} {f.name}</button>))}</div></>)}
    <div className="seg"><button className={mode==="single"?"on":""} onClick={()=>setMode("single")}>{t("single")}</button><button className={mode==="bulk"?"on":""} onClick={()=>setMode("bulk")}>{t("bulk")}</button></div>
    <div className="seg"><button className={side==="left"?"on":""} onClick={()=>setSide("left")}>{t("left")}</button><button className={side==="right"?"on":""} onClick={()=>setSide("right")}>{t("right")}</button></div>
    {corrCount>1&&<div className="seg"><button className={corridor===0?"on":""} onClick={()=>setCorridor(0)}>{t("corridor")} 1</button><button className={corridor===1?"on":""} onClick={()=>setCorridor(1)}>{t("corridor")} 2</button></div>}
    {mode==="single"?(<>
      <div className="row2"><div className="field"><label>{t("roomLabel")}</label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="A1"/></div>
        <div className="field"><label>{t("roomType")}</label><select value={type} onChange={e=>setType(e.target.value)}>{types.map(x=><option key={x} value={x}>{TYPE[lang][x]}</option>)}</select></div></div>
      <div className="field amt"><label>{t("monthlyRent")}</label><input value={rent} onChange={e=>setRent(e.target.value)} inputMode="numeric" placeholder="250,000"/></div>
      <div className="seg"><button className={!occupied?"on":""} onClick={()=>setOccupied(false)}>{t("vacant")}</button><button className={occupied?"on":""} onClick={()=>setOccupied(true)}>{t("tenant")}</button></div>
      {occupied&&<div className="row2"><div className="field"><label>{t("tenantName")}</label><input value={tn} onChange={e=>setTn(e.target.value)} placeholder="Salehe Sigala"/></div>
        <div className="field"><label>{t("phone")}</label><input value={tp} onChange={e=>setTp(e.target.value)} inputMode="tel" placeholder="0712…"/></div></div>}
      <button className="btn primary" disabled={!okS} onClick={submit}><Plus strokeWidth={2.3}/>{t("add")}</button>
    </>):(<>
      <div className="row2"><div className="field"><label>{t("prefix")}</label><input value={prefix} onChange={e=>setPrefix(e.target.value)} placeholder="A"/></div>
        <div className="field"><label>{t("startAt")}</label><input value={start} onChange={e=>setStart(e.target.value.replace(/\D/g,""))} inputMode="numeric"/></div>
        <div className="field"><label>{t("count")}</label><input value={count} onChange={e=>setCount(e.target.value.replace(/\D/g,""))} inputMode="numeric"/></div></div>
      <div className="row2"><div className="field"><label>{t("roomType")}</label><select value={type} onChange={e=>setType(e.target.value)}>{types.map(x=><option key={x} value={x}>{TYPE[lang][x]}</option>)}</select></div>
        <div className="field amt"><label>{t("monthlyRent")}</label><input value={rent} onChange={e=>setRent(e.target.value)} inputMode="numeric" placeholder="250,000"/></div></div>
      <div className="okline" style={{color:"var(--brand)",background:"#EAF0FB",borderColor:"#CFE0F5"}}><Check strokeWidth={2.4}/>{prefix}{startN}–{prefix}{startN+countN-1} · {countN}</div>
      <button className="btn primary" disabled={!okB} onClick={submit}><Plus strokeWidth={2.3}/>{t("add")} ({countN})</button>
    </>)}
  </div>);
}

function RoomCell({u,row,col,side,onTap}){
  const s=unitStatus(u,curMonth());
  return(<button className={`bp-cell ${side} s-${s}`} style={{gridColumn:col,gridRow:row+1}} onClick={()=>onTap(u.id)}>
    <span className="bl">{u.label}</span><span className="bsd"><span className="pd"/></span></button>);
}
function AddCell({row,col,onAdd}){return(<button className="bp-add" style={{gridColumn:col,gridRow:row+1}} onClick={onAdd}><Plus strokeWidth={2.4}/></button>);}
function BlueprintFloor({floor,units,lang,t,statusLabel,onTapRoom,onAddAt,onSetCorridors}){
  const corridors=floor.corridors||1; const groups=[];
  for(let c=0;c<corridors;c++){
    const left=units.filter(u=>(u.corridor||0)===c&&u.side==="left").sort((a,b)=>(a.slot??0)-(b.slot??0));
    const right=units.filter(u=>(u.corridor||0)===c&&u.side==="right").sort((a,b)=>(a.slot??0)-(b.slot??0));
    groups.push({c,left,right,rows:Math.max(left.length,right.length)+1});
  }
  return(<div className="bp">
    <div className="bp-corridors">
      {groups.map(g=>{const cells=[];
        for(let r=0;r<g.rows;r++){
          const lu=g.left[r]; if(lu)cells.push(<RoomCell key={`l${g.c}-${r}`} u={lu} row={r} col={1} side="left" onTap={onTapRoom}/>); else if(r===g.left.length)cells.push(<AddCell key={`la${g.c}-${r}`} row={r} col={1} onAdd={()=>onAddAt({corridor:g.c,side:"left"})}/>);
          const ru=g.right[r]; if(ru)cells.push(<RoomCell key={`r${g.c}-${r}`} u={ru} row={r} col={3} side="right" onTap={onTapRoom}/>); else if(r===g.right.length)cells.push(<AddCell key={`ra${g.c}-${r}`} row={r} col={3} onAdd={()=>onAddAt({corridor:g.c,side:"right"})}/>);
        }
        cells.push(<div key={`corr${g.c}`} className="bp-corr" style={{gridColumn:2,gridRow:`1 / ${g.rows+1}`}}><span>{t("corridor")}</span></div>);
        return(<div className="bp-group" key={g.c}>{cells}</div>);
      })}
    </div>
    <div className="bp-foot"><span>{t("corridors")}</span><div className="bp-cseg"><button className={corridors===1?"on":""} onClick={()=>onSetCorridors(1)}>1</button><button className={corridors===2?"on":""} onClick={()=>onSetCorridors(2)}>2</button></div></div>
  </div>);
}

function PayForm({unit,lang,t,db,save,onDone}){
  const [amount,setAmount]=useState(String(unit.monthlyRent));
  const submit=async()=>{const a=Number(String(amount).replace(/[^\d.]/g,""));if(!(a>0))return;await save(applyPayment(db,unit.id,a,"cash",null));onDone();};
  return(<div className="page"><button className="backbtn" onClick={onDone}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
    <div className="eyebrow">{t("recordPay")}</div><div className="h1">{unit.label} · {unit.tenantName}</div><div className="sub">{monthName(curMonth(),lang)}</div>
    <div className="field amt"><label>{t("amount")}</label><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="numeric"/></div>
    <button className="btn green" onClick={submit}><Check strokeWidth={2.3}/>{t("save")}</button>
  </div>);
}

function EditRent({unit,t,db,save,onBack}){
  const [rent,setRent]=useState(String(unit.monthlyRent));
  const submit=async()=>{const r=Number(String(rent).replace(/[^\d.]/g,""));if(!(r>0))return;await save(setUnitRent(db,unit.id,r));onBack();};
  return(<div className="page"><button className="backbtn" onClick={onBack}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
    <div className="eyebrow">{t("editRent")}</div><div className="h1">{unit.label}</div><div className="sub">&nbsp;</div>
    <div className="field amt"><label>{t("newRent")}</label><input value={rent} onChange={e=>setRent(e.target.value)} inputMode="numeric"/></div>
    <button className="btn primary" onClick={submit}><Check strokeWidth={2.3}/>{t("save")}</button>
  </div>);
}

function reminderMsg(unit,prop,lang){
  return lang==="sw"
    ? `Habari ${unit.tenantName}, kumbusho la kodi ya chumba ${unit.label} (${prop.name}) kwa ${monthName(curMonth(),lang)}: ${fmtAmt(unit.monthlyRent)} TZS. Tafadhali lipa. Asante.`
    : `Hello ${unit.tenantName}, a reminder for rent on unit ${unit.label} (${prop.name}) for ${monthName(curMonth(),lang)}: ${fmtAmt(unit.monthlyRent)} TZS. Please pay. Thank you.`;
}
function RemindOne({unit,prop,db,lang,t,save,onBack}){
  const [copied,setCopied]=useState(false); const [logged,setLogged]=useState(remindedThisMonth(db,unit.id));
  const msg=reminderMsg(unit,prop,lang);
  const mark=async()=>{if(!logged){await save(logReminder(db,unit.id));setLogged(true);}};
  const copy=async()=>{try{await navigator.clipboard.writeText(msg);}catch{}setCopied(true);setTimeout(()=>setCopied(false),1500);mark();};
  const wa=()=>{window.open(`https://wa.me/${waNum(unit.tenantPhone)}?text=${encodeURIComponent(msg)}`,"_blank");mark();};
  const share=async()=>{try{if(navigator.share)await navigator.share({text:msg});else copy();}catch{}mark();};
  return(<div className="page"><button className="backbtn" onClick={onBack}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
    <div className="eyebrow">{t("remindTitle")}</div><div className="h1">{unit.label} · {unit.tenantName}</div><div className="sub">{t("remindSub")}</div>
    {logged&&<div className="okline"><Check strokeWidth={2.4}/>{t("reminded")}</div>}
    <div className="dcard" style={{fontSize:13.5,lineHeight:1.5,color:"var(--ink)"}}>{msg}</div>
    <div className="copyrow"><button className="btn green" onClick={wa}><MessageCircle strokeWidth={2.2}/>{t("whatsapp")}</button>
      <button className="btn ghost" onClick={copy}>{copied?<><Check strokeWidth={2.4}/>{t("copied")}</>:<><Copy strokeWidth={2.1}/>{t("copy")}</>}</button></div>
    <button className="btn ghost" onClick={share}><Share2 strokeWidth={2.1}/>{t("share")}</button>
  </div>);
}
function RemindAll({prop,db,lang,t,save,onBack}){
  const unpaid=prop.units.filter(u=>!u.vacant&&u.tenantName&&unitStatus(u,curMonth())!=="paid");
  const [doneCount,setDoneCount]=useState(0);
  const markAll=async()=>{let next=db;for(const u of unpaid)next=logReminder(next,u.id);await save(next);setDoneCount(unpaid.length);};
  const wa=async(u)=>{window.open(`https://wa.me/${waNum(u.tenantPhone)}?text=${encodeURIComponent(reminderMsg(u,prop,lang))}`,"_blank");await save(logReminder(db,u.id));};
  return(<div className="page"><button className="backbtn" onClick={onBack}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
    <div className="eyebrow">{t("remindAll")}</div><div className="h1">{prop.name}</div><div className="sub">{unpaid.length} {t("pendingUnits")} · {monthName(curMonth(),lang)}</div>
    {doneCount>0&&<div className="okline"><Check strokeWidth={2.4}/>{doneCount} {t("remindedN")}</div>}
    {unpaid.map(u=>(<div className="entry" key={u.id}><div className="top"><div className="lab"><span className="ec">{u.label}</span><span className="en">{u.tenantName}</span></div>
      <button className="btn green" style={{width:"auto",padding:"8px 13px",fontSize:13}} onClick={()=>wa(u)}><MessageCircle strokeWidth={2.2}/>{t("whatsapp")}</button></div>
      <div className="meta"><span>{fmtAmt(u.monthlyRent)} TZS</span><span>{remindedThisMonth(db,u.id)?t("reminded"):""}</span></div></div>))}
    <button className="btn ghost" style={{marginTop:6}} onClick={markAll}><Bell strokeWidth={2.2}/>{t("markAll")}</button>
  </div>);
}

const MM=[{k:"M-Pesa",ussd:"*150*00%23",c:"#E60000"},{k:"Tigo Pesa",ussd:"*150*01%23",c:"#0A3C8C"},{k:"Airtel Money",ussd:"*150*60%23",c:"#E40000"},{k:"HaloPesa",ussd:"*150*88%23",c:"#7A2FA0"}];
function IssueToken({unit,lang,t,db,save,onBack}){
  const [tk,setTk]=useState(null); const [copied,setCopied]=useState(false); const [,setTick]=useState(0);
  useEffect(()=>{if(!tk){let code=genToken();while(db.tokens[code])code=genToken();const token={code,unitId:unit.id,amount:unit.monthlyRent,status:"active",createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+TOKEN_TTL_MIN*60000).toISOString()};save({...db,tokens:{...db.tokens,[code]:token}});setTk(token);}},[]);
  useEffect(()=>{const id=setInterval(()=>setTick(x=>x+1),1000);return()=>clearInterval(id);},[]);
  if(!tk)return <div className="page"><div className="sub">…</div></div>;
  const msLeft=new Date(tk.expiresAt).getTime()-Date.now(); const dead=msLeft<=0;
  const mm=Math.max(0,Math.floor(msLeft/60000)),ss=Math.max(0,Math.floor((msLeft%60000)/1000));
  const qrValue=`POSYS|${tk.code}|${tk.amount}|${unit.label}`;
  const shareText=lang==="sw"?`POSys — Token ya kodi\n${unit.label} · ${unit.tenantName}\nKiasi: ${fmtAmt(tk.amount)} TZS\nToken: ${tk.code}\nInaisha baada ya dakika ${TOKEN_TTL_MIN}.`:`POSys — Rent token\n${unit.label} · ${unit.tenantName}\nAmount: ${fmtAmt(tk.amount)} TZS\nToken: ${tk.code}\nExpires in ${TOKEN_TTL_MIN} min.`;
  const copy=async()=>{try{await navigator.clipboard.writeText(shareText);}catch{}setCopied(true);setTimeout(()=>setCopied(false),1500);};
  const share=async()=>{try{if(navigator.share)await navigator.share({text:shareText});else copy();}catch{}};
  const cancelToken=async()=>{await save({...db,tokens:{...db.tokens,[tk.code]:{...db.tokens[tk.code],status:"cancelled"}}});onBack();};
  return(<div className="page"><button className="backbtn" onClick={onBack}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
    <div className="token"><div className="tktop"><div className="tkhead"><span className="tkbrand"><KeyRound strokeWidth={2.2}/>{t("tokenTitle")}</span>
      <span className={"tktimer"+(dead?" dead":"")}><Clock strokeWidth={2.4}/>{dead?t("expired"):`${pad2(mm)}:${pad2(ss)}`}</span></div>
      <div className="tkamt">{fmtAmt(tk.amount)} <small>TZS</small></div><div className="tkmeta"><b>{unit.label}</b> · {unit.tenantName}</div></div>
      <div className="perf"/>
      <div className="tkstub"><div className="qrwrap"><div className="qrcard"><QRCode value={qrValue} size={142}/></div></div>
        <div className="stublbl">{t("enterCode")}</div><div className="tkcode">{tk.code}</div></div></div>
    <div className="copyrow"><button className="btn ghost" onClick={copy}>{copied?<><Check strokeWidth={2.4}/>{t("copied")}</>:<><Copy strokeWidth={2.1}/>{t("copyCode")}</>}</button>
      <button className="btn primary" onClick={share}><Share2 strokeWidth={2.1}/>{t("share")}</button></div>
    <div className="paybox"><div className="pt"><Smartphone strokeWidth={2.2}/>{t("payByMobile")}</div>
      <div className="pr">{fmtAmt(tk.amount)} TZS · {t("payRef")}: <b>{tk.code}</b></div>
      <div className="pmgrid">{MM.map(m=>(<a key={m.k} className="pm" href={`tel:${m.ussd}`}><span className="pmdot" style={{background:m.c}}/>{m.k}</a>))}</div>
      <div className="payproto">{t("payProto")}</div></div>
    <div className="tkhint">{t("showTenant")}</div>
    <button className="btn ghost" style={{marginTop:12,color:"var(--red)",borderColor:"#F3C2CC"}} onClick={cancelToken}>{t("cancelToken")}</button>
  </div>);
}

/* ================= Collect ================= */
function CollectView({db,lang,t,save}){
  const [code,setCode]=useState(""); const [phase,setPhase]=useState("idle"); const [tk,setTk]=useState(null);
  const [amount,setAmount]=useState(""); const [scanning,setScanning]=useState(false); const [scanErr,setScanErr]=useState("");
  const videoRef=useRef(null),streamRef=useRef(null),rafRef=useRef(null);
  const canScan=typeof window!=="undefined"&&"BarcodeDetector" in window&&navigator.mediaDevices&&typeof navigator.mediaDevices.getUserMedia==="function";
  const reset=()=>{setCode("");setPhase("idle");setTk(null);setAmount("");setScanErr("");};
  const parse=(raw)=>{let s=String(raw||"").trim();if(s.includes("|")){const parts=s.split("|");if((parts[0]||"").toUpperCase()==="POSYS"&&parts[1])return parts[1].replace(/\D/g,"").slice(0,6);}const m=s.match(/\d{6}/);return m?m[0]:s.replace(/\D/g,"").slice(0,6);};
  const find=(raw)=>{const c=parse(raw!=null?raw:code);if(c.length<6)return;const token=db.tokens[c];if(!token){setCode(c);setPhase("notfound");return;}setCode(c);setTk(token);if(token.status==="used"||token.status==="cancelled"){setPhase("used");return;}if(new Date(token.expiresAt).getTime()<=Date.now()){setPhase("expired");return;}setAmount(String(token.amount));setPhase("confirm");};
  const confirm=async()=>{const a=Number(String(amount).replace(/[^\d.]/g,""));if(!(a>0))return;let next=applyPayment(db,tk.unitId,a,"token",tk.code);next={...next,tokens:{...next.tokens,[tk.code]:{...next.tokens[tk.code],status:"used",usedAt:new Date().toISOString(),paidAmount:a}}};await save(next);setPhase("recorded");};
  const stopScan=()=>{if(rafRef.current){cancelAnimationFrame(rafRef.current);rafRef.current=null;}if(streamRef.current){streamRef.current.getTracks().forEach(tr=>tr.stop());streamRef.current=null;}setScanning(false);};
  const startScan=async()=>{setScanErr("");setScanning(true);try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}const detector=new window.BarcodeDetector({formats:["qr_code"]});const tick=async()=>{if(!streamRef.current||!videoRef.current)return;try{const found=await detector.detect(videoRef.current);if(found&&found.length){const raw=found[0].rawValue||"";stopScan();find(raw);return;}}catch{}rafRef.current=requestAnimationFrame(tick);};rafRef.current=requestAnimationFrame(tick);}catch{stopScan();setScanErr(lang==="sw"?"Kamera haipatikani. Andika namba.":"Camera unavailable. Type the code.");}};
  useEffect(()=>()=>stopScan(),[]);
  const unitOf=(token)=>findUnit(db,token.unitId);

  if(phase==="notfound")return <Verdict cls="red" icon={<XCircle strokeWidth={2.2}/>} title={t("notFound")} sub={t("notFoundSub")} btn={t("payAnother")} onBtn={reset}/>;
  if(phase==="used")return <Verdict cls="amber" icon={<AlertTriangle strokeWidth={2.2}/>} title={t("usedTitle")} sub={t("usedSub")} btn={t("payAnother")} onBtn={reset}/>;
  if(phase==="expired")return <Verdict cls="amber" icon={<Clock strokeWidth={2.2}/>} title={t("expiredTitle")} sub={t("expiredSub")} btn={t("payAnother")} onBtn={reset}/>;
  if(phase==="recorded"){const f=unitOf(tk);return(<div className="page"><div className="verdict green"><div className="vicon"><CheckCircle2 strokeWidth={2.2}/></div><h2>{t("recordedTitle")}</h2><p>{t("recordedSub")}</p>
    <div className="vcard"><div className="ln"><span className="k">{t("unit")}</span><span className="v">{f?.unit.label} · {f?.unit.tenantName}</span></div>
      <div className="ln"><span className="k">{monthName(curMonth(),lang)}</span><span className="v amt">{fmtAmt(amount)} TZS</span></div>
      <div className="ln"><span className="k">{t("method")}</span><span className="v">{t("methodToken")} · {tk.code}</span></div></div></div>
    <button className="btn primary" onClick={reset}><RefreshCw strokeWidth={2.2}/>{t("payAnother")}</button></div>);}
  if(phase==="confirm"){const f=unitOf(tk);return(<div className="page"><div className="detailcard"><div className="dtop"><span className="dcode">{tk.code}</span><span className="ustat s-due"><span className="pd"/>{t("statusDue")}</span></div>
    <div className="tkamt" style={{fontSize:26}}>{fmtAmt(tk.amount)} <small>TZS</small></div>
    <div className="drows" style={{marginTop:11}}><div className="drow"><span className="k">{t("unit")}</span><span className="v">{f?.unit.label} · {TYPE[lang][f?.unit.type]||f?.unit.type}</span></div>
      <div className="drow"><span className="k">{t("tenant")}</span><span className="v">{f?.unit.tenantName}</span></div></div></div>
    <div className="eyebrow" style={{marginBottom:10}}>{t("confirmTitle")}</div>
    <div className="field amt"><label>{t("received")}</label><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="numeric"/></div>
    <button className="btn green" onClick={confirm}><CheckCircle2 strokeWidth={2.2}/>{t("confirmPay")}</button>
    <button className="btn ghost" style={{marginTop:10}} onClick={reset}>{t("payAnother")}</button></div>);}

  return(<div className="page"><div className="eyebrow">{t("tCollect")}</div><div className="h1">{t("collectTitle")}</div><div className="sub">{t("collectSub")}</div>
    <div className="field code"><label>{t("enterCode")}</label><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" placeholder="••••••" onKeyDown={e=>e.key==="Enter"&&find()}/></div>
    {scanErr&&<div className="alert"><AlertTriangle strokeWidth={2.2}/><span>{scanErr}</span></div>}
    <div className="payrow"><button className="btn primary" onClick={()=>find()}><Search strokeWidth={2.2}/>{t("find")}</button>
      {canScan&&<button className="btn green" onClick={startScan}><ScanLine strokeWidth={2.2}/>{t("scan")}</button>}</div>
    {scanning&&(<div className="scanov"><video ref={videoRef} playsInline muted className="scanvid"/><div className="scanframe"/><div className="scanhint">{t("scanHint")}</div><button className="btn scancancel" onClick={stopScan}>{t("cancel")}</button></div>)}
  </div>);
}
function Verdict({cls,icon,title,sub,btn,onBtn}){return(<div className="page"><div className={"verdict "+cls}><div className="vicon">{icon}</div><h2>{title}</h2><p>{sub}</p></div><button className="btn primary" onClick={onBtn}><RefreshCw strokeWidth={2.2}/>{btn}</button></div>);}

/* ================= Simulation ================= */
function SimView({db,lang,t,save,pid,setPid}){
  const [pct,setPct]=useState(10); const [applied,setApplied]=useState(false);
  const prop=db.properties.find(p=>p.id===pid)||db.properties[0]||null;
  if(!prop)return <div className="page"><div className="empty">{t("noProps")}</div></div>;
  const occ=prop.units.filter(u=>!u.vacant&&u.tenantName);
  const currentTot=occ.reduce((s,u)=>s+u.monthlyRent,0);
  const projTot=occ.reduce((s,u)=>s+Math.round(u.monthlyRent*(1+pct/100)),0);
  const risk=pct<=10?"low":pct<=20?"moderate":"high";
  const retention=Math.max(0,Math.round(occ.length*(1-(pct/100)*0.4)*10)/10);
  const apply=async()=>{await save(applyRentIncrease(db,prop.id,pct));setApplied(true);setTimeout(()=>setApplied(false),3000);};
  return(<div className="page"><div className="eyebrow">{t("tSim")}</div><div className="h1">{t("simTitle")}</div><div className="sub">{t("simSub")}</div>
    <PropertyChips db={db} pid={prop.id} setPid={setPid} t={t} onNew={()=>{}}/>
    {occ.length===0?(<div className="empty">{t("noOccupied")}</div>):(<>
      <div className="field" style={{marginBottom:9}}><label>{t("increaseBy")}</label></div>
      <div className="chips">{[5,10,15,20].map(v=>(<button key={v} className={pct===v?"on":""} onClick={()=>setPct(v)}>{v}%</button>))}</div>
      <div className="simrow"><span className="sl">{t("currentTot")}</span><span className="sv">{fmtAmt(currentTot)} TZS</span></div>
      <div className="simrow"><span className="sl">{t("projected")} (+{pct}%)</span><span className="sv up">{fmtAmt(projTot)} TZS</span></div>
      <div className="simrow"><span className="sl">{t("change")}</span><span className="sv up">+{fmtAmt(projTot-currentTot)} TZS</span></div>
      <div className="simrow"><span className="sl">{risk==="low"?t("riskLow"):risk==="moderate"?t("riskMod"):t("riskHigh")} · {t("estRetention")}</span><span className="sv">{retention}/{occ.length}</span></div>
      <div className="cyclelab" style={{margin:"14px 2px 8px"}}>{t("perUnit")}</div>
      <div className="puList">{occ.map(u=>{const nu=Math.round(u.monthlyRent*(1+pct/100));return(<div className="puItem" key={u.id}><span className="pname">{u.label} · {u.tenantName}</span><span className="pval">{fmtAmt(u.monthlyRent)} → <b>{fmtAmt(nu)}</b></span></div>);})}</div>
      {applied&&<div className="okline"><Check strokeWidth={2.4}/>{t("appliedMsg")}</div>}
      <button className="btn primary" onClick={apply}><TrendingUp strokeWidth={2.2}/>{t("applyRents")} (+{pct}%)</button>
    </>)}
  </div>);
}

/* ================= Ledger ================= */
function BookView({db,lang,t,resetDemo}){
  const [q,setQ]=useState("");
  const allOcc=db.properties.flatMap(p=>p.units).filter(u=>!u.vacant&&u.tenantName);
  const expected=allOcc.reduce((s,u)=>s+u.monthlyRent,0);
  const collected=allOcc.reduce((s,u)=>s+(u.paid[curMonth()]?.amount||0),0);
  const paidCount=allOcc.filter(u=>u.paid[curMonth()]).length;
  const rate=expected?Math.round((collected/expected)*100):0;
  const ql=q.trim().toLowerCase();
  const payments=[...db.payments].sort((a,b)=>new Date(b.at)-new Date(a.at));
  const list=ql?payments.filter(p=>[p.label,p.tenantName,p.code,p.propertyName].filter(Boolean).some(s=>String(s).toLowerCase().includes(ql))):payments;
  return(<div className="page"><div className="eyebrow">{t("tBook")}</div><div className="h1">{t("bookTitle")}</div><div className="sub">{monthName(curMonth(),lang)}</div>
    <div className="sumcard"><div className="sumtop"><span className="lab">{t("collected")}</span><span className="mo">{monthName(curMonth(),lang)}</span></div>
      <div className="sumamt">{fmtAmt(collected)} <small className="of">/ {fmtAmt(expected)} TZS</small></div>
      <div className="bar"><div style={{width:rate+"%"}}/></div>
      <div className="sumfoot"><span><span className="dot" style={{background:"var(--green)"}}/>{rate}% {t("rate")}</span><span><b>{paidCount}</b> {t("paidUnits")}</span><span><b>{allOcc.length-paidCount}</b> {t("pendingUnits")}</span></div></div>
    <div className="searchbar"><Search strokeWidth={2.2}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={t("searchPh")}/></div>
    {payments.length===0&&<div className="empty">{t("empty")}</div>}
    {payments.length>0&&list.length===0&&<div className="empty">{t("noRes")}</div>}
    {list.map(p=>(<div className="entry" key={p.id}><div className="top"><div className="lab"><span className="ec">{p.label}</span><span className="en">{p.tenantName}</span></div><span className="eamt">{fmtAmt(p.amount)} TZS</span></div>
      <div className="meta"><span>{p.propertyName} · {fmtDateTime(p.at,lang)}</span><span className={"chip "+p.method}>{p.method==="token"?t("methodToken"):t("methodCash")}</span></div></div>))}
    <button className="resetbtn" onClick={resetDemo}>{t("resetDemo")}</button>
  </div>);
}

/* ================= Hotel ================= */
function HotelOverview({db,lang,t,save}){
  const [view,setView]=useState("board");
  const rooms=db.hotel.rooms; const stays=db.hotel.stays;
  const activeOf=(roomId)=>stays.find(s=>s.status==="in"&&s.roomId===roomId);
  const occupiedCount=rooms.filter(r=>activeOf(r.id)).length;
  const occRate=rooms.length?Math.round((occupiedCount/rooms.length)*100):0;
  const revenueIn=stays.filter(s=>s.status==="in").reduce((s,x)=>s+x.nights*x.ratePerNight,0);

  if(view==="addroom")return <AddHotelRoom t={t} lang={lang} onBack={()=>setView("board")} onAdd={async(r)=>{await save(hotelAddRoom(db,r));setView("board");}}/>;
  if(view==="checkin")return <CheckInForm db={db} t={t} lang={lang} onBack={()=>setView("board")} onDone={async(data)=>{await save(hotelCheckIn(db,data));setView("board");}}/>;

  return(<div className="page">
    <div className="sumcard"><div className="sumtop"><span className="lab">{t("occupancy")}</span><span className="mo">{t("occToday")}</span></div>
      <div className="sumamt">{occupiedCount} <small className="of">/ {rooms.length} · {occRate}%</small></div>
      <div className="bar"><div style={{width:occRate+"%"}}/></div>
      <div className="sumfoot"><span><span className="dot" style={{background:"var(--green)"}}/>{stays.filter(s=>s.status==="in").length} {t("currentGuests")}</span><span>{t("revenueIn")} <b>{fmtAmt(revenueIn)}</b></span></div></div>
    <div className="actrow" style={{marginBottom:14}}>
      <button className="btn primary" disabled={rooms.length===0} onClick={()=>setView("checkin")}><LogIn strokeWidth={2.2}/>{t("checkInBtn")}</button>
      <button className="btn ghost" onClick={()=>setView("addroom")}><Plus strokeWidth={2.3}/>{t("addHotelRoom")}</button>
    </div>
    <div className="gridhead"><BedDouble strokeWidth={2.2}/>{rooms.length} {t("hOverview")}</div>
    {rooms.length===0?(<div className="empty">{t("noRooms")}</div>):(
      <div className="ugrid">{rooms.map(r=>{const a=activeOf(r.id);return(<div className="utile" key={r.id} style={{cursor:"default"}}>
        <div className="ut"><span className="ulabel">{r.label}</span></div>
        <div className="uname">{a?a.guestName:t("available")}</div>
        <div className="utype">{HTYPE[lang][r.type]||r.type} · {fmtAmt(r.rate)}</div>
        <div><span className={"ustat "+(a?"s-overdue":"s-paid")}><span className="pd"/>{a?t("occupied"):t("available")}</span></div>
      </div>);})}</div>
    )}
  </div>);
}
function AddHotelRoom({t,lang,onBack,onAdd}){
  const [label,setLabel]=useState(""); const [type,setType]=useState("standard"); const [rate,setRate]=useState("");
  const types=["standard","deluxe","suite"];
  const ok=label.trim()&&Number(String(rate).replace(/[^\d.]/g,""))>0;
  return(<div className="page"><button className="backbtn" onClick={onBack}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
    <div className="eyebrow">{t("addHotelRoom")}</div><div className="h1">{t("addHotelRoom")}</div><div className="sub">&nbsp;</div>
    <div className="row2"><div className="field"><label>{t("room")}</label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="101"/></div>
      <div className="field"><label>{t("hRoomType")}</label><select value={type} onChange={e=>setType(e.target.value)}>{types.map(x=><option key={x} value={x}>{HTYPE[lang][x]}</option>)}</select></div></div>
    <div className="field amt"><label>{t("ratePerNight")}</label><input value={rate} onChange={e=>setRate(e.target.value)} inputMode="numeric" placeholder="40,000"/></div>
    <button className="btn primary" disabled={!ok} onClick={()=>onAdd({label:label.trim(),type,rate:Number(String(rate).replace(/[^\d.]/g,""))})}><Plus strokeWidth={2.3}/>{t("add")}</button>
  </div>);
}
function CheckInForm({db,t,lang,onBack,onDone}){
  const free=db.hotel.rooms.filter(r=>!db.hotel.stays.some(s=>s.status==="in"&&s.roomId===r.id));
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [roomId,setRoomId]=useState(free[0]?.id||"");
  const [nights,setNights]=useState("1"); const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const room=db.hotel.rooms.find(r=>r.id===roomId);
  const [rate,setRate]=useState(String(room?.rate||""));
  useEffect(()=>{const r=db.hotel.rooms.find(x=>x.id===roomId);if(r)setRate(String(r.rate));},[roomId]);
  const n=Math.max(1,parseInt(nights||"1",10)||1); const rt=Number(String(rate).replace(/[^\d.]/g,""))||0;
  const total=n*rt;
  const ok=name.trim()&&roomId&&n>0&&rt>0;
  const submit=()=>onDone({guestName:name.trim(),phone:phone.trim(),roomId,nights:n,rate:rt,checkInDate:date});
  return(<div className="page"><button className="backbtn" onClick={onBack}><ArrowLeft strokeWidth={2.2}/>{t("back")}</button>
    <div className="eyebrow">{t("checkIn")}</div><div className="h1">{t("checkIn")}</div><div className="sub">&nbsp;</div>
    <div className="row2"><div className="field"><label>{t("guestName")}</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Hamisi Juma"/></div>
      <div className="field"><label>{t("phone")}</label><input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" placeholder="0713…"/></div></div>
    <div className="row2"><div className="field"><label>{t("room")}</label><select value={roomId} onChange={e=>setRoomId(e.target.value)}>{free.map(r=><option key={r.id} value={r.id}>{r.label} · {HTYPE[lang][r.type]}</option>)}</select></div>
      <div className="field"><label>{t("nights")}</label><input value={nights} onChange={e=>setNights(e.target.value.replace(/\D/g,""))} inputMode="numeric"/></div></div>
    <div className="row2"><div className="field amt"><label>{t("ratePerNight")}</label><input value={rate} onChange={e=>setRate(e.target.value)} inputMode="numeric"/></div>
      <div className="field"><label>{t("checkInDate")}</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div></div>
    <div className="simrow"><span className="sl">{t("total")} · {n} {t("nightsShort")}</span><span className="sv">{fmtAmt(total)} TZS</span></div>
    <button className="btn green" style={{marginTop:14}} disabled={!ok} onClick={submit}><LogIn strokeWidth={2.2}/>{t("checkInBtn")}</button>
  </div>);
}
function HotelGuests({db,lang,t,save}){
  const current=db.hotel.stays.filter(s=>s.status==="in").sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const past=db.hotel.stays.filter(s=>s.status==="out").sort((a,b)=>new Date(b.checkedOutAt)-new Date(a.checkedOutAt));
  const checkout=async(id)=>{await save(hotelCheckOut(db,id));};
  const Card=({s,active})=>(<div className="guest"><div className="gtop"><div><div className="gname">{s.guestName}</div><div className="grow" style={{marginTop:3}}>{s.phone}</div></div><span className="groom">{s.roomLabel}</span></div>
    <div className="grow"><span>{fmtDay(s.checkIn,lang)} → {fmtDay(s.checkOut,lang)}</span><b>{s.nights} {t("nightsShort")}</b></div>
    <div className="grow"><span>{t("total")}</span><b className="gtot">{fmtAmt(s.nights*s.ratePerNight)} TZS</b></div>
    {active&&<button className="btn ghost" style={{marginTop:10}} onClick={()=>checkout(s.id)}><LogOut strokeWidth={2.2}/>{t("checkOut")}</button>}</div>);
  return(<div className="page"><div className="eyebrow">{t("hGuests")}</div><div className="h1">{t("currentGuests")}</div><div className="sub">{current.length} · {t("occToday")}</div>
    {current.length===0?<div className="empty">{t("noGuests")}</div>:current.map(s=><Card key={s.id} s={s} active/>)}
    {past.length>0&&<><div className="subhead" style={{marginTop:18}}>{t("pastGuests")}</div>{past.map(s=><Card key={s.id} s={s}/>)}</>}
  </div>);
}
