import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          terra: '#D9796A',
          amber: '#FFB300',
          coral: '#FF6B6B',
        },
      },
      borderRadius: {
        xl: '1rem',
      },
      boxShadow: {
        soft: '0 10px 25px -10px rgba(0,0,0,0.2)'
      }
    },
  },
  plugins: [],
};

export default config;
