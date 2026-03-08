'use client';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en" data-theme="dark">
      <body style={{ margin: 0, background: '#000', fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            textAlign: 'center',
          }}
        >
          <h2 style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 300, fontSize: '1.5rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {error.digest ? `Error ID: ${error.digest}` : 'Please refresh the page.'}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '2rem',
              padding: '0.5rem 1.25rem',
              fontSize: '0.875rem',
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
