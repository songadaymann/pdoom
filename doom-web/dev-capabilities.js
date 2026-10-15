// Public URLs cannot enable fixtures. The loopback server must opt in as well.
export async function localDevelopmentEnabled({hostname=location.hostname,fetcher=fetch}={}){
  if(!['127.0.0.1','localhost','[::1]'].includes(hostname))return false;
  try{const response=await fetcher('dev-config.json');return response.ok&&(await response.json()).enabled===true;}
  catch{return false;}
}
