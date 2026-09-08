/** Local files stay in memory. Probe before replacing the current valid video. */
export class ReferenceVideo {
  video: HTMLVideoElement; url: string | null=null; name=''; duration=0; revision=0;
  constructor(video: HTMLVideoElement){this.video=video;}
  async load(file: File): Promise<boolean>{
    const revision=++this.revision;
    if(file.size>256*1024*1024)throw new Error('参照動画は256MB以下にしてください');
    if(file.type&&!file.type.startsWith('video/'))throw new Error('動画ファイルを選択してください');
    const url=URL.createObjectURL(file),probe=document.createElement('video');probe.preload='metadata';
    try{
      await new Promise<void>((resolve,reject)=>{
        const timer=setTimeout(()=>finish(new Error('動画の読み込みがタイムアウトしました')),15_000);
        const finish=(error?: Error)=>{clearTimeout(timer);probe.onloadedmetadata=null;probe.onerror=null;error?reject(error):resolve();};
        probe.onloadedmetadata=()=>finish();probe.onerror=()=>finish(new Error('この動画形式をブラウザで再生できません'));probe.src=url;
      });
      const duration=probe.duration;
      if(!Number.isFinite(duration)||duration<=0||duration>86400)throw new Error('長さの確定した24時間以内の動画が必要です');
      if(revision!==this.revision){URL.revokeObjectURL(url);return false;}
      this.release();this.url=url;this.name=file.name;this.duration=duration;this.video.src=url;this.video.load();return true;
    }catch(e){URL.revokeObjectURL(url);throw e;}
    finally{probe.removeAttribute('src');probe.load();}
  }
  seek(time: number){if(this.url)this.video.currentTime=Math.max(0,Math.min(time,this.duration));}
  pause(){this.video.pause();}
  release(){this.pause();this.video.removeAttribute('src');this.video.load();if(this.url)URL.revokeObjectURL(this.url);this.url=null;this.name='';this.duration=0;}
  dispose(){++this.revision;this.release();}
}
