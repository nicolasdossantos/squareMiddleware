import './AIBotIllustration.css';

interface AIBotIllustrationProps {
  theme: 'light' | 'dark';
}

export default function AIBotIllustration({ theme }: AIBotIllustrationProps) {
  const accent = theme === 'dark' ? '#38bdf8' : '#00C7C7';
  const secondaryAccent = theme === 'dark' ? '#7dd3fc' : '#7ae7e7';
  const logoSrc = theme === 'dark' ? '/darkmodelogo.png' : '/lightmodelogo.png';

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Subtle glow background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-96 h-96 rounded-full"
          style={{
            background: `radial-gradient(circle, ${accent}40, transparent 60%)`,
            boxShadow: `0 0 40px ${accent}20`
          }}
        ></div>
      </div>

      {/* Orbiting rings - GPU accelerated */}
      <div
        className="absolute w-96 h-96 animate-spin"
        style={{
          animationDuration: '8s',
          animationDirection: 'reverse',
          willChange: 'transform',
          WebkitBackfaceVisibility: 'hidden',
          WebkitPerspective: '1000px'
        }}
      >
        <svg viewBox="0 0 400 400" className="w-full h-full" style={{ willChange: 'transform' }}>
          {/* Outer ring */}
          <circle cx="200" cy="200" r="180" fill="none" stroke={accent} strokeWidth="2" opacity="0.5" />

          {/* Inner ring */}
          <circle cx="200" cy="200" r="140" fill="none" stroke={accent} strokeWidth="1" opacity="0.3" />

          {/* Animated dots around orbit */}
          {[0, 1, 2, 3].map(i => {
            const angle = i * 90 * (Math.PI / 180);
            const x = 200 + 180 * Math.cos(angle);
            const y = 200 + 180 * Math.sin(angle);
            return <circle key={`dot-${i}`} cx={x} cy={y} r="4" fill={accent} opacity="0.6" />;
          })}
        </svg>
      </div>

      {/* Your actual logo with glow effect - GPU accelerated */}
      <div
        className="relative z-10 w-80 h-80 animate-float"
        style={{
          willChange: 'transform',
          WebkitBackfaceVisibility: 'hidden'
        }}
      >
        <img src={logoSrc} alt="Fluent Front AI" className="w-full h-full object-contain" />
      </div>

      {/* Additional floating accent dots - GPU accelerated */}
      <div
        className="absolute top-12 right-12 w-4 h-4 rounded-full opacity-50 animate-pulse"
        style={{
          backgroundColor: accent,
          willChange: 'opacity',
          WebkitBackfaceVisibility: 'hidden'
        }}
      />
      <div
        className="absolute bottom-20 left-8 w-3 h-3 rounded-full opacity-40 animate-pulse"
        style={{
          animationDelay: '0.5s',
          backgroundColor: secondaryAccent,
          willChange: 'opacity',
          WebkitBackfaceVisibility: 'hidden'
        }}
      />
    </div>
  );
}
