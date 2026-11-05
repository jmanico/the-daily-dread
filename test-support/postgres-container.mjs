import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,readFile,rm,chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const exec=promisify(execFile);
export const postgresImage='postgres:18.6-bookworm@sha256:f1ea2a1a4fb7b68d4836be1fdcb8a6466a89b072158bf9d97663600538c294c5';

/** Isolated synthetic database only. No production credentials, host mounts other
 * than the generated certificate directory, or persistent data volume. */
export async function startPostgres(wrongHostname=false) {
  const directory=await mkdtemp(join(tmpdir(),'dread-pg18-'));
  const name='dread-pg18-'+randomUUID();
  const key=join(directory,'key.pem'),cert=join(directory,'cert.pem');
  const password='synthetic-db-fixture-not-production';
  let created=false;
  async function close(){
    try{if(created)await exec('docker',['rm','--force',name],{timeout:10000});}
    finally{await rm(directory,{recursive:true,force:true});}
  }
  try {
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-subj','/CN=localhost','-addext',wrongHostname?'subjectAltName=DNS:wrong.example.invalid':'subjectAltName=DNS:localhost,IP:127.0.0.1','-days','1'],{stdio:'ignore',timeout:10000});
    await chmod(key,0o600);
    // Fixed shell text in a disposable fixture; no supplied data is interpolated.
    await exec('docker',['create','--name',name,'--memory','256m','--cpus','1','--pids-limit','128','--read-only',
      '--security-opt','no-new-privileges','--tmpfs','/tmp:rw,nosuid,nodev,size=16m',
      '--tmpfs','/var/run/postgresql:rw,nosuid,nodev,size=8m',
      '--tmpfs','/var/lib/postgresql:rw,nosuid,nodev,size=128m',
      '--mount',`type=bind,source=${directory},target=/fixture-tls,readonly`,
      '-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD='+password,'-e','POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256',
      '--entrypoint','bash',postgresImage,'-ceu',
      'cp /fixture-tls/key.pem /tmp/server-key; cp /fixture-tls/cert.pem /tmp/server-cert; chown postgres:postgres /tmp/server-key /tmp/server-cert; chmod 600 /tmp/server-key; exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server-cert -c ssl_key_file=/tmp/server-key -c max_connections=10 -c shared_buffers=16MB -c deadlock_timeout=50ms -c log_min_messages=panic -c log_min_error_statement=panic'],{timeout:30000,maxBuffer:65536});
    created=true;
    await exec('docker',['start',name],{timeout:10000});
    let ready=false;
    for(let i=0;i<100;i++) {
      const check=await exec('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres','-d','postgres'],{timeout:2000}).then(()=>true,()=>false);
      if(check){ready=true;break;}await delay(100);
    }
    if(!ready)throw new Error('Fixture PostgreSQL did not start');
    const {stdout}=await exec('docker',['port',name,'5432/tcp'],{timeout:5000});
    if(!/^127\.0\.0\.1:\d+\s*$/.test(stdout))throw new Error('Unexpected database fixture binding');
    const port=Number(stdout.trim().split(':')[1]);
    return {close,name,config:{host:'127.0.0.1',port,database:'postgres',user:'postgres',password,ca:await readFile(cert,'utf8')}};
  }catch(error){await close();throw error;}
}
