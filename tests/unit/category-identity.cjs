const {test}=require('node:test');const assert=require('node:assert/strict');const {productCategoryId:id}=require('../../.local/unit/lib/category-identity');
test('Duplicate category labels cannot merge distinct identities or silently choose a category',()=>{
 const categories=[{id:'sit-down',label:'Coffee'},{id:'take-away',label:'Coffee'},{id:'food',label:'Food'}];
 assert.equal(id({categoryId:'sit-down',category:'Coffee'},categories),'sit-down');
 assert.equal(id({categoryId:'take-away',category:'Coffee'},categories),'take-away');
 assert.equal(id({category:'Coffee'},categories),null);
 assert.equal(id({category:'take-away'},categories),'take-away');
 assert.equal(id({category:'Food'},categories),'food');
});
