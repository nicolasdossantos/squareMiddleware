import { useState, useEffect } from 'react';
import { Play } from 'lucide-react';

const demos = [
  {
    id: 1,
    title: 'AI Receptionist Demo',
    description: 'Watch how the AI handles incoming calls naturally'
  },
  {
    id: 2,
    title: 'Call Scheduling Demo',
    description: 'See smart appointment scheduling in action'
  },
  {
    id: 3,
    title: 'Multilingual Example',
    description: 'AI seamlessly switches between languages'
  }
];

export default function DemoCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  useEffect(() => {
    if (!isAutoPlay) return;

    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % demos.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isAutoPlay]);

  const nextSlide = () => {
    setCurrentSlide(prev => (prev + 1) % demos.length);
    setIsAutoPlay(false);
  };

  const prevSlide = () => {
    setCurrentSlide(prev => (prev - 1 + demos.length) % demos.length);
    setIsAutoPlay(false);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-light-bg dark:bg-dark-bg">
      <div className="max-w-5xl mx-auto">
        {/* Main carousel */}
        <div className="relative group">
          <div className="md:aspect-video aspect-[9/16] md:max-w-5xl max-w-sm mx-auto bg-light-surface dark:bg-dark-surface rounded-card border border-light-border dark:border-dark-border overflow-hidden flex items-center justify-center shadow-lg hover:shadow-glow-hover transition-shadow duration-300">
            {/* Demo content placeholder */}
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow-primary group-hover:shadow-glow-hover transition-all duration-300">
                  <Play className="w-12 h-12 text-white fill-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  {demos[currentSlide].title}
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary mt-2">
                  {demos[currentSlide].description}
                </p>
              </div>
              <button className="btn-primary inline-flex items-center gap-2 mt-4">
                <Play className="w-4 h-4" />
                Play Preview
              </button>
            </div>

            {/* Navigation buttons */}
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border hover:border-primary-light dark:hover:border-primary-dark transition-all duration-200 opacity-0 group-hover:opacity-100"
              aria-label="Previous slide"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border hover:border-primary-light dark:hover:border-primary-dark transition-all duration-200 opacity-0 group-hover:opacity-100"
              aria-label="Next slide"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Slide indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {demos.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentSlide(index);
                  setIsAutoPlay(false);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'bg-gradient-primary w-8'
                    : 'bg-light-border dark:bg-dark-border w-2 hover:bg-light-text-secondary dark:hover:bg-dark-text-secondary'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Autoplay toggle */}
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setIsAutoPlay(!isAutoPlay)}
              className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-light dark:hover:text-primary-dark transition-colors duration-200"
            >
              {isAutoPlay ? '⏸ Pause' : '▶ Resume'} autoplay
            </button>
          </div>
        </div>

        {/* Thumbnail cards below */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {demos.map((demo, index) => (
            <button
              key={demo.id}
              onClick={() => {
                setCurrentSlide(index);
                setIsAutoPlay(false);
              }}
              className={`p-4 rounded-card border-2 transition-all duration-300 ${
                index === currentSlide
                  ? 'border-primary-light dark:border-primary-dark bg-light-surface dark:bg-dark-surface shadow-glow-primary'
                  : 'border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg hover:border-primary-light dark:hover:border-primary-dark'
              }`}
            >
              <h4 className="font-semibold text-light-text-primary dark:text-dark-text-primary">
                {demo.title}
              </h4>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                {demo.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
