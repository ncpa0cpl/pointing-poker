import { Icon } from "../../assets/icons";
import { Router } from "../../pages/routes";
import { UserService } from "../../services/user-service/user-service";
import { Link } from "../link/link";
import "./styles.css";

export function UserBtn() {
  return (
    <Link to={Router.nav.user} class="user-btn">
      <span class="name-preview">
        {UserService.username()}
      </span>
      <span class="user-icon">
        <Icon.User />
      </span>
    </Link>
  );
}
