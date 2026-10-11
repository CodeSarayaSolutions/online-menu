/** Resolve legacy labels only when unique; explicit identities always win. */
export function productCategoryId(product: {categoryId?: string;category: string}, categories: readonly {id:string;label:string}[]): string | null {
 if (product.categoryId) return product.categoryId;
 const direct = categories.find(c=>c.id===product.category); if(direct)return direct.id;
 const matches=categories.filter(c=>c.label===product.category);
 return matches.length===1?matches[0].id:null;
}
