export interface History<T>{past:T[];present:T;future:T[]}
export const createHistory=<T>(value:T):History<T>=>({past:[],present:structuredClone(value),future:[]});
export const editHistory=<T>(h:History<T>,value:T):History<T>=>({past:[...h.past.slice(-49),structuredClone(h.present)],present:structuredClone(value),future:[]});
export const undoHistory=<T>(h:History<T>):History<T>=>h.past.length?{past:h.past.slice(0,-1),present:structuredClone(h.past.at(-1)!),future:[structuredClone(h.present),...h.future]}:h;
export const redoHistory=<T>(h:History<T>):History<T>=>h.future.length?{past:[...h.past,structuredClone(h.present)],present:structuredClone(h.future[0]),future:h.future.slice(1)}:h;
