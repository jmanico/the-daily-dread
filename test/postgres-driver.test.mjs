import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import postgres from 'postgres';

test('pinned PostgreSQL driver rejects incomplete/unsupported authentication before transmitting queries',{timeout:10000},async t=>{
  for(const [expected,frame] of /** @type {[string,number[]][]} */([
    ['AUTHENTICATION_INCOMPLETE',[90,0,0,0,5,73]],
    ['AUTH_TYPE_NOT_IMPLEMENTED',[82,0,0,0,8,0,0,0,99]],
    ['CHANNEL_BINDING_REQUIRED',[82,0,0,0,8,0,0,0,0,90,0,0,0,5,73]],
  ])) {
    await t.test(expected,async()=>{
      /** @type {Set<import('node:net').Socket>} */const sockets=new Set();
      let sent=false,afterStartup=0;
      const server=createServer(socket=>{
        sockets.add(socket);socket.on('error',()=>socket.destroy());socket.on('close',()=>sockets.delete(socket));
        socket.on('data',bytes=>{if(!sent){sent=true;socket.write(Buffer.from(frame));}else afterStartup+=bytes.length;});
      });
      server.listen(0,'127.0.0.1');await once(server,'listening');
      const address=server.address();assert.ok(address && typeof address==='object');
      // A driver-level protocol regression fixture deliberately uses plaintext.
      // The production boundary never permits this configuration.
      const sql=postgres({host:'127.0.0.1',port:address.port,user:'synthetic',database:'synthetic',password:'synthetic-secret',
        ssl:false,channel_binding:'require',max:1,connect_timeout:1,fetch_types:false,onnotice:false});
      try {
        await assert.rejects(sql`select ${'query-secret-must-not-send'}`.raw(),error=>error instanceof Error && Object.getOwnPropertyDescriptor(error,'code')?.value===expected);
        assert.equal(afterStartup,0);
      }finally{await sql.end({timeout:0});for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
    });
  }
});
