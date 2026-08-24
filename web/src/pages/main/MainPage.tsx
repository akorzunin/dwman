/// <reference types="vite/client" />

import { useQuery } from '@tanstack/react-query';
import { FC } from 'react';
import { OpenAPI } from '../../api/client';
import BlobButtonV2 from '../../components/buttons/BlobButtonV2';
// import BlobButton from '../../components/buttons/blob-button/BlobButton';
import * as cookieHandle from '../../utils/cookieHandle';

export const MainPage: FC = () => {
  // getUserQuery
  const { data: userPath } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const res = await cookieHandle.getUserPath();
      if (res) {
        return res;
      }
      console.warn('Cant get user info ');
      return `${OpenAPI.BASE}/login`;
    },
  });

  return (
    <div className="flex h-[70vh] items-center justify-center">
      <BlobButtonV2 link={userPath || `${OpenAPI.BASE}/login`} />
    </div>
  );
};

export default MainPage;
