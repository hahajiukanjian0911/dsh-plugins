import { forwardRef, useMemo } from 'react';
// T3's React 19 components receive ref as a prop. DSH shares React 18.
export function withNativeRef(Component) {
  const Wrapped=forwardRef((props,ref)=>Component(ref == null ? props : {...props,ref}));
  Wrapped.displayName=Component.name.replace(/Impl$/,'');
  return Wrapped;
}
// Each mounted component needs its own cleanup slot. A shared callback would
// let a second spinner detach the first spinner's IntersectionObserver entry.
export function useCleanupRef(callback) {
  return useMemo(()=>{
    let dispose;
    return node=>{dispose?.();dispose=undefined;if(node)dispose=callback(node);};
  },[callback]);
}
