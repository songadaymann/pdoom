// READ THIS! shows the token's contract address only to players with a crypto wallet installed;
// everyone else sees nothing about the token (Jonathan, 2026-10-14). Uses a stand-in token
// module, never real token details. Muted Chrome; needs node scripts/serve-doom.mjs on 5198.
import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const url=process.env.DOOM_URL||'http://127.0.0.1:5198/',out='output/read-this-token';await fs.mkdir(out,{recursive:true});
const TEST={name:'TESTCOIN',network:'Solana',contract:'TeSt9aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789pump'};
const browser=await chromium.launch({channel:'chrome',args:['--mute-audio']}),report={cases:[],errors:[]};
async function readThis({wallet=null,token=TEST}={}){
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(url).origin});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.route('**/token-info.js',r=>r.fulfill({contentType:'text/javascript',body:`export const TOKEN=Object.freeze(${JSON.stringify(token)});`}));
 if(wallet==='evm')await page.addInitScript(()=>window.addEventListener('eip6963:requestProvider',()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:Object.freeze({info:{uuid:'qa',name:'MetaMask',icon:'data:,',rdns:'io.metamask'},provider:{request:()=>{throw Error('must not be called');}}})}))));
 if(wallet==='solana')await page.addInitScript(()=>{window.phantom={solana:{isPhantom:true,connect:()=>{throw Error('must not connect');}}};});
 await page.goto(url);await page.click('#title-enter');await page.click('#menu-read');
 await page.waitForSelector('[data-view="read"]:not([hidden])');await page.waitForTimeout(1200);  // wallet check settles in ~0.6 s
 const text=await page.locator('[data-view="read"]').innerText();
 return {page,context,text};
}
try{
 let r=await readThis();
 assert.ok(!/TOKEN|WALLET|CONTRACT|COIN/i.test(r.text),'No wallet: nothing about the token: '+r.text);
 assert.equal(await r.page.locator('#token-copy').count(),0);await r.page.screenshot({path:out+'/no-wallet.png'});await r.context.close();
 report.cases.push('No wallet: READ THIS! says nothing about the token');
 r=await readThis({wallet:'evm'});
 assert.match(r.text,/THE TOKEN: TESTCOIN/);assert.match(r.text,/ON SOLANA/);
 assert.equal(await r.page.locator('#token-address').innerText(),TEST.contract,'address shown exactly, case kept');
 await r.page.screenshot({path:out+'/wallet.png'});
 await r.page.click('#token-copy');await r.page.waitForFunction(()=>document.querySelector('#token-copy').textContent==='COPIED!');
 assert.equal(await r.page.evaluate(()=>navigator.clipboard.readText()),TEST.contract);await r.context.close();
 report.cases.push('Wallet installed (EIP-6963): name, network and exact address shown; COPY puts it on the clipboard');
 r=await readThis({wallet:'solana'});assert.match(r.text,/THE TOKEN/);await r.context.close();
 report.cases.push('A Solana-only wallet (Phantom) counts too');
 r=await readThis({wallet:'evm',token:{name:'',network:'',contract:''}});
 assert.ok(!/TOKEN/i.test(r.text),'No contract configured: nothing shows even with a wallet');await r.context.close();
 report.cases.push('No contract configured yet: nothing shows, even with a wallet');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=String(e);}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases,failure:report.failure}));if(!report.passed)process.exitCode=1;
