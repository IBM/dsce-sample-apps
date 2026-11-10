import React from 'react';

interface BoxLogoProps {
  className?: string;
  color?: string;
}

/**
 * Box wordmark (lowercase "box" in Box blue). Scales with the font size set via className.
 */
export const BoxLogo: React.FC<BoxLogoProps> = ({
  className = "text-2xl",
  color = "#0061d5",
}) => {
  return (
    <span
      role="img"
      aria-label="Box Logo"
      className={`inline-block font-black lowercase tracking-tighter leading-none select-none ${className}`}
      style={{ color }}
    >
      box
    </span>
  );
};
