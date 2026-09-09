import bgmUrl from '../assets/audio/battle.wav?url';
import confirmUrl from '../assets/audio/confirm.wav?url';
import cancelUrl from '../assets/audio/cancel.wav?url';
import explosionUrl from '../assets/audio/explosion.wav?url';
import swordUrl from '../assets/audio/sword.wav?url';
import bluntUrl from '../assets/audio/blunt.wav?url';
import type { ActionDocument, GameEvent, SoundId } from './contracts.ts';

const urls={'bgm.battle':bgmUrl,'sfx.confirm':confirmUrl,'sfx.cancel':cancelUrl,'sfx.explosion':explosionUrl,'sfx.sword':swordUrl,'sfx.blunt':bluntUrl};
/** Browser adapter. Only asset IDs/events cross the engine boundary. */
export class GameAudio {
  private context:AudioContext|null=null;
  private buffers=new Map<string,AudioBuffer>();
  private loading:Promise<void>|null=null;
  private bgm:AudioBufferSourceNode|null=null;
  private bgmGain:GainNode|null=null;
  private voices=new Set<AudioBufferSourceNode>();
  private wanted=false;
  private offset=0;
  private startedAt=0;
  private lastId=0;
  private disposed=false;
  musicVolume=.23;effectsVolume=.7;
  played=0;error='';
  get ready(){return this.buffers.size===6;}
  get musicPlaying(){return this.bgm!==null;}
  get voiceCount(){return this.voices.size;}
  async unlock() {
    if(this.disposed)return;
    try {
      if(!this.context)this.context=new AudioContext();
      await this.context.resume();
      if(!this.loading)this.loading=Promise.all(Object.entries(urls).map(async([id,url])=>{
        const response=await fetch(url);if(!response.ok)throw Error(`${id}: HTTP ${response.status}`);
        const buffer=await this.context!.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(id,buffer);
      })).then(()=>{this.error='';this.setPlaying(this.wanted);});
      await this.loading;
    }catch(error){this.error=`音声を読み込めませんでした: ${String(error)}`;this.loading=null;}
  }
  setPlaying(playing:boolean) {
    this.wanted=playing;
    if(!this.context||this.disposed)return;
    if(!playing) {
      if(this.bgm) {
        this.offset=(this.offset+this.context.currentTime-this.startedAt)%this.bgm.buffer!.duration;
        this.bgm.stop();this.bgm.disconnect();this.bgm=null;this.bgmGain?.disconnect();this.bgmGain=null;
      }
      for(const voice of this.voices)voice.stop();this.voices.clear();
      return;
    }
    const buffer=this.buffers.get('bgm.battle');
    if(this.bgm||!buffer||this.context.state!=='running')return;
    this.bgm=this.context.createBufferSource();this.bgm.buffer=buffer;this.bgm.loop=true;
    this.bgmGain=this.context.createGain();this.bgmGain.gain.value=this.musicVolume;
    this.bgm.connect(this.bgmGain).connect(this.context.destination);this.startedAt=this.context.currentTime;
    this.bgm.start(0,this.offset);
  }
  setVolumes(music:number,effects:number) {
    this.musicVolume=music;this.effectsVolume=effects;
    this.bgmGain?.gain.setTargetAtTime(music,this.context!.currentTime,.025);
  }
  play(id:SoundId,gain=1,rate=1,pan=0) {
    const context=this.context,buffer=this.buffers.get(id);
    if(this.disposed||!context||context.state!=='running'||!buffer)return;
    if(this.voices.size>=12){const oldest=this.voices.values().next().value!;oldest.stop();this.voices.delete(oldest);}
    const source=context.createBufferSource(),volume=context.createGain(),panner=context.createStereoPanner();
    source.buffer=buffer;source.playbackRate.value=rate;volume.gain.value=this.effectsVolume*gain;panner.pan.value=pan;
    source.connect(volume).connect(panner).connect(context.destination);this.voices.add(source);this.played++;
    source.onended=()=>{this.voices.delete(source);source.disconnect();volume.disconnect();panner.disconnect();};
    source.start();
  }
  consume(events:readonly GameEvent[],action:ActionDocument) {
    const destroyed=new Set(events.filter(e=>e.kind==='destroyed').map(e=>e.entityId));
    for(const event of events) {
      if(event.id<=this.lastId)continue;this.lastId=event.id;
      if(event.kind==='shot')this.play(event.weapon==='rifle'?action.shotSound:'sfx.sword',event.weapon==='rifle'?.30:.38,event.weapon==='rifle'?2.6:.65);
      if(event.kind==='destroyed')this.play('sfx.explosion',.85);
      if(event.kind==='impact'&&!destroyed.has(event.entityId))this.play(event.weapon==='missile'?'sfx.explosion':action.hitSound,event.entityId?.45:.22,event.weapon==='missile'?1:1.1);
      if(event.kind==='lock_ready')this.play('sfx.confirm',.40);
      if(event.kind==='player_hit')this.play('sfx.blunt',.85,.8);
    }
  }
  reset(){this.setPlaying(false);this.offset=0;this.lastId=0;}
  dispose(){this.reset();this.disposed=true;void this.context?.close();}
}
