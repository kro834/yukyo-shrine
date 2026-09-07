import test from 'node:test';
import assert from 'node:assert/strict';
import {menuNeighbor} from '../app/menu-focus.ts';

test('stage navigation follows desktop rows and phone two-column geometry',()=>{
 const desktop=[0,1,2,3,4].map(i=>({left:i*170,top:0,width:160,height:77})).concat([0,1,2].map(i=>({left:i*280,top:130,width:270,height:185})));
 assert.equal(menuNeighbor(desktop,0,'right'),1);assert.equal(menuNeighbor(desktop,0,'down'),5);
 assert.equal(menuNeighbor(desktop,4,'down'),7);assert.equal(menuNeighbor(desktop,5,'up'),0);
 const phone=[0,1,2,3].map(i=>({left:i%2*175,top:Math.floor(i/2)*76,width:165,height:66})).concat([{left:0,top:152,width:340,height:66}],[0,1,2].map(i=>({left:0,top:250+i*110,width:340,height:100})));
 assert.equal(menuNeighbor(phone,0,'down'),2);assert.equal(menuNeighbor(phone,0,'right'),1);
 assert.equal(menuNeighbor(phone,3,'down'),4);assert.equal(menuNeighbor(phone,4,'down'),5);assert.equal(menuNeighbor(phone,7,'down'),7);
});
