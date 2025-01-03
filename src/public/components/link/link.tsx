import { ReadonlySignal } from "@ncpa0cpl/vanilla-jsx/signals";
import { isLmb } from "../../utilities/is-lmb";

type Navigator = { $open(): Promise<void>; $url(): string };

export type LinkProps = Omit<JSX.IntrinsicElements["a"], "href"> & {
  to: Navigator | ReadonlySignal<Navigator>;
};

export function Link({ children, to, ...rest }: LinkProps) {
  const handleClick = (e: MouseEvent) => {
    if (isLmb(e)) {
      e.preventDefault();
      if ("$open" in to) {
        to.$open();
      } else {
        to.get().$open();
      }
    }
  };

  if ("$url" in to) {
    return (
      <a {...rest} href={to.$url()} onmousedown={handleClick}>{children}</a>
    );
  }

  return (
    <a {...rest} href={to.derive(n => n.$url())} onmousedown={handleClick}>
      {children}
    </a>
  );
}
