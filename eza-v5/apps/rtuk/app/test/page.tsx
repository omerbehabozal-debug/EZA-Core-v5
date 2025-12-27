/**
 * Test Page - Debug için
 */

export default function TestPage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>RTÜK Panel Test Sayfası</h1>
      <p>Eğer bu sayfayı görüyorsanız, Next.js çalışıyor demektir.</p>
      <p>API URL: {process.env.NEXT_PUBLIC_API_URL || 'NOT SET'}</p>
      <p>Environment: {process.env.NODE_ENV || 'unknown'}</p>
    </div>
  );
}

