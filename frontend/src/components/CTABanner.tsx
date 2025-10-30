import { Link } from 'react-router-dom'

export default function CTABanner() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-light-bg dark:bg-dark-bg">
      <div className="max-w-4xl mx-auto bg-gradient-primary dark:bg-gradient-primary-dark rounded-card p-8 sm:p-12 text-white shadow-glow-hover">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
          {/* Text content */}
          <div className="flex-1">
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              Ready to make every call sound effortless?
            </h2>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <Link to="/signup" className="px-8 py-3 rounded-button font-semibold bg-white text-primary-light hover:bg-light-bg transition-all duration-200 hover:shadow-lg active:scale-95 whitespace-nowrap text-center">
              Start Free Trial
            </Link>
            <button className="px-8 py-3 rounded-button font-semibold border-2 border-white text-white hover:bg-white/10 transition-all duration-200 active:scale-95 whitespace-nowrap">
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
