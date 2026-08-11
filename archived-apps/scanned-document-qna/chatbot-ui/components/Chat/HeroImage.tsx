import { useEffect, useState } from 'react';
import { API_URL } from './Chat';

export const HeroImage = () => {

    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (event: any) => {
            setCursorPosition({
                x: event.clientX,
                y: event.clientY,
            });
        };

        document.addEventListener('mousemove', handleMouseMove);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    const parallaxEffect = (depth = 0.05) => {
        return {
            transform: `translate(${cursorPosition.x * depth}px, ${cursorPosition.y * depth}px)`,
        };
    };
    return (
        <>
            <div style={parallaxEffect(0.02)} className="absolute top-[50%] left-[50%] z-20 transition-transform duration-500 ease-out" id="element1">
                <img src={API_URL + `/static/assets/Element1.svg`} alt="Element 1" />
            </div>

            <div style={parallaxEffect(0.03)} className="absolute top-[28%] left-[20%] z-10 transition-transform duration-500 ease-out" id="element2">
                <img src={API_URL + `/static/assets/Element2.svg`} alt="Element 2" />
            </div>

            <div style={parallaxEffect(0.01)} className="absolute top-[15%] left-[25%] z-0 transition-transform duration-500 ease-out" id="element3">
                <img src={API_URL + `/static/assets/Element3.svg`} alt="Element 3" />
            </div>

            <div style={parallaxEffect(0.04)} className="absolute top-[55%] left-[10%] z-10 transition-transform duration-500 ease-out" id="element4">
                <img src={API_URL + `/static/assets/Element4.svg`} alt="Element 4" />
            </div>
        </>
    );
};
