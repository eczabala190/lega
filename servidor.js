// LEGA - servidor local con usuarios. Uso: node servidor.js   (puerto por defecto 8080)
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const PORT=+process.env.PORT||8080,ROOT=__dirname,DATA=path.join(ROOT,'datos'),FILES=path.join(DATA,'archivos'),SF=path.join(DATA,'estado.json');
fs.mkdirSync(FILES,{recursive:true});
let st={rev:0,users:[],legs:[]};try{st=JSON.parse(fs.readFileSync(SF,'utf8'))}catch(e){}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const mk=ch=>{const salt=crypto.randomBytes(16).toString('hex');return{salt,hash:crypto.scryptSync(ch,salt,32).toString('hex')}};
const igual=(u,ch)=>{try{return crypto.timingSafeEqual(Buffer.from(crypto.scryptSync(ch,u.salt,32).toString('hex')),Buffer.from(u.hash))}catch(e){return false}};
const guardar=()=>{const t=SF+'.tmp';fs.writeFileSync(t,JSON.stringify(st));fs.renameSync(t,SF)};
st.users=st.users||[];st.legs=st.legs||[];
st.users.forEach(u=>{if(u.pass&&!u.hash){Object.assign(u,mk(u.pass));delete u.pass}});
if(!st.users.length)st.users.push({user:'admin',nombre:'Administrador',rol:'admin',activo:true,pend:false,...mk(sha('legaadmin'))});
const adminPrincipal=()=>(st.users.find(u=>u.rol==='admin'&&u.activo&&!u.pend)||{user:'admin'}).user;
st.legs.forEach(l=>{if(!l.owner)l.owner=adminPrincipal()});guardar();
const XL=path.join(ROOT,'lib','xlsx.full.min.js');
if(!fs.existsSync(XL)&&typeof fetch==='function')fetch('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(b=>{fs.mkdirSync(path.dirname(XL),{recursive:true});fs.writeFileSync(XL,Buffer.from(b))}).catch(()=>{});
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.apk':'application/vnd.android.package-archive'};
const VIRT=/vethernet|wsl|virtual|vmware|vbox|docker|hyper-v|loopback|tailscale|zerotier|bluetooth|vpn/i;
const ordenarIps=ifs=>{const a=[];for(const [n,l] of Object.entries(ifs||{}))for(const i of l||[])if((i.family==='IPv4'||i.family===4)&&!i.internal)a.push({ip:i.address,v:VIRT.test(n)});
 const rank=x=>(x.v?20:0)+(x.ip.startsWith('192.168.')?0:x.ip.startsWith('10.')?1:x.ip.startsWith('172.')?2:3);return a.sort((p,q)=>rank(p)-rank(q)).map(x=>x.ip)};
const ips=()=>ordenarIps(os.networkInterfaces());
const leer=(req,max)=>new Promise((ok,no)=>{const c=[];let n=0;req.on('data',d=>{n+=d.length;if(n>max){no(new Error('Archivo demasiado grande'));req.destroy()}else c.push(d)});req.on('end',()=>ok(Buffer.concat(c)));req.on('error',no)});
const json=(res,code,o)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const pub=u=>({user:u.user,nombre:u.nombre||'',rol:u.rol,activo:!!u.activo,pend:!!u.pend});
const ses=new Map(),TTL=12*3600e3,fails=new Map();
const limitado=ip=>{const f=fails.get(ip);return !!f&&f.n>=10&&Date.now()-f.t<300e3};
const falla=ip=>{const f=fails.get(ip)||{n:0,t:0};if(Date.now()-f.t>300e3)f.n=0;f.n++;f.t=Date.now();fails.set(ip,f)};
const quien=req=>{let t=(req.headers.authorization||'').replace(/^Bearer /,'');if(!t&&req.method==='GET'){try{const q=new URL(req.url,'http://x');if(/^\/api\/file\//.test(q.pathname))t=q.searchParams.get('token')||''}catch(e){}}const s=ses.get(t);if(!s)return null;if(s.exp<Date.now()){ses.delete(t);return null}return st.users.find(x=>x.user===s.user&&x.activo&&!x.pend)||null};
const esUser=n=>st.users.some(u=>u.user===n&&u.activo&&!u.pend);
const RE_USER=/^[a-z0-9._-]{3,30}$/,RE_HASH=/^[0-9a-f]{64}$/,ROLES=['admin','editor','viewer'];
const FM=id=>path.join(FILES,id+'.meta'),meta=id=>{try{return JSON.parse(fs.readFileSync(FM(id),'utf8'))}catch(e){return null}};
const borrarArch=id=>{[path.join(FILES,id),FM(id)].forEach(x=>{try{fs.unlinkSync(x)}catch(e){}})};
const puedeArch=(id,u)=>{if(u.rol==='admin')return true;const m=meta(id);return !!m&&(m.uploader===u.user||m.para===u.user)};
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization');
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 try{
  const url=new URL(req.url,'http://x'),p=decodeURIComponent(url.pathname),ip=req.socket.remoteAddress,POST=req.method==='POST';
  if(p==='/api/info')return json(res,200,{ips:ips(),port:PORT});
  if(p==='/api/login'&&POST){if(limitado(ip))return json(res,429,{error:'Demasiados intentos. Esperá unos minutos.'});
   const d=JSON.parse((await leer(req,1e5)).toString()),u=st.users.find(x=>x.user===String(d.user||'').toLowerCase());
   if(!u||!igual(u,String(d.pass||''))){falla(ip);return json(res,401,{error:'Usuario o contraseña incorrectos'})}
   if(u.pend)return json(res,403,{error:'Tu cuenta todavía no fue aprobada por el administrador'});if(!u.activo)return json(res,403,{error:'Tu usuario está pausado'});
   const t=crypto.randomBytes(24).toString('hex');ses.set(t,{user:u.user,exp:Date.now()+TTL});return json(res,200,{token:t,me:pub(u)})}
  if(p==='/api/register'&&POST){if(limitado(ip))return json(res,429,{error:'Demasiados intentos. Esperá unos minutos.'});
   const d=JSON.parse((await leer(req,1e5)).toString()),user=String(d.user||'').toLowerCase();
   if(!RE_USER.test(user)||!RE_HASH.test(String(d.pass||'')))return json(res,400,{error:'Datos inválidos'});
   if(st.users.some(x=>x.user===user))return json(res,409,{error:'Ese usuario ya existe, elegí otro'});
   if(st.users.filter(x=>x.pend).length>=100)return json(res,429,{error:'Hay demasiadas solicitudes pendientes'});
   falla(ip);st.users.push({user,nombre:String(d.nombre||'').slice(0,80),rol:'viewer',activo:false,pend:true,...mk(d.pass)});st.rev++;guardar();return json(res,200,{ok:1})}
  if(p.startsWith('/api/')){
   const me=quien(req);if(!me)return json(res,401,{error:'Sesión vencida'});const adm=me.rol==='admin';
   if(p==='/api/logout'&&POST){ses.delete((req.headers.authorization||'').replace(/^Bearer /,''));return json(res,200,{ok:1})}
   if(p==='/api/data'&&req.method==='GET'){const s=url.searchParams.get('since');if(s!==null&&+s===st.rev)return json(res,200,{same:true,rev:st.rev});
    return json(res,200,{rev:st.rev,me:pub(me),legs:adm?st.legs:st.legs.filter(l=>l.owner===me.user),users:adm?st.users.map(pub):[]})}
   if(p==='/api/ops'&&POST){if(me.rol==='viewer')return json(res,403,{error:'Tu usuario es de solo consulta'});
    const d=JSON.parse((await leer(req,25e6)).toString());let ch=0;
    for(const o of (Array.isArray(d.ops)?d.ops:[])){
     if(o.op==='put'&&o.leg&&typeof o.leg==='object'&&/^[\w-]{3,40}$/.test(o.leg.id||'')){const L=o.leg,i=st.legs.findIndex(x=>x.id===L.id),dueño=adm&&esUser(L.owner)?L.owner:null;
      if(i>=0){if(!adm&&st.legs[i].owner!==me.user)continue;L.owner=dueño||st.legs[i].owner;st.legs[i]=L}else{L.owner=dueño||me.user;st.legs.push(L)}ch++}
     else if(o.op==='del'){const i=st.legs.findIndex(x=>x.id===o.id);if(i<0||(!adm&&st.legs[i].owner!==me.user))continue;(st.legs[i].docs||[]).forEach(dc=>{if(dc&&/^[\w-]+$/.test(dc.id||''))borrarArch(dc.id)});st.legs.splice(i,1);ch++}}
    if(ch){st.rev++;guardar()}return json(res,200,{rev:st.rev})}
   if(p==='/api/users'&&POST){if(!adm)return json(res,403,{error:'Solo el administrador puede hacer esto'});
    const d=JSON.parse((await leer(req,1e5)).toString()),user=String(d.user||'').toLowerCase(),u=st.users.find(x=>x.user===user),admins=()=>st.users.filter(x=>x.rol==='admin'&&x.activo&&!x.pend).length,err=(c,m)=>json(res,c,{error:m});
    if(d.op==='create'){if(!RE_USER.test(user)||!RE_HASH.test(String(d.pass||''))||!ROLES.includes(d.rol))return err(400,'Datos inválidos');if(u)return err(409,'Ese usuario ya existe');st.users.push({user,nombre:String(d.nombre||'').slice(0,80),rol:d.rol,activo:true,pend:false,...mk(d.pass)})}
    else if(!u)return err(404,'Usuario no encontrado');
    else if(d.op==='approve'){if(!u.pend)return err(400,'No está pendiente');u.pend=false;u.activo=true;u.rol=ROLES.includes(d.rol)?d.rol:'viewer'}
    else if(d.op==='reject'){if(!u.pend)return err(400,'No está pendiente');st.users=st.users.filter(x=>x!==u)}
    else if(d.op==='pause'){if(u.user===me.user)return err(400,'No podés pausarte a vos mismo');if(u.rol==='admin'&&u.activo&&admins()<=1)return err(400,'Tiene que quedar al menos un administrador activo');u.activo=!u.activo}
    else if(d.op==='delete'){if(u.user===me.user)return err(400,'No podés borrarte a vos mismo');if(u.rol==='admin'&&u.activo&&admins()<=1)return err(400,'Tiene que quedar al menos un administrador activo');st.users=st.users.filter(x=>x!==u)}
    else if(d.op==='pass'){if(!RE_HASH.test(String(d.pass||'')))return err(400,'Datos inválidos');Object.assign(u,mk(d.pass))}
    else return err(400,'Operación desconocida');
    st.rev++;guardar();return json(res,200,{ok:1})}
   const m=p.match(/^\/api\/file\/([\w-]+)$/);
   if(m){const id=m[1],f=path.join(FILES,id);
    if(POST){if(me.rol==='viewer')return json(res,403,{error:'Tu usuario es de solo consulta'});if(fs.existsSync(f)&&!puedeArch(id,me))return json(res,403,{error:'Sin permiso'});
     fs.writeFileSync(f,await leer(req,30e6));fs.writeFileSync(FM(id),JSON.stringify({tipo:req.headers['content-type']||'application/octet-stream',uploader:me.user,para:adm&&esUser(url.searchParams.get('para'))?url.searchParams.get('para'):me.user}));return json(res,200,{ok:1})}
    if(!fs.existsSync(f))return json(res,404,{error:'No encontrado'});if(!puedeArch(id,me))return json(res,403,{error:'Sin permiso'});
    if(req.method==='GET'){let t=(meta(id)||{}).tipo||'application/octet-stream';if(/html|javascript|svg|xml/i.test(t))t='application/octet-stream';res.writeHead(200,{'Content-Type':t,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});return fs.createReadStream(f).pipe(res)}
    if(req.method==='DELETE'){borrarArch(id);return json(res,200,{ok:1})}}
   return json(res,404,{error:'No encontrado'})}
  const fp=path.resolve(ROOT,'.'+(p==='/'?'/index.html':p)),ext=path.extname(fp).toLowerCase(),rel=path.relative(ROOT,fp);
  if(p==='/LEGA.apk'&&!fs.existsSync(fp)){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});return res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;max-width:520px;margin:40px auto;padding:0 20px"><h2>Todavía no está el archivo LEGA.apk</h2><p>El APK de Android hay que generarlo y guardarlo con el nombre <b>LEGA.apk</b> en la misma carpeta que <b>servidor.js</b> (pasos en el README, sección “APK automático”).</p><p>Mientras tanto podés usar LEGA desde el navegador del celular: abrí esta misma dirección y elegí “Agregar a pantalla de inicio”.</p></body>')}
  if(!fp.startsWith(ROOT+path.sep)||fp.startsWith(DATA)||/(^|[\\/])\.|servidor\.js$/i.test(rel)||!MIME[ext]||!fs.existsSync(fp)||!fs.statSync(fp).isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('No encontrado')}
  const h={'Content-Type':MIME[ext],'Cache-Control':'no-cache'};if(ext==='.apk')h['Content-Disposition']='attachment; filename="LEGA.apk"';
  res.writeHead(200,h);fs.createReadStream(fp).pipe(res);
 }catch(e){json(res,500,{error:String(e.message||e)})}
}).listen(PORT,'0.0.0.0',()=>{
 console.log('\n  LEGA está funcionando.\n');
 console.log('  En esta computadora:      http://localhost:'+PORT);
 const l=ips();if(l.length){console.log('  Desde otras PC y celulares (mismo WiFi) - probá primero la de arriba:');l.forEach(a=>console.log('      http://'+a+':'+PORT))}
 console.log('\n  Página para compartir:    http://'+(l[0]||'localhost')+':'+PORT+'/descargar.html');
 console.log('  Administrador inicial: usuario "admin" / contraseña "admin" (cambiala en Usuarios).');
 console.log('  Los datos se guardan en la carpeta "datos". Para cerrar: Ctrl+C.\n');
});
