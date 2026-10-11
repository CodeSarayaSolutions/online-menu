const {test}=require('node:test');const assert=require('node:assert/strict');
const memory=new Map();global.sessionStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const {useCartStore:cart}=require('../../.local/unit/store/cartStore');
const {useTableSessionStore:table}=require('../../.local/unit/store/tableSessionStore');
test('venue switches remove foreign cart and QR context; same-venue navigation preserves both',()=>{
 cart.getState().activateVenue('venue-a');table.getState().activateVenue('venue-a');
 cart.getState().addItem({id:'coffee',cartKey:'coffee',name:'Coffee',price:2,quantity:1,image:''});
 table.getState().setTable('Table 1','a-table',Date.now()+300000);
 cart.getState().activateVenue('venue-a');table.getState().activateVenue('venue-a');
 assert.equal(cart.getState().getTotal(),2);assert.equal(table.getState().isValid(),true);
 cart.getState().activateVenue('venue-b');table.getState().activateVenue('venue-b');
 assert.deepEqual(cart.getState().items,[]);assert.equal(table.getState().tableId,null);assert.equal(table.getState().isValid(),false);
});
test('expired QR session is invalid without waiting for a UI timer',()=>{
 table.getState().activateVenue('venue-a');table.getState().setTable('Table 1','a-table',Date.now()-1);assert.equal(table.getState().isValid(),false);
});
