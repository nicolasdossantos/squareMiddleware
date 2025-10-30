import { MessageCircle, Calendar, Globe } from 'lucide-react';

const features = [
  {
    id: 1,
    icon: MessageCircle,
    title: 'Conversational AI',
    description: 'Not a phone menu. Not a voicemail. A real conversation.'
  },
  {
    id: 2,
    icon: Calendar,
    title: 'Smart Scheduling',
    description: 'Sounds like your best employee, never stressed, never rushed.'
  },
  {
    id: 3,
    icon: Globe,
    title: 'Multilingual Support',
    description: 'Fluent in English, Spanish, Portuguese, and more.'
  }
];

export default function FeatureHighlights() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-light-bg dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className="card card-hover group animate-slide-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Icon container with gradient background */}
                <div className="w-14 h-14 bg-gradient-to-br from-primary-light/20 to-accent-blue/10 dark:from-primary-dark/30 dark:to-accent-blue/20 rounded-lg flex items-center justify-center mb-4 group-hover:shadow-glow-primary dark:group-hover:shadow-glow-cyan transition-all duration-300">
                  <Icon className="w-7 h-7 text-primary-light dark:text-primary-dark" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-light-text-primary dark:text-dark-text-primary mb-3">
                  {feature.title}
                </h3>
                <p className="text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                  {feature.description}
                </p>

                {/* Subtle accent line on hover */}
                <div className="absolute bottom-0 left-0 h-1 bg-gradient-primary rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-12" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
