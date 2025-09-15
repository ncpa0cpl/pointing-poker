import "./styles.css";

export type PageLayoutProps = {
  children: JSX.Children;
  class?: string;
};

export function PageLayout(props: PageLayoutProps) {
  return (
    <main class={[props.class, "_page scrollview"]}>
      {props.children}
    </main>
  );
}
