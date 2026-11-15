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
console.log(checks+' checks; '+N+' bench questions '+JSON.stringify(fam)+': '+(fails?fails+' FAILED':'all passed'));process.exit(fails?1:0);
