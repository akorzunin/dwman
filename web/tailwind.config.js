/** @type {import('tailwindcss').Config} */

const getColor = (colorVar, { opacityVariable, opacityValue }) => {
  if (opacityValue !== undefined) {
    return `hsl(from var(${colorVar}) h s l / ${opacityValue})`;
  }
  if (opacityVariable !== undefined) {
    return `hsl(from var(${colorVar}) h s l / var(${opacityVariable})))`;
  }

  return `hsl(from var(${colorVar}) h s l)`;
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      tablet: '640px',
      laptop: '1024px',
      desktop: '1280px',
    },
    container: {
      center: true,
      padding: {
        DEFAULT: '0',
        sm: '2rem',
        lg: '4rem',
        xl: '5rem',
        '2xl': '6rem',
      },
    },
    extend: {
      colors: {
        background: (params) => getColor('--background', params),
        foreground: (params) => getColor('--foreground', params),
        primary: {
          DEFAULT: (params) => getColor('--primary', params),
          foreground: (params) => getColor('--primary-foreground', params),
        },
        secondary: {
          DEFAULT: (params) => getColor('--secondary', params),
          foreground: (params) => getColor('--secondary-foreground', params),
        },
        third: {
          DEFAULT: (params) => getColor('--third', params),
          foreground: (params) => getColor('--third-foreground', params),
        },
        accent: {
          DEFAULT: (params) => getColor('--accent', params),
          foreground: (params) => getColor('--accent-foreground', params),
        },
        destructive: {
          DEFAULT: (params) => getColor('--destructive', params),
          foreground: (params) => getColor('--destructive-foreground', params),
        },
        muted: {
          DEFAULT: (params) => getColor('--muted', params),
          foreground: (params) => getColor('--muted-foreground', params),
        },
        card: {
          DEFAULT: (params) => getColor('--card', params),
          foreground: (params) => getColor('--card-foreground', params),
        },
        input: (params) => getColor('--input', params),
        ring: (params) => getColor('--ring', params),
        border: (params) => getColor('--border', params),
        popover: {
          DEFAULT: (params) => getColor('--popover', params),
          foreground: (params) => getColor('--popover-foreground', params),
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
  safelist: ['ff-scrollbar'],
};
