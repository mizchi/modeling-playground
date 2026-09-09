/**
 * @typedef {{kind:'tone'|'noise',start:number,duration:number,attack:number,
 * decay:number,gain:number,pan:number,frequency?:number,endFrequency?:number,
 * glide?:number,partials?:number[],low?:number,high?:number,endHigh?:number,
 * filterDecay?:number,modulation?:number}} SfxLayer
 * @typedef {{id:string,name:string,description:string,duration:number,peak:number,
 * layers:SfxLayer[],reflections:{delay:number,gain:number}[]}} SfxPreset
 */
export const SFX_SAMPLE_RATE=48000;
const TAU=2*Math.PI;

/** Forward-only delay: one-shot tails must never wrap into the attack. */
export function addOneShotReflections(channels,reflections,rate) {
  const dry=channels.map(channel=>channel.slice());
  for(const {delay,gain} of reflections) {
    const offset=Math.round(delay*rate);
    for(let c=0;c<2;c++) for(let i=0;i+offset<channels[c].length;i++) channels[c][i+offset]+=dry[1-c][i]*gain;
  }
}

function renderLayer(layer,rate,seed) {
  const frames=Math.round(layer.duration*rate), out=new Float32Array(frames);
  let phase=0,lower=0,upper=0,random=seed;
  const partials=layer.partials??[1];
  const lowCoefficient=1-Math.exp(-TAU*(layer.low??20)/rate);
  for(let i=0;i<frames;i++) {
    const t=i/rate;
    const envelope=Math.min(1,t/layer.attack)*Math.exp(-Math.max(0,t-layer.attack)/layer.decay)*
      Math.min(1,(frames-1-i)/Math.max(1,Math.round(.012*rate)));
    let value=0;
    if(layer.kind==='tone') {
      const frequency=layer.endFrequency+(layer.frequency-layer.endFrequency)*Math.exp(-t/layer.glide);
      phase+=TAU*frequency/rate;
      for(let h=0;h<partials.length;h++) if(frequency*(h+1)<rate*.45) value+=partials[h]*Math.sin(phase*(h+1));
    } else if(layer.kind==='noise') {
      random^=random<<13; random^=random>>>17; random^=random<<5;
      const white=(random>>>0)/2147483648-1;
      const cutoff=layer.endHigh===undefined?layer.high:
        layer.endHigh+(layer.high-layer.endHigh)*Math.exp(-t/layer.filterDecay);
      const highCoefficient=1-Math.exp(-TAU*Math.min(cutoff,rate*.45)/rate);
      upper+=highCoefficient*(white-upper);
      lower+=lowCoefficient*(white-lower);
      value=upper-lower;
      if(layer.modulation) value*=.82+.18*Math.sin(TAU*layer.modulation*t);
    } else throw Error(`Unknown layer kind: ${layer.kind}`);
    out[i]=value*envelope*layer.gain;
  }
  return out;
}

/** @param {SfxPreset} preset */
export function renderSfx(preset,rate=SFX_SAMPLE_RATE) {
  if(!Number.isFinite(rate) || rate<22050 || !Number.isFinite(preset.duration) || preset.duration<=0 ||
    !Number.isFinite(preset.peak) || preset.peak<=0 || preset.peak>=1) throw Error('Invalid SFX format');
  const frames=Math.round(preset.duration*rate);
  const channels=[new Float32Array(frames),new Float32Array(frames)];
  preset.layers.forEach((layer,index)=>{
    const signal=renderLayer(layer,rate,(0x71ac948d^Math.imul(index+1,0x9e3779b9))>>>0);
    const offset=Math.round(layer.start*rate);
    const gains=[Math.cos((layer.pan+1)*Math.PI/4),Math.sin((layer.pan+1)*Math.PI/4)];
    for(let c=0;c<2;c++) for(let i=0;i<signal.length && i+offset<frames;i++) channels[c][i+offset]+=signal[i]*gains[c];
  });
  addOneShotReflections(channels,preset.reflections,rate);
  let peak=0;
  for(const channel of channels) {
    let previous=0,dc=0;
    for(let i=0;i<frames;i++) {
      const input=channel[i];
      dc=input-previous+Math.exp(-TAU*20/rate)*dc; previous=input;
      const fade=Math.min(1,(frames-1-i)/(.025*rate));
      channel[i]=Math.tanh(dc*1.15)*fade;
      peak=Math.max(peak,Math.abs(channel[i]));
    }
  }
  if(peak<1e-8) throw Error(`Silent effect: ${preset.id}`);
  for(const channel of channels) for(let i=0;i<frames;i++) channel[i]*=preset.peak/peak;
  return channels;
}
