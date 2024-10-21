import { Button } from "adwavecss";
import coffe from "../../assets/coffe.svg";
import "./styles.css";
import { KofiService } from "../../services/kofi/kofi-service";

export const KofiLink = () => {
  return (
    <a
      class="kofi-link"
      href="https://ko-fi.com/ncpa0"
      target="_blank"
      rel="noopener noreferrer"
    >
      <button
        class={Button.className({ flat: true })}
        onclick={e => {
          KofiService.visited();
        }}
      >
        Send me a ko-fi
        <img src={coffe} alt="coffe" />
      </button>
    </a>
  );
};
