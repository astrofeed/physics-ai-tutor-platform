import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import colors from "tailwindcss/colors";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['var(--font-geist-sans)', ...defaultTheme.fontFamily.sans],
  			mono: ['var(--font-geist-mono)', ...defaultTheme.fontFamily.mono],
  		},
  		// Modular type scale (ratio 1.25 from a 15px body), each step carrying its
  		// own line-height and tracking so sizes cannot be mixed and matched wrongly.
  		fontSize: {
  			label: ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.14em' }],
  			caption: ['0.75rem', { lineHeight: '1.45' }],
  			body: ['0.9375rem', { lineHeight: '1.6' }],
  			'body-lg': ['1.0625rem', { lineHeight: '1.65' }],
  			subheading: ['1.1875rem', { lineHeight: '1.35', letterSpacing: '-0.01em' }],
  			heading: ['1.4375rem', { lineHeight: '1.3', letterSpacing: '-0.015em' }],
  			title: ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
  			display: ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
  		},
  		spacing: {
  			gutter: '1.5rem',
  			section: '2.5rem',
  		},
  		maxWidth: {
  			// 65 characters keeps prose inside the readable measure
  			measure: '65ch',
  			shell: '78rem',
  		},
  		boxShadow: {
  			hairline: '0 1px 0 0 hsl(var(--border))',
  			raised: '0 1px 2px -1px hsl(30 8% 12% / 0.10), 0 2px 8px -4px hsl(30 8% 12% / 0.08)',
  			overlay: '0 8px 24px -12px hsl(30 8% 12% / 0.24)',
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			gray: colors.stone,
  			neutral: colors.stone,
  			// Hand-built navy scale: cooler than the neutrals so it reads as ink on
  			// warm paper. Used for primary actions, links and chart series 1.
  			brand: {
  				'50': '#f4f6f9',
  				'100': '#e6eaf1',
  				'200': '#c9d2e0',
  				'300': '#a4b2c9',
  				'400': '#7689a8',
  				'500': '#52678a',
  				'600': '#3d4f6d',
  				'700': '#2f3d55',
  				'800': '#253044',
  				'900': '#1d2634',
  				'950': '#131922'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'fade-in': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(4px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			'slide-up': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.3s ease-out forwards',
  			'slide-up': 'slide-up 0.4s ease-out forwards'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};
export default config;
