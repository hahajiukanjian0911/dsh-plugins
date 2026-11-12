// The host owns symbol definitions and DSH Polish may refine them in place.
// Do not bundle a second icon vocabulary into the sidebar.
import { createContext, forwardRef, useContext } from 'react';
export const NativeIcons = createContext(null);
export const NATIVE_ICON_EXPORTS = {
  FolderIcon: 'IconFolderCloseRegular', PinIcon: 'IconPinOutlineRegular',
  ClockIcon: 'IconClockOutlineRegular', CheckIcon: 'IconCheckOutlineRegular',
  Undo2Icon: 'IconUnarchiveOutlineRegular', SquarePenIcon: 'IconEditOutlineRegular',
  NewChatIcon: 'IconNewChatOutlineRegular', EllipsisIcon: 'IconEllipsisOutlineRegular',
  CircleAlertIcon: 'IconWarningOutlineRegular', InboxIcon: 'IconArchiveOutlineRegular',
  SearchIcon: 'IconSearchOutlineRegular', XIcon: 'IconCloseOutlineRegular',
  ListFilterIcon: 'IconSlidersTwoOutlineRegular', FolderPlusIcon: 'IconProjectAddOutlineRegular',
  ChevronDownIcon: 'IconChevronDownOutlineRegular', ChevronRightIcon: 'IconChevronRightOutlineRegular',
  LoaderCircleIcon: 'IconLoadingOutlineRegular',
};
function native(name) {
  return function HostIcon({ size = 16, className }) {
    const primitives = useContext(NativeIcons), Icon = primitives[NATIVE_ICON_EXPORTS[name]];
    return <Icon size={size} className={className}/>;
  };
}
export const FolderIcon = native('FolderIcon'), PinIcon = native('PinIcon'), ClockIcon = native('ClockIcon');
export const CheckIcon = native('CheckIcon'), Undo2Icon = native('Undo2Icon'), SquarePenIcon = native('SquarePenIcon');
export const NewChatIcon = native('NewChatIcon'), EllipsisIcon = native('EllipsisIcon'), CircleAlertIcon = native('CircleAlertIcon');
export const InboxIcon = native('InboxIcon'), SearchIcon = native('SearchIcon'), XIcon = native('XIcon');
export const ListFilterIcon = native('ListFilterIcon'), FolderPlusIcon = native('FolderPlusIcon');
export const ChevronDownIcon = native('ChevronDownIcon'), ChevronRightIcon = native('ChevronRightIcon');
const Loading = native('LoaderCircleIcon');
// The existing T3 visibility observer keeps owning the animated DOM node.
// Host icon functions accept size/className only, so place its ref on a wrapper.
export const LoaderCircleIcon = forwardRef(function LoadingIcon({ className, ...props }, ref) {
  return <span {...props} ref={ref} className={'dsi-native-spinner ' + (className || '')}><Loading className="size-full"/></span>;
});
