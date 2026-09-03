import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import { ErrorBoundary } from 'react-error-boundary';
import { createBrowserRouter, RouterProvider } from 'react-router';

// Setup OpenApi config
import './api/config';
import { RootLayout } from './pages/layout/RootLayout';
import { ThemeProvider } from './shadcn/ui/theme-provider';
import { getBrowserName } from './utils/compat';

if (getBrowserName() === 'Firefox') {
  const root = document.getElementsByTagName('html')[0];
  root.setAttribute('class', 'ff-scrollbar');
}

const AboutPage = lazy(() => import('./pages/about/AboutPage'));
const GetTokenPage = lazy(() => import('./pages/get_token/GetTokenPage'));
const MainPage = lazy(() => import('./pages/main/MainPage'));
const UserPage = lazy(() => import('./pages/user/UserPage'));
const DummyPage = lazy(() =>
  import('./pages/dummy/DummyPage').then((module) => ({
    default: module.DummyPage,
  }))
);

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: '/',
    element: <DummyPage />,
  },
  {
    path: 'get_token',
    element: <GetTokenPage />,
  },
  {
    path: '/app/*',
    element: <RootLayout />,
    children: [
      {
        path: '*',
        element: <MainPage />,
      },
      {
        path: 'user/:userId',
        element: <UserPage />,
      },
      {
        path: 'help',
        element: <AboutPage />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <RouterProvider router={router} />
          </Suspense>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
