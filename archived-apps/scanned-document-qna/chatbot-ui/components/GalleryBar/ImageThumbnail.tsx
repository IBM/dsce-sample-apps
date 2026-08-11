import React, {useState} from 'react';

interface Props {
    src: string;
    alt: string;
}

export const ImageThumbnail: React.FC<Props> = ({ src, alt }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isActive, setIsActive] = useState(false);

    return (
        <div className="flex justify-center items-center h-full bg-opacity-75 bg-[#343541]">
            <img
                className={`transition-transform transition-shadow transform scale-100 shadow-md max-h-40 min-w-36 cursor-pointer ${isHovered ? 'scale-105 shadow-lg border-2 border-gray-300' : ''} ${isActive ? 'scale-110 shadow-xl border-2 border-blue-500' : ''}`}
                src={src}
                alt={alt}
                onMouseOver={() => setIsHovered(true)}
                onMouseOut={() => setIsHovered(false)}
                onClick={() => setIsActive(!isActive)}
            />
        </div>
    );
};
