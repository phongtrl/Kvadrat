import {parseFinnUrl} from '../core.js';
function listingText(value){return String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();}
function listingNumber(value){const match=String(value||'').match(/\d[\d\s\u00a0]*(?:[,.]\d+)?/);if(!match)return null;const number=Number(match[0].replace(/[\s\u00a0]/g,'').replace(',','.'));return Number.isFinite(number)?number:null;}
export function parseListingPage(html,url){
 const normalized=parseFinnUrl(url),fields={url:normalized.url,status:'ukjent',checkedAt:new Date().toISOString().slice(0,10)},pairs=new Map();
 for(const m of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi))pairs.set(listingText(m[1]).toLocaleLowerCase('nb'),listingText(m[2]));
 const aliases={price:['prisantydning'],area:['internt bruksareal','bra-i'],debt:['fellesgjeld','andel fellesgjeld'],fees:['omkostninger'],monthly:['felleskost/mnd.','felleskostnader pr. mnd.','felleskostnader/mnd.']};
 for(const [key,labels]of Object.entries(aliases))for(const label of labels)if(pairs.has(label)){const value=listingNumber(pairs.get(label));if(value!==null)fields[key]=value;break;}
 const ownership=pairs.get('eierform')||pairs.get('eieform')||'';if(/selveier|eierseksjon/i.test(ownership))fields.ownership='selveier';else if(/andel|borettslag|aksje/i.test(ownership))fields.ownership='borettslag';
 function inspect(value){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(inspect);return;}
  const type=[value['@type']].flat();if(type.some(t=>['Apartment','House','Residence','SingleFamilyResidence','RealEstateListing','Product'].includes(t))){
   if(value.name&&!fields.title)fields.title=listingText(value.name).slice(0,250);
   const address=value.address;if(address&&typeof address==='object'){if(address.streetAddress)fields.address=listingText(address.streetAddress).slice(0,200);if(address.addressLocality)fields.district=listingText(address.addressLocality).slice(0,100);}
   // Only explicit BRA-i is accepted; generic floorSize may be BRA/P-ROM.
   const geo=value.geo;if(geo){const lat=Number(geo.latitude),lng=Number(geo.longitude);if(lat>=63.1&&lat<=63.6&&lng>=9.8&&lng<=10.8){fields.lat=lat;fields.lng=lng;}}
  }
  for(const [key,child]of Object.entries(value))if(child&&typeof child==='object'&&key!=='address'&&key!=='geo')inspect(child);
 }
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{inspect(JSON.parse(m[1]));}catch{}}
 const required=['title','address','district','area','price','debt','fees','monthly','ownership'],missing=required.filter(key=>fields[key]===undefined||fields[key]==='');
 return {fields,missing,complete:!missing.length,source:normalized.url};
}
