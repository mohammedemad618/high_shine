import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { bootstrapSession, session } from './api/client.js';
import { keys } from './api/hooks.js';
import { onUploadCancelled, onUploadDone, resetUploads } from './upload/uploader.js';
import { syncCancelledUpload } from './pages/course/courseCache.js';
import App from './App.jsx';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Don't retry client errors (403, 404…); retry network/5xx once.
      retry: (count, err) => count < 1 && !(err?.status >= 400 && err?.status < 500),
    },
  },
});

// Drop cached data and running uploads when the session ends (logout, revoked device…).
session.onEnd(() => {
  queryClient.clear();
  resetUploads();
});

// A finished upload moves the lesson to "queued": refetch the course so the editor starts polling its status.
onUploadDone((item) => {
  queryClient.invalidateQueries({ queryKey: keys.course(item.courseId) });
});

// A cancelled upload puts the lesson back to ready / failed / draft on the server: show that instead of "uploading".
onUploadCancelled((item) => {
  syncCancelledUpload(queryClient, item);
});

bootstrapSession();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
