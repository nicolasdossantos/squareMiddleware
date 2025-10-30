interface AIBotIllustrationProps {
  theme: 'light' | 'dark';
}

export default function AIBotIllustration({ theme }: AIBotIllustrationProps) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Glow background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-96 h-96 bg-gradient-to-br from-primary-light/30 to-accent-blue/10 rounded-full blur-3xl animate-glow-pulse"></div>
      </div>

      {/* Orbiting rings */}
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
        <svg viewBox="0 0 400 400" className="w-full h-full">
          {/* Outer ring */}
          <circle cx="200" cy="200" r="180" fill="none" stroke="#00C7C7" strokeWidth="2" opacity="0.5" />

          {/* Inner ring */}
          <circle cx="200" cy="200" r="140" fill="none" stroke="#00C7C7" strokeWidth="1" opacity="0.3" />

          {/* Animated dots around orbit */}
          {[0, 1, 2, 3].map(i => {
            const angle = i * 90 * (Math.PI / 180);
            const x = 200 + 180 * Math.cos(angle);
            const y = 200 + 180 * Math.sin(angle);
            return <circle key={`dot-${i}`} cx={x} cy={y} r="4" fill="#00C7C7" opacity="0.6" />;
          })}
        </svg>
      </div>

      {/* Your actual logo with glow effect */}
      <div className="relative z-10 w-80 h-80 animate-float">
        <img src="/lightmodelogo.png" alt="Fluent Front AI" className="w-full h-full object-contain" />
      </div>

      {/* Additional floating accent dots */}
      <div className="absolute top-12 right-12 w-4 h-4 bg-primary-light rounded-full opacity-50 animate-pulse" />
      <div
        className="absolute bottom-20 left-8 w-3 h-3 bg-primary-light rounded-full opacity-40 animate-pulse"
        style={{ animationDelay: '0.5s' }}
      />
    </div>
  );
}
