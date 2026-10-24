import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import tls from 'node:tls'
import pg from 'pg'
import {execFileSync} from 'node:child_process'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const makeCert=(dir,name)=>{
 const key=join(dir,name+'.key'),crt=join(dir,name+'.crt')
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-sha256',
  '-days','1','-keyout',key,'-out',crt,'-subj','/CN=localhost',
  '-addext','subjectAltName=DNS:localhost'],{stdio:'ignore',timeout:15000})
 return {key,crt}
}
async function startPgSslWire(key,cert){
 const sockets=new Set()
 let upgrades=0
 const secureContext=tls.createSecureContext({key,cert})
 const server=net.createServer(socket=>{
  sockets.add(socket)
  socket.once('close',()=>sockets.delete(socket))
  socket.once('data',header=>{
   if(header.length!==8 || header.readInt32BE(0)!==8 ||
     header.readInt32BE(4)!==80877103){socket.destroy();return}
   socket.write('S',()=>{
    const encrypted=new tls.TLSSocket(socket,{isServer:true,secureContext})
    encrypted.on('error',()=>{})
    encrypted.on('secure',()=>{upgrades++;encrypted.end()})
   })
  })
 })
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
 return {port:server.address().port,get upgrades(){return upgrades},close:async()=>{
  for(const socket of sockets)socket.destroy()
  await new Promise(resolve=>server.close(resolve))
 }}
}
async function attempt(port,ca,host){
 const client=new pg.Client({
  host:'127.0.0.1',port,user:'evo_store_role_reader_login',
  password:'disposable-local-only',database:'postgres',
  ssl:{rejectUnauthorized:true,ca,servername:host},
  connectionTimeoutMillis:3000,
 })
 try{await client.connect();return {error:null}}
 catch(error){return {error}}
 finally{try{await client.end()}catch{}}
}
test('node-postgres SSLRequest verifies local TLS CA and hostname',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'evo-pg-wire-321-'))
 let wire
 try{
  const own=makeCert(dir,'own'),foreign=makeCert(dir,'foreign')
  const [key,crt,untrusted]=await Promise.all([
   readFile(own.key),readFile(own.crt),readFile(foreign.crt)])
  wire=await startPgSslWire(key,crt)
  const good=await attempt(wire.port,crt,'localhost')
  // TLS succeeded; fake server deliberately never sends PostgreSQL Authentication.
  assert.ok(good.error)
  assert.ok(!/CERT_|SELF_SIGNED|ALTNAME|VERIFY/i.test(good.error.code||''))
  assert.ok(wire.upgrades>=1,'trusted pg client must complete TLS handshake')
  const wrongCa=await attempt(wire.port,untrusted,'localhost')
  assert.ok(/SELF_SIGNED_CERT_IN_CHAIN|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE/.test(wrongCa.error?.code||''))
  const wrongHost=await attempt(wire.port,crt,'incorrect.example')
  assert.equal(wrongHost.error?.code,'ERR_TLS_CERT_ALTNAME_INVALID')
 }finally{
  if(wire)await wire.close()
  await rm(dir,{recursive:true,force:true})
 }
})
