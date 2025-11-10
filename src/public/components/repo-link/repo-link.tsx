import { Button } from "adwavecss";
import "./styles.css";

export const RepoLink = () => {
  return (
    <a
      class={["repo-link", Button.className({ flat: true })]}
      href="https://github.com/ncpa0cpl/pointing-poker"
      target="_blank"
      rel="noopener noreferrer"
    >
      View Source Code on GitHub
    </a>
  );
};
