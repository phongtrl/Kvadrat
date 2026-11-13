export const SCHEMA_VERSION = 1;
export const NUMERIC_FIELDS = ['area','lat','lng','purchase','debt','resale','renovation','contingency','buyFees','saleFees','monthly','months','equity','interest','stampBase'];
export const STATUSES = ['Vurderes','Kjøpt','Under oppussing','Til salgs','Solgt'];

// Kontantstrømkalkyle før skatt. Fellesgjeld antas overført uendret til kjøper.
export function calculate(p) {
  const stamp = p.ownership === 'selveier' ? p.stampBase * .025 : 0;
  const actual = (p.expenses || []).reduce((s,e) => s + e.amount, 0);
  const renovationBudget = p.renovation * (1 + p.contingency / 100);
  const renovation = Math.max(renovationBudget, actual);
  const holding = p.monthly * p.months;
  const beforeInterest = p.purchase + stamp + p.buyFees + renovation + p.saleFees + holding;
  const loan = Math.max(0, beforeInterest - p.equity);
  const financing = loan * p.interest / 100 * p.months / 12;
  const total = beforeInterest + financing;
  const profit = p.resale - total;
  const roi = total ? profit / total * 100 : 0;
  const equityRoi = p.equity ? profit / p.equity * 100 : 0;
  return {stamp,actual,renovationBudget,renovation,holding,beforeInterest,loan,financing,total,profit,roi,equityRoi,exposure:p.purchase+p.debt};
}

export function median(values) {
  if (!values.length) return null;
  const a = [...values].sort((x,y) => x-y), m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
}

export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  const firstLine = text.split(/\r?\n/,1)[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';
  text = text.replace(/^\uFEFF/,'');
  for (let i=0;i<text.length;i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i+1] === '"') {field += '"';i++;}
      else if (quoted || field === '') quoted = !quoted;
      else throw new Error('Ugyldig anførselstegn i CSV-filen.');
    } else if (c === delimiter && !quoted) {row.push(field.trim());field='';}
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row=[];field='';
    } else field += c;
  }
  if (quoted) throw new Error('Et anførselstegn i CSV-filen er ikke avsluttet.');
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('CSV-filen må inneholde en overskrift og minst ett salg.');
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length) throw new Error('CSV-filen har dupliserte kolonnenavn.');
  return rows.map((r,i) => {
    if (r.length !== headers.length) throw new Error(`Rad ${i+2} har feil antall kolonner.`);
    return Object.fromEntries(headers.map((h,j) => [h,r[j]]));
  });
}

function textField(value,name,max=250) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${name} mangler eller er for lang.`);
  return value.trim();
}
function numberField(value,name,min,max) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean' || !['string','number'].includes(typeof value)) throw new Error(`${name} må være et tall.`);
  const n = Number(typeof value === 'string' ? value.replace(',','.') : value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name} må være mellom ${min} og ${max}.`);
  return n;
}
export function validateSale(s,allowDemo=false) {
  if (!s || typeof s !== 'object') throw new Error('Salget må være et objekt.');
  const date = textField(s.date,'date',10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error('date må være en gyldig dato (ÅÅÅÅ-MM-DD).');
  const today = new Date();const y=today.getFullYear(),m=String(today.getMonth()+1).padStart(2,'0'),d=String(today.getDate()).padStart(2,'0');
  if (date > `${y}-${m}-${d}`) throw new Error('Salgsdato kan ikke ligge i fremtiden.');
  return {id:textField(s.id,'id',100),address:textField(s.address,'address',200),district:textField(s.district,'district',100),date,
    area:numberField(s.area,'area',1,10000),price:numberField(s.price,'price',1,1e9),lat:numberField(s.lat,'lat',63.1,63.6),lng:numberField(s.lng,'lng',9.8,10.8),source:textField(s.source,'source',250),demo:allowDemo && s.demo === true};
}
export function validateSales(rows,allowDemo=false) {
  if (!Array.isArray(rows) || !rows.length || rows.length>5000) throw new Error('Filen må inneholde fra 1 til 5 000 salg.');
  const ids=new Set();
  return rows.map((s,i) => {
    try {
      const sale=validateSale(s,allowDemo);
      if(ids.has(sale.id)) throw new Error('Samme ID forekommer flere ganger i filen.');
      ids.add(sale.id);return sale;
    } catch(e) {throw new Error(`Salg ${i+1}: ${e.message}`);}
  });
}

export function validateProject(p) {
  if (!p || typeof p !== 'object') throw new Error('Ugyldig prosjekt.');
  const clean={id:textField(p.id,'Prosjekt-ID',100),name:textField(p.name,'Prosjektnavn',100),address:textField(p.address,'Adresse',200),notes:typeof p.notes==='string'?p.notes.slice(0,5000):''};
  if (!STATUSES.includes(p.status)) throw new Error('Ugyldig prosjektstatus.');
  if (!['selveier','borettslag'].includes(p.ownership)) throw new Error('Ugyldig eierform.');
  clean.status=p.status;clean.ownership=p.ownership;
  for(const field of NUMERIC_FIELDS) {
    let min=0,max=1e9;
    if (field==='lat'){min=63.1;max=63.6;} else if(field==='lng'){min=9.8;max=10.8;}
    else if(['contingency','interest'].includes(field))max=100;
    else if(field==='months'){min=1;max=120;}
    else if(field==='area'){min=1;max=10000;}
    else if(field==='equity')min=1;
    clean[field]=numberField(p[field],field,min,max);
  }
  if(!Number.isInteger(clean.months))throw new Error('Prosjektlengde må være hele måneder.');
  if(!Array.isArray(p.expenses)||!Array.isArray(p.tasks)||p.expenses.length>1000||p.tasks.length>1000)throw new Error('Ugyldig oppgave- eller kostnadsliste.');
  clean.expenses=p.expenses.map(e=>({id:textField(e.id,'Kostnads-ID',100),description:textField(e.description,'Kostnadsbeskrivelse',150),amount:numberField(e.amount,'Kostnad',1,1e9)}));
  clean.tasks=p.tasks.map(t=>({id:textField(t.id,'Oppgave-ID',100),description:textField(t.description,'Oppgavebeskrivelse',200),done:t.done===true}));
  return clean;
}
export function validateBackup(data) {
  if (!data || data.schemaVersion!==SCHEMA_VERSION || !Array.isArray(data.sales) || !Array.isArray(data.projects) || data.projects.length>1000) throw new Error('Filen er ikke en gyldig Kvadrat-sikkerhetskopi (versjon 1).');
  const sales=data.sales.length?validateSales(data.sales,true):[];
  const projects=data.projects.map(validateProject);
  if(new Set(projects.map(p=>p.id)).size!==projects.length)throw new Error('Sikkerhetskopien har dupliserte prosjekt-ID-er.');
  const result={schemaVersion:SCHEMA_VERSION,sales,projects};
  if(data.listings!==undefined){
    if(!Array.isArray(data.listings)||data.listings.length>5000)throw new Error('Maks 5 000 annonser.');
    result.listings=data.listings.map(validateListing);
    if(new Set(result.listings.map(l=>l.id)).size!==result.listings.length)throw new Error('Dupliserte FINN-koder.');
  }
  return result;
}

export function validateListing(l){
  if(!l||typeof l!=='object')throw new Error('Ugyldig annonse.');
  let url;try{url=new URL(l.url);}catch{throw new Error('Ugyldig FINN-lenke.');}
  if(url.protocol!=='https:'||!['www.finn.no','finn.no'].includes(url.hostname)||url.username||url.password||url.port)throw new Error('Bruk en HTTPS-lenke til FINN.no.');
  const id=url.searchParams.get('finnkode')||(url.pathname.match(/^\/realestate\/homes\/ad\/(\d+)\/?$/)||[])[1];
  if(!id||!/^\d{6,12}$/.test(id)||!/^\/realestate\/homes\/(?:ad\.html|ad\/\d+\/?)$/.test(url.pathname))throw new Error('FINN-lenken må vise en boligannonse med FINN-kode.');
  if(!['annonsert','solgt','ukjent','trukket'].includes(l.status))throw new Error('Ugyldig annonsestatus.');
  if(!['selveier','borettslag'].includes(l.ownership))throw new Error('Ugyldig eierform.');
  const coords=l.lat!==null&&l.lat!==undefined&&l.lng!==null&&l.lng!==undefined;
  const checkedAt=l.checkedAt==null?null:textField(l.checkedAt,'Kontrolldato',10);
  if(checkedAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)||!Number.isFinite(Date.parse(checkedAt))||new Date(checkedAt).toISOString().slice(0,10)!==checkedAt))throw new Error('Ugyldig kontrolldato.');
  return {id,url:`https://www.finn.no/realestate/homes/ad.html?finnkode=${id}`,address:textField(l.address,'Adresse',200),district:textField(l.district,'Område',100),title:textField(l.title,'Tittel',250),area:numberField(l.area,'BRA-i',1,10000),price:numberField(l.price,'Prisantydning',1,1e9),debt:numberField(l.debt,'Fellesgjeld',0,1e9),fees:numberField(l.fees,'Omkostninger',0,1e9),monthly:numberField(l.monthly,'Felleskostnader',0,1e9),ownership:l.ownership,status:l.status,renovation:l.renovation===true,favorite:l.favorite===true,notes:typeof l.notes==='string'?l.notes.slice(0,5000):'',checkedAt,lat:coords?numberField(l.lat,'Breddegrad',63.1,63.6):null,lng:coords?numberField(l.lng,'Lengdegrad',9.8,10.8):null};
}

export function csvExport(rows) {
  const headers=['id','address','district','date','area','price','lat','lng','source','demo'];
  // Beskytt tekstceller mot at regneark tolker importert innhold som formler.
  const cell=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return '\uFEFF'+[headers.join(';'),...rows.map(r=>headers.map(h=>cell(r[h])).join(';'))].join('\r\n');
}
