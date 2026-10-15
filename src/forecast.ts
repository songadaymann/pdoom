import {estimate,type State} from './sim';
self.onmessage=(e:MessageEvent<{snapshot:State;id:number}>)=>{
 const start=performance.now(),result=estimate(e.data.snapshot),z=1.96,n=result.samples,p=result.p;
 const den=1+z*z/n,center=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
 const interval95=result.terminal?[p,p]:[Math.max(0,center-half),Math.min(1,center+half)];
 self.postMessage({...result,interval95,id:e.data.id,time:e.data.snapshot.time,ms:performance.now()-start});
};
