import { $component } from "@ncpa0cpl/vanilla-jsx";
import type { ReadonlySignal, Signal } from "@ncpa0cpl/vanilla-jsx/signals";
import { Box } from "adwavecss";
import "./styles.css";

type UpsideDownScrollViewProps = JSX.PropsWithChildren<
  {
    into?: keyof JSX.IntrinsicElements;
    class?: string;
    dep: ReadonlySignal<any> | Signal<any>;
  }
>;

export const UpsideDownScrollView = $component<UpsideDownScrollViewProps>((
  props,
  api,
) => {
  const { children, dep, into: Into = "div" } = props;

  api.onChange(() => {
    setTimeout(() => {
      elem.scrollTo({
        top: elem.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }, [dep]);

  const elem = (
    <Into class={[props.class, "scrollview", Box.box]}>
      {children}
    </Into>
  );

  return elem;
});
