import ReactDOM from 'react-dom/client';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import './index.css';
import { ErrorBoundary } from 'react-error-boundary';
import { createBrowserRouter, RouterProvider } from 'react-router';
import UserPage from './pages/user/UserPage';
import MainPage from './pages/main/MainPage';
import AboutPage from './pages/about/AboutPage';
import GetTokenPage from './pages/get_token/GetTokenPage';

// Setup OpenApi config
import './api/config';
import { getBrowserName } from './utils/compat';
import { ThemeProvider } from './shadcn/ui/theme-provider';
import { RootLayout } from './pages/layout/RootLayout';
import { DummyPage } from './pages/dummy/DummyPage';

if (getBrowserName() === 'Firefox') {
  const root = document.getElementsByTagName('html')[0];
  root.setAttribute('class', 'ff-scrollbar');
}

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
          <RouterProvider router={router} />
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
