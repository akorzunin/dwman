import { FC, useEffect } from 'react';

import { useNavigate, useSearchParams } from 'react-router';
import { SpotifyCookie } from '../../interfaces/Cookies';
import { setCookies } from '../../utils/cookieHandle';
import { OpenAPI } from '../../api/client';

const handleResponse = async (
  response: Response,
  navigate: (s: string) => void
) => {
  const data = (await response.json()) as DevSpotifyCookie;
  setCookies(data);
  navigate(`/app/user/${data.user_id}`);
};

interface DevSpotifyCookie extends SpotifyCookie {
  user_id: string;
}

// TODO: find better way to prevent multiple requests
let sent = false;

const GetTokenPage: FC = () => {
  // only for dev server
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (!codeParam) {
      throw new Error('No code for auth request');
    }
    if (sent) {
      return;
    }
    sent = true;
    fetch(
      `${OpenAPI.BASE}/get_token?` +
        new URLSearchParams({
          code: codeParam,
          redirect: 'false',
        }),
      { method: 'GET' }
    )
      .then((response) => handleResponse(response, navigate))
      .catch((err) => console.error(err));
  }, [navigate, searchParams]);

  return null;
};

export default GetTokenPage;
