import { withNativeRef, useCleanupRef } from "@dsh-t3/compat";
import { useState, type ComponentProps, type CSSProperties } from "react";

const PLACEMENT_KEYS = ["position", "top", "right", "bottom", "left", "transform"] as const;

type Placement = Pick<CSSProperties, (typeof PLACEMENT_KEYS)[number]>;

function ClosingPositionerImpl({ open, style, ...props }: ComponentProps<"div"> & { open: boolean }) {
  const [openPlacement, setOpenPlacement] = useState<Placement>({});
  if (open && style && PLACEMENT_KEYS.some((key) => style[key] !== openPlacement[key])) {
    const { position, top, right, bottom, left, transform } = style;
    setOpenPlacement({ position, top, right, bottom, left, transform });
  }
  return <div {...props} style={open ? style : { ...style, ...openPlacement }} />;
}
const ClosingPositioner = withNativeRef(ClosingPositionerImpl);


export function renderClosingPositioner(props: ComponentProps<"div">, state: { open: boolean }) {
  return <ClosingPositioner {...props} open={state.open} />;
}
