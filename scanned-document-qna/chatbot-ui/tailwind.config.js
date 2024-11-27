/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx}',
        './pages/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',
    ],
    darkMode: 'class',
    theme: {
        keyframes: {
            spin: {
                from: {
                    transform: 'rotate(0deg)',
                },
                to: {
                    transform: 'rotate(360deg)',
                },
            },
            appear: {
                '0%': {opacity: 0, transform: 'translateY(20px)'},
                '100%': {opacity: 1, transform: 'translateY(0)'},
            },
            slideToPosition: {
                '0%': {transform: 'translate(0, 0)'},
                '100%': {transform: 'translateX(var(--tx, 0)) translateY(var(--ty, 0))'},
            },
            'slide-in-fade': {
                '0%': {
                    transform: 'translateY(-100%)',
                    opacity: '0'
                },
                '100%': {
                    transform: 'translateY(0)',
                    opacity: '1'
                },
            },
            'slide-up-fade': {
                '0%': {
                    transform: 'translateY(0%)',
                    opacity: '0'
                },
                '100%': {
                    transform: 'translateY(-10%)',
                    opacity: '1'
                },
            },
            'slide-out-fade': {
                '0%': {
                    transform: 'translateY(0%)',
                    opacity: '1'
                },
                '100%': {
                    transform: 'translateY(-100%)',
                    opacity: '0'
                },
            },
            'show-up-fade': {
                '0%': {
                    transform: 'scale(0)',
                    opacity: '0'
                },
                '100%': {
                    transform: 'scale(100%)',
                    opacity: '1'
                },
            },
        },
        animation: {
            slideToPosition: 'slideToPosition 0.5s forwards',
            'slideOut-fade': 'slide-out-fade 0.5s ease-in forwards',
            'slideIn-fade': 'slide-in-fade 0.5s ease-out forwards',
            'slideUp-fade': 'slide-up-fade 0.5s ease-out forwards',
            'showUp-fade': 'show-up-fade 0.5s ease-out forwards',
            'appear-fast': 'appear 0.5s ease-out forwards',
            'spin-slow': 'spin 3s linear infinite'
        },
    },
    variants: {
        extend: {
            visibility: ['group-hover'],
        },
    },
    plugins: [require('@tailwindcss/typography')],
};
