import { FC } from 'react';
import { OpenAPI } from '../../api/client';

const GetLoginPage: FC = () => {
  window.location.href = `${OpenAPI.BASE}/login`;
  return null;
};

export default GetLoginPage;
