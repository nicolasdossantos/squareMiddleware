import { Linkedin, Twitter, Youtube } from 'lucide-react'

interface FooterProps {
  theme: 'light' | 'dark'
}

export default function Footer({ theme }: FooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center md:text-left">
          {/* Left - Logo and copyright */}
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <img
              src={theme === 'light' ? '/lightmodelogo.png' : '/darkmodelogo.png'}
              alt="Fluent Front AI"
              className="w-8 h-8 object-contain flex-shrink-0"
            />
            <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              © {currentYear} Fluent Front AI
            </span>
          </div>

          {/* Center - Links */}
          <nav className="flex flex-wrap justify-center gap-6">
            <a
              href="#privacy"
              className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-light dark:hover:text-primary-dark transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <a
              href="#terms"
              className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-light dark:hover:text-primary-dark transition-colors duration-200"
            >
              Terms
            </a>
            <a
              href="#status"
              className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-light dark:hover:text-primary-dark transition-colors duration-200"
            >
              Status
            </a>
          </nav>

          {/* Right - Social icons */}
          <div className="flex justify-center md:justify-end gap-4">
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-light-border dark:hover:bg-dark-border transition-colors duration-200 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-light dark:hover:text-primary-dark"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-light-border dark:hover:bg-dark-border transition-colors duration-200 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-light dark:hover:text-primary-dark"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-light-border dark:hover:bg-dark-border transition-colors duration-200 text-light-text-secondary dark:text-dark-text-secondary hover:text-primary-light dark:hover:text-primary-dark"
              aria-label="YouTube"
            >
              <Youtube className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
