import * as THREE from 'three';
import type {Preferences} from './preferences.ts';

type DetailMaps={full?:THREE.Texture;normal?:THREE.Texture;roughness?:THREE.Texture};
type Surface={full:THREE.Texture;small:THREE.Texture;relief?:THREE.Texture;normal?:THREE.Texture;roughness?:THREE.Texture;metalness?:THREE.Texture;ultra:DetailMaps;bump:number;normalStrength:number;preserveFinish:boolean;photographic:boolean;repeat:[number,number]};
export type SurfaceOptions={bump?:number;tint?:string;normal?:string;roughness?:string;metalness?:string;normalStrength?:number;preserveFinish?:boolean;lowSize?:128|256;repeat?:[number,number];ultra?:{full:string;normal:string;roughness:string}};
/** Owns asynchronous texture loads; late High downloads cannot override a newer Low selection. */
export class SurfaceLibrary {
  private quality:Preferences['quality']='low';
  private disposed=false;
  private textures=new Set<THREE.Texture>();
  private surfaces=new Map<THREE.MeshStandardMaterial,Surface>();
  private details:(()=>void)[]=[];
  private ultraDetails:(()=>void)[]=[];
  private variants=new Map<THREE.MeshStandardMaterial,boolean>();
  private baseFinishes=new Set<THREE.MeshStandardMaterial>();
  private programs:Map<THREE.MeshStandardMaterial,{compile:THREE.MeshStandardMaterial['onBeforeCompile'];key:()=>string}>;
  private anisotropy:number;
  private loader:THREE.TextureLoader;
  private lightingFinish?: (material:THREE.MeshStandardMaterial)=>void;
  constructor(materials:THREE.Material[],anisotropy:number,loader=new THREE.TextureLoader()){
    this.anisotropy=anisotropy;this.loader=loader;
    this.programs=new Map(materials.filter((m):m is THREE.MeshStandardMaterial=>m instanceof THREE.MeshStandardMaterial).map(m=>[m,{compile:m.onBeforeCompile,key:m.customProgramCacheKey.bind(m)}]));
  }
  private own(texture:THREE.Texture,color=false){
    if(this.disposed){texture.dispose();return false;}
    texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;this.textures.add(texture);return true;
  }
  add(url:string,targets:THREE.MeshStandardMaterial[],options:SurfaceOptions={}){
    this.loader.load(url,full=>{
      if(!this.own(full,true))return;
      const canvas=document.createElement('canvas'),size=options.lowSize??128;canvas.width=canvas.height=size;canvas.getContext('2d')?.drawImage(full.image,0,0,size,size);
      const small=new THREE.CanvasTexture(canvas);this.own(small,true);
      const photographic=!!options.normal,surface:Surface={full,small,ultra:{},bump:options.bump??0,normalStrength:options.normalStrength??1,preserveFinish:options.preserveFinish??false,photographic,repeat:options.repeat??[1,1]};
      if(!photographic&&surface.bump){surface.relief=full.clone();this.own(surface.relief);surface.relief.needsUpdate=true;}
      for(const material of targets){this.surfaces.set(material,surface);if(options.tint)material.color.set(options.tint);}
      if(photographic){let requested=false;const loadDetails=()=>{
        if(requested||this.disposed)return;requested=true;
        for(const [map,path] of [['normal',options.normal],['roughness',options.roughness],['metalness',options.metalness]] as const)if(path)this.loader.load(path,texture=>{
          if(!this.own(texture))return;surface[map]=texture;this.apply();
        });
      };this.details.push(loadDetails);if(this.quality==='high'||this.quality==='ultra')loadDetails();}
      if(options.ultra){let requested=false;const loadUltra=()=>{
        if(requested||this.disposed)return;requested=true;
        for(const map of ['full','normal','roughness'] as const)this.loader.load(options.ultra![map],texture=>{
          if(!this.own(texture,map==='full'))return;surface.ultra[map]=texture;this.apply();
        });
      };this.ultraDetails.push(loadUltra);if(this.quality==='ultra')loadUltra();}
      this.apply();
    });
  }
  setQuality(quality:Preferences['quality']){this.quality=quality;if(quality==='high'||quality==='ultra')for(const load of this.details)load();if(quality==='ultra')for(const load of this.ultraDetails)load();this.apply();}
  setLightingFinish(finish:(material:THREE.MeshStandardMaterial)=>void){this.lightingFinish=finish;this.apply();}
  preserveBaseFinish(...materials:THREE.MeshStandardMaterial[]){for(const m of materials)this.baseFinishes.add(m);this.apply();}
  private apply(){
    const ultra=this.quality==='ultra',high=this.quality==='high'||ultra,low=this.quality==='low';
    for(const [m,program] of this.programs){
      const surface=this.surfaces.get(m),procedural=this.baseFinishes.has(m)||high&&(!surface?.photographic||surface.preserveFinish);
      let changed=this.variants.get(m)!==procedural;
      if(changed){m.onBeforeCompile=procedural?program.compile:()=>{};m.customProgramCacheKey=()=>procedural?program.key():'surface-albedo-v20';this.variants.set(m,procedural);}
      if(surface){
        const detail=ultra?{...surface,...surface.ultra}:surface;
        const next={map:low?surface.small:detail.full!,bumpMap:high?surface.relief??null:null,normalMap:high?detail.normal??null:null,roughnessMap:high?detail.roughness??null:null,metalnessMap:high?surface.metalness??null:null};
        for(const key of ['map','bumpMap','normalMap','roughnessMap','metalnessMap'] as const)if(m[key]!==next[key]){m[key]=next[key];changed=true;}
        m.bumpScale=surface.bump;m.normalScale.setScalar(surface.normalStrength);
        for(const t of [surface.full,surface.small,surface.relief,surface.normal,surface.roughness,surface.metalness,...Object.values(surface.ultra)])if(t)t.repeat.set(...surface.repeat);
        for(const t of [surface.full,surface.relief,surface.normal,surface.roughness,surface.metalness,...Object.values(surface.ultra)])if(t){const anisotropy=Math.min(ultra?16:high?8:4,this.anisotropy);if(t.anisotropy!==anisotropy){t.anisotropy=anisotropy;t.needsUpdate=true;}}
        surface.small.anisotropy=1;
      }
      this.lightingFinish?.(m);
      if(changed)m.needsUpdate=true;
    }
  }
  dispose(){this.disposed=true;for(const t of this.textures)t.dispose();this.textures.clear();this.details=[];this.ultraDetails=[];}
}
