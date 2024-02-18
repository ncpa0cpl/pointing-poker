import { Button } from "adwavecss";
import "./styles.css";

export const RepoLink = () => {
  return (
    <>
      <a
        class="repo-link"
        href="https://github.com/ncpa0cpl/pointing-poker"
        target="_blank"
        rel="noopener noreferrer"
      >
        <button class={Button.className({ flat: true })}>
          View Source Code on GitHub
        </button>
      </a>
    </>
  );
};
