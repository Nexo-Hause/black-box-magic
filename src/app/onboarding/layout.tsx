export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--font)',
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '1.5rem 1rem',
      }}>
        {children}
      </div>
    </div>
  );
}
