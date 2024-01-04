import {
  bindSignal,
  type ReadonlySignal,
  type Signal,
} from "@ncpa0cpl/vanilla-jsx";
import { Box } from "adwavecss";
import { clsx } from "clsx";
import "./styles.css";

export const UpsideDownScrollView = (
  props: JSX.PropsWithChildren<
    {
      into?: keyof JSX.IntrinsicElements;
      class?: string;
      dep: ReadonlySignal<any> | Signal<any>;
    }
  >,
) => {
  const { children, dep, into: Into = "div" } = props;

  const elem = (
    <Into class={clsx(props.class, "scrollview", Box.box)}>{children}</Into>
  );

  bindSignal(dep, elem, (elem) => {
    setTimeout(() => {
      elem.scrollTo({
        top: elem.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  });

  return elem;
};
