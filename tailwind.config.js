const plugin = require('tailwindcss/plugin');
const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./views/**/*.{handlebars,html,js}', './views/home.handlebars'],
  theme: {
    colors: {
      brand_red: '#b71234',
      brand_black: '#282627',
      brand_grey: '545153',
      primary: colors.red,
      secondary: colors.stone,
      white: colors.white,
      // from there begins the right color palette
      neutral: {
        DEFAULT: '#40464D',
        100: '#E7E9EC',
        200: '#D4D6D8',
        300: '#BBC0C5',
      },
    },
    fontSize: {
      sm: '0.833rem',
      base: '1rem',
      md: '1.2rem',
      lg: '1.44rem',
      xl: '1.728rem',
      xxl: '2.074rem',
      xxxl: '2.488rem',
    },
    extend: {
      fontFamily: {
        sans: ['Montserrat', ...defaultTheme.fontFamily.sans],
        serif: ['Zilla Slab', ...defaultTheme.fontFamily.serif],
      },
    },
  },
  plugins: [
    plugin(({ addBase, theme }) => {
      addBase({
        html: { fontSize: '18px' },
        h1: {
          fontSize: theme('fontSize.xxxl'),
          fontWeight: '700',
          lineHeight: '1.2',
          marginTop: '1.25rem',
          marginBottom: '1.25rem',
        },
        h2: {
          fontSize: theme('fontSize.xxl'),
          fontWeight: '700',
          lineHeight: '1.1',
          marginTop: '1.25rem',
          marginBottom: '1.25rem',
        },
        h3: {
          fontSize: theme('fontSize.xl'),
          fontWeight: '700',
          marginTop: '1.25rem',
          marginBottom: '1.25rem',
        },
        h4: {
          fontSize: theme('fontSize.xl'),
          fontWeight: '600',
          lineHeight: '1.5rem',
          marginTop: '1.25rem',
          marginBottom: '1.25rem',
        },
        h5: {
          fontSize: theme('fontSize.lg'),
          fontWeight: '600',
          lineHeight: '1.5rem',
          marginTop: '1.25rem',
          marginBottom: '1.25rem',
        },
        h6: {
          fontWeight: '600',
          marginTop: '1.25rem',
        },
        p: {
          marginBottom: '1.25rem',
          marginTop: '1.25rem',
        },
      });
    }),
  ],
};
