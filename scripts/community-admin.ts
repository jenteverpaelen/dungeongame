// Local owner CLI. No player-name privilege and no additional network endpoint.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DATA_DIR} from '../server/src/config';
const directory=path.join(DATA_DIR,'social'),[action,...args]=process.argv.slice(2);
if(action==='list'){
  const state=JSON.parse(await fs.readFile(path.join(directory,'ledger.json'),'utf8'));const page=Math.max(0,Number(args[0])||0);console.log(JSON.stringify({reports:state.reports.slice(page*8,page*8+8),page,total:state.reports.length,sanctions:state.sanctions,filter:state.filter},null,2));
}else if(action==='audit'){
  const state=JSON.parse(await fs.readFile(path.join(directory,'ledger.json'),'utf8'));const page=Math.max(0,Number(args[0])||0);console.log(JSON.stringify(state.audit.slice(page*8,page*8+8),null,2));
}else if(['mute','ban','unmute','unban','resolve','filter'].includes(action)){
  const request=action==='filter'?{action,...JSON.parse(await fs.readFile(args[0],'utf8'))}:{action,target:args[0],...(['mute','ban'].includes(action)?{minutes:Number(args[1]),reason:args.slice(2).join(' ')}:{reason:args.slice(1).join(' ')})};
  if(!request.reason)throw Error('An explicit owner reason is required');
  const inbox=path.join(directory,'owner-inbox');await fs.mkdir(inbox,{recursive:true});const id=randomUUID(),file=path.join(inbox,id+'.json'),tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(request),{flush:true});await fs.rename(tmp,file);
  console.log(`Queued owner operation ${id}. Running server processes it; inspect ${file}.result for the outcome.`);
}else console.log('Usage: node --import tsx scripts/community-admin.ts list [page] | audit [page] | mute|ban NAME MINUTES REASON | unmute|unban NAME REASON | resolve REPORT_ID REASON | filter SETTINGS_JSON\nUse the same DATA_DIR as the server. Minutes0 means permanent; no automatic sanctions. Filter file: {"phrases":[],"links":true,"reason":"..."}.');
