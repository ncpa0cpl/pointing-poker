import { Button, Theme } from "adwavecss";
import ThemeSwitchSvg from "../../assets/theme-switch-icon.svg";
import "./styles.css";

const LS_THEME_KEY = "adw-theme";

export const ThemeSwitch = () => {
  const toggleTheme = () => {
    const provider = document.querySelector(".theme-provider");
    if (provider) {
      if (provider.classList.contains(Theme.dark)) {
        provider.classList.add(Theme.light);
        provider.classList.remove(Theme.dark);
        localStorage.setItem(LS_THEME_KEY, Theme.light);
      } else {
        provider.classList.add(Theme.dark);
        provider.classList.remove(Theme.light);
        localStorage.setItem(LS_THEME_KEY, Theme.dark);
      }
    }
  };

  queueMicrotask(() => {
    const theme = localStorage.getItem(LS_THEME_KEY);
    if (theme) {
      const provider = document.querySelector(".theme-provider");
      if (provider) {
        provider.classList.remove(Theme.light);
        provider.classList.remove(Theme.dark);
        provider.classList.add(theme);
      }
    }
  });

  return (
    <div class="theme-switch-container">
      <button class={Button.button} onclick={toggleTheme}>
        <ThemeSwitchSvg alt="Theme Switch" />
      </button>
    </div>
  );
};
