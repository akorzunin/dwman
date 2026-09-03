import { useNavigate } from 'react-router';
import { Button } from '../../shadcn/ui/button';
import { deleteCookiesAndLocalStorage } from '../../utils/cookieHandle';

export const LogoutButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="destructive"
      onClick={() => {
        deleteCookiesAndLocalStorage();
        navigate('/app/', { replace: true });
      }}
    >
      Logout
    </Button>
  );
};
