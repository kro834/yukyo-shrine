import * as THREE from 'three';
import type {Preferences} from './preferences.ts';

type Surface={full:THREE.Texture;small:THREE.Texture;relief?:THREE.Texture;normal?:THREE.Texture;roughness?:THREE.Texture;bump:number;photographic:boolean};
/** Owns asynchronous texture loads; late High downloads cannot override a newer Low selection. */
export class SurfaceLibrary {
  private quality:Preferences['quality']='low';
  private disposed=false;
  private textures=new Set<THREE.Texture>();
  private surfaces=new Map<THREE.MeshStandardMaterial,Surface>();
  private details:(()=>void)[]=[];
  private programs:Map<THREE.MeshStandardMaterial,{compile:THREE.MeshStandardMaterial['onBeforeCompile'];key:()=>string}>;
  private anisotropy:number;
  private loader:THREE.TextureLoader;
  constructor(materials:THREE.Material[],anisotropy:number,loader=new THREE.TextureLoader()){
    this.anisotropy=anisotropy;this.loader=loader;
    this.programs=new Map(materials.filter((m):m is THREE.MeshStandardMaterial=>m instanceof THREE.MeshStandardMaterial).map(m=>[m,{compile:m.onBeforeCompile,key:m.customProgramCacheKey.bind(m)}]));
  }
  private own(texture:THREE.Texture,color=false){
    if(this.disposed){texture.dispose();return false;}
    texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;this.textures.add(texture);return true;
  }
  add(url:string,targets:THREE.MeshStandardMaterial[],options:{bump?:number;tint?:string;normal?:string;roughness?:string}={}){
    this.loader.load(url,full=>{
      if(!this.own(full,true))return;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;canvas.getContext('2d')?.drawImage(full.image,0,0,128,128);
      const small=new THREE.CanvasTexture(canvas);this.own(small,true);
      const photographic=!!options.normal,surface:Surface={full,small,bump:options.bump??0,photographic};
      if(!photographic&&surface.bump){surface.relief=full.clone();this.own(surface.relief);surface.relief.needsUpdate=true;}
      for(const material of targets){this.surfaces.set(material,surface);if(options.tint)material.color.set(options.tint);}
      if(photographic){let requested=false;const loadDetails=()=>{
        if(requested||this.disposed)return;requested=true;
        for(const [map,path] of [['normal',options.normal],['roughness',options.roughness]] as const)if(path)this.loader.load(path,texture=>{
          if(!this.own(texture))return;surface[map]=texture;this.apply();
        });
      };this.details.push(loadDetails);if(this.quality==='high')loadDetails();}
      this.apply();
    });
  }
  setQuality(quality:Preferences['quality']){this.quality=quality;if(quality==='high')for(const load of this.details)load();this.apply();}
  private apply(){
    const high=this.quality==='high',low=this.quality==='low';
    for(const [m,program] of this.programs){
      const surface=this.surfaces.get(m),procedural=high&&!surface?.photographic;
      m.onBeforeCompile=procedural?program.compile:()=>{};
      m.customProgramCacheKey=()=>procedural?program.key():'surface-albedo-v19';
      if(surface){
        m.map=low?surface.small:surface.full;
        m.bumpMap=high?surface.relief??null:null;m.bumpScale=surface.bump;
        m.normalMap=high?surface.normal??null:null;m.normalScale.set(1,1);
        m.roughnessMap=high?surface.roughness??null:null;
        for(const t of [surface.full,surface.relief,surface.normal,surface.roughness])if(t)t.anisotropy=Math.min(high?8:4,this.anisotropy);
        surface.small.anisotropy=1;
      }
      m.needsUpdate=true;
    }
  }
  dispose(){this.disposed=true;for(const t of this.textures)t.dispose();this.textures.clear();this.details=[];}
}
