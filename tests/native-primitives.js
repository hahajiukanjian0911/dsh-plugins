// Isolated fixture for the actual host control contracts; not shipped.
import nativeIcons from './native-icons.json' with { type: 'json' };
export function nativePrimitives(React) {
  return {
    ...Object.fromEntries(nativeIcons.icons.map(({name,key,regular})=>{
      const [,attributes,inner]=regular.match(/^<svg\s+([\s\S]*?)>([\s\S]*)<\/svg>$/);
      const camel={'stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin'};
      const props=Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[camel[key]||key,value]));
      return [name,function NativeIcon({size=16,className}){
        return React.createElement('svg',{...props,width:size,height:size,className,'aria-hidden':true,
          'data-icon':'dsw-icon-'+key+'-regular',dangerouslySetInnerHTML:{__html:'<defs><symbol id="fixture-'+key+'" viewBox="'+props.viewBox+'" fill="'+(props.fill||'none')+'" stroke="'+(props.stroke||'none')+'" stroke-width="'+(props.strokeWidth||1)+'" stroke-linejoin="round">'+inner+'</symbol></defs><use href="#fixture-'+key+'"/>'}});
      }];
    })),
    Switch({ checked, onChange, label, disabled = false }) {
      return React.createElement('button', { type:'button', role:'switch', className:'fixture-native-switch',
        'aria-label':label, 'aria-checked':checked, disabled, onClick:()=>onChange(!checked) }, React.createElement('span'));
    },
    Button({ variant, size, children, ...props }) {
      return React.createElement('button', { type:'button', className:'fixture-native-button', ...props }, children);
    },
  };
}
