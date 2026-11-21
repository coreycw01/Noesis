
import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // The two label steps the app's eyebrows use. Everything else matches
      // Tailwind's own scale, which the CSS tokens now mirror exactly, so a
      // size means the same thing whether it is set in CSS or in a class.
      fontSize: {
        'label-sm': ['var(--text-label-sm)', { lineHeight: '1.2' }],
        label: ['var(--text-label)', { lineHeight: '1.2' }],
      },
      fontFamily: {
        body: ['var(--font-body)', 'Georgia', 'serif'],
        headline: ['var(--font-heading)', 'serif'],
        interface: ['var(--font-interface)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        code: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          muted: 'hsl(var(--accent-muted))',
          border: 'hsl(var(--accent-border))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          elevated: 'hsl(var(--surface-elevated))',
        },
        'page-tint': 'hsl(var(--page-tint))',
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Semantic status. Meaning, not hue: use these instead of red-500 etc.
        ok: 'hsl(var(--ok) / <alpha-value>)',
        caution: 'hsl(var(--caution) / <alpha-value>)',
        problem: 'hsl(var(--problem) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)',
        neutral: 'hsl(var(--neutral) / <alpha-value>)',
        // The current element's tone (set by data-tone / data-stage-tone).
        tone: 'hsl(var(--tone, var(--accent)) / <alpha-value>)',
        stage: {
          DEFAULT: 'hsl(var(--stage, var(--accent)) / <alpha-value>)',
          encounter: 'hsl(var(--stage-encounter) / <alpha-value>)',
          outline: 'hsl(var(--stage-outline) / <alpha-value>)',
          examine: 'hsl(var(--stage-examine) / <alpha-value>)',
          claim: 'hsl(var(--stage-claim) / <alpha-value>)',
          act: 'hsl(var(--stage-act) / <alpha-value>)',
          integrate: 'hsl(var(--stage-integrate) / <alpha-value>)',
          more: 'hsl(var(--stage-more) / <alpha-value>)',
        },
        paper: {
          DEFAULT: 'hsl(var(--paper-white))',
          warm: 'hsl(var(--paper-warm))',
          sepia: 'hsl(var(--paper-sepia))',
          'ink-sepia': 'hsl(var(--paper-ink-sepia))',
          dark: 'hsl(var(--paper-dark))',
          'ink-dark': 'hsl(var(--paper-ink-dark))',
          'ink-light': 'hsl(var(--paper-ink-light))',
        },
        brand: {
          paper: 'hsl(var(--brand-paper))',
          mark: 'hsl(var(--brand-mark))',
        },
        kind: {
          source: 'hsl(var(--kind-source) / <alpha-value>)',
          annotation: 'hsl(var(--kind-annotation) / <alpha-value>)',
          concept: 'hsl(var(--kind-concept) / <alpha-value>)',
          inquiry: 'hsl(var(--kind-inquiry) / <alpha-value>)',
          position: 'hsl(var(--kind-position) / <alpha-value>)',
          practice: 'hsl(var(--kind-practice) / <alpha-value>)',
          work: 'hsl(var(--kind-work) / <alpha-value>)',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--card-radius)',
        md: 'calc(var(--card-radius) - 2px)',
        sm: 'calc(var(--card-radius) - 4px)',
        card: 'var(--card-radius)',
        button: 'var(--button-radius)',
        panel: 'var(--radius-md)',
        'panel-lg': 'var(--radius-lg)',
        control: 'var(--radius-sm)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
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
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
