/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode palette
        light: {
          bg: '#F8FAFB',
          surface: '#FFFFFF',
          'text-primary': '#1B1D1F',
          'text-secondary': '#636C72',
          border: '#E3E7EA',
        },
        // Dark mode palette
        dark: {
          bg: '#0D1117',
          surface: '#161B22',
          'text-primary': '#F3F6F8',
          'text-secondary': '#9CA3AF',
          border: '#2B3138',
        },
        // Brand colors
        primary: {
          light: '#00C7C7',
          DEFAULT: '#00C7C7',
          hover: '#00AFAF',
          dark: '#00E0E0',
        },
        accent: {
          blue: '#007BFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '44px' }],
        '5xl': ['48px', { lineHeight: '60px' }],
      },
      fontWeight: {
        400: '400',
        500: '500',
        600: '600',
        700: '700',
      },
      borderRadius: {
        button: '12px',
        card: '20px',
      },
      spacing: {
        gutter: '8px',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 224, 224, 0.3)',
        'glow-primary': '0 0 16px rgba(0, 199, 199, 0.2)',
        'glow-hover': '0 4px 24px rgba(0, 199, 199, 0.3)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #00C7C7, #007BFF)',
        'gradient-primary-dark': 'linear-gradient(135deg, #00E0E0, #0099FF)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-in-up': 'slideInUp 0.6s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 224, 224, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(0, 224, 224, 0.5)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        slideInUp: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
