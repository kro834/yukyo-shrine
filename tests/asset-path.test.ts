import test from 'node:test';
import assert from 'node:assert/strict';
import {assetPath} from '../app/asset-path.ts';

test('Pages prefixes models, materials, icons and the root without double-prefixing',()=>{
  for(const url of ['/models/hotel/settled-bed-v64.glb','/materials/wood_planks_diff.jpg','/icons/yukyo-192-v62.png','/']){
    const result=assetPath(url,'/yukyo-shrine');
    assert.equal(result,'/yukyo-shrine'+url);
    assert.equal(assetPath(result,'/yukyo-shrine'),result);
  }
  assert.equal(assetPath('/yukyo-shrine','/yukyo-shrine'),'/yukyo-shrine');
});
test('local development, external URLs and glTF-relative resources stay intact',()=>{
  for(const url of ['/materials/wood_planks_diff.jpg','textures/chair.png','data:image/png;base64,AA','blob:https://example.com/abc','https://example.com/model.glb','//cdn.example.com/model.glb']){
    assert.equal(assetPath(url,''),url);
    if(!url.startsWith('/')||url.startsWith('//'))assert.equal(assetPath(url,'/yukyo-shrine'),url);
  }
});
