// Is a crypto wallet extension installed in this browser? (2026-10-14) On mann.cool the shared
// shell answers (window.mannCool.wallets); elsewhere (playtest, local) the same listen-only
// check runs here: wallets announcing themselves (EIP-6963, Wallet Standard) or the older
// injected globals. Neither ever asks to connect or reads an address.
let pending=null;
const none=Object.freeze({hasWallet:false,evm:false,solana:false,names:[]});

export function detectWallet({timeout=600}={}){
  pending??=Promise.resolve(window.mannCool?.wallets?.detect?.()??listen(timeout)).catch(()=>none);
  return pending;
}

async function listen(timeout){
  const evm=new Map(),others=[];
  const announce=e=>{const info=e.detail?.info;if(info?.name)evm.set(String(info.rdns||info.name),String(info.name));};
  const register=(...wallets)=>{others.push(...wallets);return()=>{};};
  const registered=e=>{try{e.detail?.({register});}catch{}};
  window.addEventListener('eip6963:announceProvider',announce);window.addEventListener('wallet-standard:register-wallet',registered);
  try{window.dispatchEvent(new Event('eip6963:requestProvider'));window.dispatchEvent(new CustomEvent('wallet-standard:app-ready',{detail:{register}}));}catch{}
  await new Promise(resolve=>setTimeout(resolve,timeout));
  window.removeEventListener('eip6963:announceProvider',announce);window.removeEventListener('wallet-standard:register-wallet',registered);
  try{if(!evm.size&&window.ethereum)evm.set('injected','Ethereum wallet');}catch{}
  let solana=others.some(w=>Array.isArray(w?.chains)&&w.chains.some(c=>String(c).startsWith('solana:')));
  try{solana||=Boolean(window.phantom?.solana||window.solflare||window.backpack||window.solana);}catch{}
  const names=[...new Set([...evm.values(),...others.map(w=>String(w?.name||'')).filter(Boolean)])].slice(0,8);
  return {hasWallet:evm.size>0||solana||names.length>0,evm:evm.size>0,solana,names};
}
