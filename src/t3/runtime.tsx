import { createContext, useContext } from 'react';
export const SidebarRuntime=createContext(null);
export const useSidebarRuntime=()=>useContext(SidebarRuntime);
export function useSidebar(){ const {wide}=useSidebarRuntime();return {state:wide?'expanded':'collapsed',isMobile:false}; }
export function useNativeTitlebarHeight(){ return useSidebarRuntime().titlebarHeight; }
