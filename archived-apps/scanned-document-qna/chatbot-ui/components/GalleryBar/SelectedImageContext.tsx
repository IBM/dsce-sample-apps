import React, { createContext, useContext, useState } from 'react';

interface SelectedImageContextProps {
  selectedImage: string | null;
  setSelectedImage: React.Dispatch<React.SetStateAction<string | null>>;
}

const SelectedImageContext = createContext<SelectedImageContextProps | undefined>(undefined);

export const useSelectedImage = () => {
  const context = useContext(SelectedImageContext);
  if (!context) {
    throw new Error('useSelectedImage must be used within a SelectedImageProvider');
  }
  return context;
};

interface SelectedImageProviderProps {
    children: React.ReactNode;
}

export const SelectedImageProvider: React.FC<SelectedImageProviderProps> = ({ children }) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    return (
        <SelectedImageContext.Provider value={{ selectedImage, setSelectedImage }}>
            {children}
        </SelectedImageContext.Provider>
    );
};
