import test from 'node:test';
import assert from 'node:assert/strict';
import {menuNeighbor} from '../app/menu-focus.ts';

test('stage navigation follows desktop rows and phone two-column geometry',()=>{
 const desktop=[0,1,2,3].map(i=>({left:i*210,top:0,width:200,height:77})).concat([0,1,2].map(i=>({left:i*280,top:130,width:270,height:185})));
 assert.equal(menuNeighbor(desktop,0,'right'),1);assert.equal(menuNeighbor(desktop,0,'down'),4);
 assert.equal(menuNeighbor(desktop,3,'down'),6);assert.equal(menuNeighbor(desktop,4,'up'),0);
 const phone=[0,1,2,3].map(i=>({left:i%2*175,top:Math.floor(i/2)*76,width:165,height:66})).concat([0,1,2].map(i=>({left:0,top:200+i*110,width:340,height:100})));
 assert.equal(menuNeighbor(phone,0,'down'),2);assert.equal(menuNeighbor(phone,0,'right'),1);
 assert.equal(menuNeighbor(phone,3,'down'),4);assert.equal(menuNeighbor(phone,6,'down'),6);
});
