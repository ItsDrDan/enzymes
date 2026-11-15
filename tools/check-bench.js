#!/usr/bin/env node
/* Enzyme Bench checks: runs the EBENCH-LOGIC block of index.html in Node and checks every lab
   against course facts written here (optimum near 37 °C; denatured above ~45 °C; pepsin pH 2,
   trypsin pH 8, most enzymes about pH 7; saturation; competitive vs noncompetitive).
   Usage: node tools/check-bench.js [draws] (default 4000) */
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const line=n=>{const m=new RegExp('const '+n+' = [^\\n]*').exec(src);if(!m)throw new Error('missing '+n);return m[0]};
const a=src.indexOf('/*EBENCH-LOGIC-START'),b=src.indexOf('/*EBENCH-LOGIC-END*/');
const ctx={Math,Object,Array,String,JSON,console};vm.createContext(ctx);
vm.runInContext([line('bell'),line('tempCurve'),line('sat')].join('\n')+'\n'+src.slice(a,b)+'\nthis.ebSpec=ebSpec;this.ebActivity=ebActivity;this.EB_ENZ=EB_ENZ;',ctx);
const N=+process.argv[2]||4000;let fails=0,checks=0;const ok=(c,m)=>{checks++;if(!c){fails++;if(fails<30)console.log('FAIL',m)}};
const A=st=>ctx.ebActivity(st),body={T:37,pH:7,opt:7,S:20,inh:null};
/* course facts */
ok(ctx.EB_ENZ.pepsin.opt===2&&ctx.EB_ENZ.trypsin.opt===8,'pepsin pH 2 and trypsin pH 8 (same as the game\'s graph questions)');
let best=0,bestT=0;for(let T=0;T<=70;T+=1){const v=A({...body,T});if(v>best){best=v;bestT=T}}ok(bestT===37&&best>=95,'temperature optimum at 37 °C');
ok(A({...body,T:55})<10&&A({...body,T:60})<5,'denatured above 50 °C');ok(A({...body,T:10})>5&&A({...body,T:10})<50,'cold: slow but not zero');
for(const [e,{opt}] of Object.entries(ctx.EB_ENZ)){let bp=0,bv=0;for(let p=0;p<=14;p++){const v=A({...body,opt,pH:p});if(v>bv){bv=v;bp=p}}ok(bp===opt,e+': optimum pH');}
ok(A({...body,S:20})-A({...body,S:10})<8&&A({...body,S:10})-A({...body,S:1})>20,'saturation curve');
ok(A({...body,S:20,inh:'comp'})>=A({...body,S:20})-12&&A({...body,S:1,inh:'comp'})<A({...body,S:1})-20,'competitive: out-competed by substrate');
ok(A({...body,S:20,inh:'nonc'})<=A({...body,S:20})*.6,'noncompetitive: top rate stays low');
const trend=(x,y)=>Math.abs(y-x)<8?'Activity stays about the same':y>x?'Activity goes up':'Activity goes down';
let fam={};for(let r=0;r<N;r++){const s=ctx.ebSpec();fam[s.fam]=(fam[s.fam]||0)+1;const tag=s.fam+' '+JSON.stringify(s.start)+'→'+s.target;
 ok(s.a0===A(s.start)&&s.a1===A({...s.start,[s.x.key]:s.target}),tag+': readouts');
 ok(s.target>=s.x.min&&s.target<=s.x.max&&(s.target-s.x.min)%s.x.step===0&&s.target!==s.start[s.x.key],tag+': target off the slider or no change');
 if(s.fam==='inh')ok(s.predict.answer===(s.start.inh==='comp'?'back':'low'),tag+': inhibitor prediction');
 else ok(s.predict.answer===trend(s.a0,s.a1),tag+': prediction');
 if(s.fam==='temp'){if(s.target>45)ok(s.explain.answer==='denat'&&s.a1<15,tag+': heat should denature');else if(s.target<s.start.T)ok(s.explain.answer==='slow',tag+': cold should be slow, not denatured');else ok(s.explain.answer==='collide',tag);}
 if(s.fam==='pH')ok(Math.abs(s.target-s.start.opt)>=4&&s.predict.answer==='Activity goes down',tag+': pH far from optimum should lower activity');
 if(s.fam==='sub')ok((s.start.S>=10)===(s.explain.answer==='full'),tag+': saturation explanation');
 ok(s.predict.opts.some(o=>o[0]===s.predict.answer),tag+': prediction key missing');
 ok(s.explain.opts.some(o=>o[0]===s.explain.answer)&&s.explain.opts.filter(o=>o[0]!==s.explain.answer).every(o=>s.explain.why[o[0]]),tag+': explain feedback');
 ok(s.apply.w.length>=2&&!s.apply.w.some(w=>w[0]===s.apply.a)&&s.apply.w.every(w=>w[1]),tag+': apply choices');
 ok(!/Km|Vmax|K<sub>m|NaN|undefined/.test(JSON.stringify(s)),tag+': Km/Vmax (outside the course) or junk text');}

/* ---- free play (EBX block): same model as the labs, plus enzyme amount and inhibitor amount ---- */
{const a2=src.indexOf('/*EBX-LOGIC-START'),b2=src.indexOf('/*EBX-LOGIC-END*/');ok(a2>0&&b2>a2,'free-play logic block present');
 vm.runInContext(src.slice(a2,b2)+'\nthis.ebxRate=ebxRate;this.ebxFree=ebxFree;this.ebxNotes=ebxNotes;this.EBX_GOALS=EBX_GOALS;this.EBX_ENZ=EBX_ENZ;',ctx);
 const R=st=>ctx.ebxRate(st),B={S:20,e:1,inh:null,amt:0,T:37,pH:7,opt:7};
 /* matches the lab model wherever the labs can go (normal enzyme, inhibitor amount 2 = the labs' inhibitor) */
 for(const T of [0,10,20,37,45,55,70])for(const pH of [0,2,7,8,14])for(const opt of [2,7,8])for(const S of [0,1,5,10,20])for(const inh of [null,'comp','nonc']){checks++;
  const lab=A({T,pH,opt,S,inh}),fp=R({T,pH,opt,S,inh,amt:inh?2:0,e:1});if(Math.abs(Math.round(fp)-lab)>0){fails++;if(fails<30)console.log('FAIL free play differs from lab',T,pH,opt,S,inh,fp,lab)}}
 ok(Math.abs(R({...B,e:3})-2*R(B))<1e-9&&Math.abs(R({...B,e:0})-R(B)/2)<1e-9,'enzyme amount scales the rate');
 ok(R({...B,e:3})>=180&&R({...B,e:3})<=200,'double enzyme reaches about 200%');
 for(let amt=1;amt<=4;amt++){ok(R({...B,inh:'comp',amt,S:2})<R({...B,inh:'comp',amt:amt-1,S:2}),'more competitive inhibitor lowers the low-substrate rate');
  ok(R({...B,inh:'nonc',amt})<R({...B,inh:'nonc',amt:amt-1}),'more noncompetitive inhibitor lowers the top rate');
  ok(R({...B,inh:'comp',amt:4})>=0.75*R(B),'substrate out-competes even a lot of competitive inhibitor');}
 ok(R({...B,inh:'nonc',amt:4})<=0.4*R(B),'a lot of noncompetitive inhibitor keeps the top rate low');
 ok(R({...B,inh:'comp',amt:0})===R(B)&&R({...B,inh:'nonc',amt:0})===R(B),'zero inhibitor = no effect');
 /* every goal can be reached, and none is reached at body conditions with low substrate */
 const start={S:5,e:1,inh:null,amt:2,T:37,pH:7,opt:7};
 const wins={double:{...B,e:3},sat:{...B,S:15},beat:{...B,inh:'comp',amt:4},nonc:{...B,inh:'nonc',amt:2},denat:{...B,T:37,dead:true},pepsin:{...B,opt:2,pH:2}};
 for(const [id,,t] of ctx.EBX_GOALS){ok(wins[id]&&t(wins[id]),'goal reachable: '+id);ok(!t(start),'goal not met at the start: '+id);}
 ok(!ctx.EBX_GOALS.find(g=>g[0]==='beat')[2]({...B,inh:'comp',amt:4,S:2}),'beat needs lots of substrate');
 /* notes: say denatured only when hot, slow only when cold, never Km/Vmax; never empty */
 let nn=0;for(const T of [0,15,25,37,44,45,60])for(const pH of [0,2,5,7,8,11,14])for(const opt of [2,7,8])for(const S of [0,3,12,20])for(const inh of [null,'comp','nonc'])for(const amt of [0,2,4])for(const e of [0,1,3]){
  const st={T,pH,opt,S,inh,amt,e},n=ctx.ebxNotes(st).join(' ');nn++;
  if(/denatured/.test(n)!==(T>=45)||/collide less often/.test(n)!==(T<=25)||/Km|Vmax|NaN|undefined/.test(n)||!n){checks++;fails++;if(fails<30)console.log('FAIL notes',JSON.stringify(st),n)}else checks++;
  if(inh&&amt&&S>0){checks++;if(!/inhibitor/.test(n)){fails++;if(fails<30)console.log('FAIL inhibitor note missing',JSON.stringify(st))}}}
 ok(R({...B,dead:true})===0&&R({...B,dead:true,T:37,e:3})===0,'a denatured enzyme stays at 0 after cooling');ok(/Fresh enzyme/.test(ctx.ebxNotes({...B,dead:true}).join('')),'dead note offers a fresh enzyme');ok(vm.runInContext('EBX_DEAD_T',ctx)===45,'denatures at 45 °C, same line the labs use');
 console.log('free play: '+nn+' settings checked');}
console.log(checks+' checks; '+N+' bench questions '+JSON.stringify(fam)+': '+(fails?fails+' FAILED':'all passed'));process.exit(fails?1:0);
