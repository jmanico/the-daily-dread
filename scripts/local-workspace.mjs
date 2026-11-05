import { userInfo } from 'node:os';
import { prepareWorkspace } from '../src/local/workspace.js';

// Trusted setup composition: no path/profile/identity override and no service start.
try {
  const argument=process.argv[2];
  if(process.argv.length!==3 || !['init','check'].includes(argument) || process.platform!=='darwin' || process.version!=='v26.13.0')throw Error('Unavailable');
  const {homedir,uid}=userInfo();
  const result=await prepareWorkspace({home:homedir,uid},argument==='init',new AbortController().signal);
  if(result.kind!=='ready'){console.error(`Local workspace ${result.kind}. Private application remains inactive.`);process.exitCode=1;}
  else console.log('Local workspace prepared. Private application remains inactive; authentication, storage and recovery acceptance are still required.');
}catch{
  console.error('Local workspace unavailable. Use the selected macOS runtime and exactly init or check.');process.exitCode=1;
}
