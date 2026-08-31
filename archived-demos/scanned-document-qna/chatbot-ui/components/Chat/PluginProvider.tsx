import {createContext, ReactNode, useContext, useState} from 'react';

interface PluginContextProps {
    llmType: string | null;
    extractionEngine: string | null;
    setLlmType: (type: string) => void;
    setExtractionEngine: (engine: string) => void;
}

const PluginContext = createContext<PluginContextProps | undefined>(undefined);

export const usePluginContext = () => {
    const context = useContext(PluginContext);
    if (!context) {
        throw new Error('usePluginContext must be used within a PluginProvider');
    }
    return context;
}

export const PluginProvider: React.FC<{ children: ReactNode }> = ({children}) => {
    const [llmType, setLlmType] = useState<string | null>(null);
    const [extractionEngine, setExtractionEngine] = useState<string | null>(null);

    return (
        <PluginContext.Provider value={{llmType, setLlmType, extractionEngine, setExtractionEngine}}>
            {children}
        </PluginContext.Provider>
    );
}
