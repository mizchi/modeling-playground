import { SAMPLE_RATE } from './audio.mjs';

export function renderBattleVoice(note,voice,rate=SAMPLE_RATE) {
  const release=voice==='counter'?.035:voice==='drums'?.018:.014;
  const out=new Float32Array(Math.ceil((note.duration+release)*rate));
  const frequency=440*2**((note.pitch-69)/12), tau=2*Math.PI;
  let random=0x12345678 ^ note.pitch, previousNoise=0, lowNoise=0;
  for(let i=0;i<out.length;i++) {
    const t=i/rate;
    const env=Math.min(1,t/(voice==='drums'?.0015:.003))*Math.max(0,Math.min(1,(note.duration+release-t)/release));
    let value=0;
    if(voice==='drums') {
      random^=random<<13; random^=random>>>17; random^=random<<5;
      const noise=(random>>>0)/2147483648-1;
      const high=(noise-previousNoise)*.5; previousNoise=noise;
      lowNoise+=.20*(noise-lowNoise);
      if(note.pitch===36) {
        const phase=48*t+125*.018*(1-Math.exp(-t/.018));
        value=Math.sin(tau*phase)*Math.exp(-t*23)+high*.16*Math.exp(-t*140);
      } else if(note.pitch===38) value=(high*.85+lowNoise*.65)*Math.exp(-t*27)+Math.sin(tau*178*t)*.35*Math.exp(-t*40);
      else if(note.pitch===49) value=high*.58*Math.exp(-t*9);
      else if(note.pitch===45) value=Math.sin(tau*(92*t+55*.025*(1-Math.exp(-t/.025))))*.8*Math.exp(-t*23);
      else value=high*.60*Math.exp(-t*75);
    } else {
      const vtime=Math.max(0,t-.12);
      const phase=frequency*t+(voice==='pulse'?frequency*.003/(tau*5.6)*(1-Math.cos(tau*5.6*vtime)):0);
      if(voice==='triangle') {
        for(let h=1;h<=15 && h*frequency<rate*.45;h+=2) value+=Math.sin(tau*h*phase)*((h%4===1?1:-1)/(h*h));
        value*=.82*(.78+.22*Math.exp(-t*18));
      } else {
        const duty=voice==='pulse'?.25:voice==='counter'?.5:.125;
        for(let h=1;h<=18 && h*frequency<rate*.45;h++) value+=Math.sin(Math.PI*h*duty)/h*Math.cos(tau*h*phase-Math.PI*h*duty);
        value*=.65*(voice==='arp'?Math.exp(-t*22):.76+.24*Math.exp(-t*35));
      }
    }
    out[i]=value*env*note.velocity/127;
  }
  return out;
}
