import { Button } from "adwavecss";
import "./styles.css";
import { Icon } from "../../assets/icons";
import { KofiService } from "../../services/kofi/kofi-service";

export const KofiLink = () => {
  return (
    <a
      class={["kofi-link", Button.className({ flat: true })]}
      href="https://ko-fi.com/ncpa0"
      target="_blank"
      rel="noopener noreferrer"
      onclick={e => {
        KofiService.visited();
      }}
    >
      Send me a ko-fi
      <Icon.Coffe alt="coffe" />
    </a>
  );
};
