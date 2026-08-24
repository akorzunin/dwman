import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import { ErrorBoundary } from 'react-error-boundary';
import { createBrowserRouter, RouterProvider } from 'react-router';
import AboutPage from './pages/about/AboutPage';
import GetTokenPage from './pages/get_token/GetTokenPage';
import MainPage from './pages/main/MainPage';
import UserPage from './pages/user/UserPage';

// Setup OpenApi config
import './api/config';
import { DummyPage } from './pages/dummy/DummyPage';
import { RootLayout } from './pages/layout/RootLayout';
import { ThemeProvider } from './shadcn/ui/theme-provider';
import { getBrowserName } from './utils/compat';

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
