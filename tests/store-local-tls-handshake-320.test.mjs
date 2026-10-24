import test from 'node:test'
import assert from 'node:assert/strict'
import tls from 'node:tls'
import {execFileSync} from 'node:child_process'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

function certificate(dir,name){
 const key=join(dir,name+'.key')
 const crt=join(dir,name+'.crt')
 execFileSync('openssl',[
  'req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1',
  '-keyout',key,'-out',crt,'-subj','/CN=localhost',
  '-addext','subjectAltName=DNS:localhost',
 ],{stdio:'ignore',timeout:15000})
 return {key,crt}
}
function dial(port,ca,servername){
 return new Promise((resolve,reject)=>{
  const socket=tls.connect({
   host:'127.0.0.1',port,servername,ca,rejectUnauthorized:true,
   timeout:3000,
  })
  socket.once('secureConnect',()=>{
   const authorized=socket.authorized
   socket.destroy()
   resolve(authorized)
  })
  socket.once('error',error=>{socket.destroy();reject(error)})
  socket.once('timeout',()=>{socket.destroy();reject(Error('LOCAL_TLS_TIMEOUT'))})
 })
}
test('real loopback TLS handshake: trusted CA accepted, unknown CA and wrong DNS rejected',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'evo-store-tls-320-'))
 let server
 try{
  const trusted=certificate(dir,'trusted')
  const untrusted=certificate(dir,'untrusted')
  const [key,cert,foreign]=await Promise.all([
   readFile(trusted.key),readFile(trusted.crt),readFile(untrusted.crt),
  ])
  server=tls.createServer({key,cert},socket=>socket.end())
  server.on('tlsClientError',()=>{})
  await new Promise((resolve,reject)=>{
   server.once('error',reject)
   server.listen(0,'127.0.0.1',resolve)
  })
  const port=server.address().port
  assert.equal(await dial(port,cert,'localhost'),true)
  await assert.rejects(dial(port,foreign,'localhost'),e=>
   /SELF_SIGNED_CERT_IN_CHAIN|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERTIFICATE_VERIFY_FAILED/.test(e.code||''))
  await assert.rejects(dial(port,cert,'wrong.example'),e=>
   e.code==='ERR_TLS_CERT_ALTNAME_INVALID')
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve))
  await rm(dir,{recursive:true,force:true})
 }
})
