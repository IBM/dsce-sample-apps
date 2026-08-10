import React, {FC, useContext, useEffect, useState} from 'react';
import {useTranslation} from 'next-i18next';
import {getPluginFromKey, Plugin, PluginKey, PluginList} from '@/types/plugin';
import HomeContext from "@/pages/api/home/home.context";

const NEXT_PUBLIC_HIDE_DROPDOWN = process.env.NEXT_PUBLIC_HIDE_DROPDOWN || '';


interface Props {
    onPluginChange: (plugins: Plugin[]) => void;
    onClose: () => void;
}

function arePluginsEqual(arr1: Plugin[], arr2: Plugin[]) {
    if (arr1.length !== arr2.length) return false;
    const sortedArr1 = arr1.map(p => p.id).sort();
    const sortedArr2 = arr2.map(p => p.id).sort();
    return sortedArr1.every((value, index) => value === sortedArr2[index]);
}

export const PluginSelect: FC<Props> = ({
                                            onPluginChange,
                                            onClose
                                        }) => {
    const {
        state: {pluginKeys},
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const {t} = useTranslation('chat');

    const uniqueModels = Array.from(new Set(PluginList.map(p => p.id.split('@')[0])));
    const uniqueExtractions = Array.from(new Set(PluginList.map(p => p.extractionEngine.toLowerCase())));
    const defaultModel = uniqueModels[0];
    const defaultExtraction = uniqueExtractions[0];
    const [isDropdownOpen, setDropdownOpen] = useState(false);

    // Retrieve state from localStorage or use default
    const savedModels = JSON.parse(localStorage.getItem('selectedModels') || '[]');
    const savedExtractions = JSON.parse(localStorage.getItem('selectedExtractions') || '[]');
    const [selectedModels, setSelectedModels] = useState<string[]>(savedModels.length ? savedModels : [defaultModel]);
    const [selectedExtractions, setSelectedExtractions] = useState<string[]>(savedExtractions.length ? savedExtractions : uniqueExtractions);
    const [currentPlugins, setCurrentPlugins] = useState<Plugin[]>(pluginKeys.map(pk => getPluginFromKey(pk)));

    const handlePluginKeyChange = (pluginKey: PluginKey) => {
        if (pluginKeys.some((key) => key.pluginId === pluginKey.pluginId)) {
            const updatedPluginKeys = pluginKeys.map((key) => {
                if (key.pluginId === pluginKey.pluginId) {
                    return pluginKey;
                }

                return key;
            });

            homeDispatch({field: 'pluginKeys', value: updatedPluginKeys});

            localStorage.setItem('pluginKeys', JSON.stringify(updatedPluginKeys));
        } else {
            homeDispatch({field: 'pluginKeys', value: [...pluginKeys, pluginKey]});

            localStorage.setItem(
                'pluginKeys',
                JSON.stringify([...pluginKeys, pluginKey]),
            );
        }
    };

    useEffect(() => {
        const clearLocalStorage = () => {
            localStorage.removeItem('selectedModels');
            localStorage.removeItem('selectedExtractions');

            // Reset state
            setSelectedModels([defaultModel]);
            setSelectedExtractions(uniqueExtractions);
        };

        window.addEventListener('beforeunload', clearLocalStorage);

        return () => {
            window.removeEventListener('beforeunload', clearLocalStorage);
        };
    }, []);


    useEffect(() => {
        localStorage.setItem('selectedModels', JSON.stringify(selectedModels));
    }, [selectedModels]);

    useEffect(() => {
        localStorage.setItem('selectedExtractions', JSON.stringify(selectedExtractions));
    }, [selectedExtractions]);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (!event.target) return;
            // Assuming your component's root element has the id 'plugin-select'
            const el = document.getElementById('plugin-select');
            if (!el || (el && !el.contains(event.target as Node))) {
                onClose();  // Call the passed-in `onClose` function
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [onClose]);

    useEffect(() => {
        const newSelectedPlugins: Plugin[] = [];
        for (const model of selectedModels) {
            for (const extraction of selectedExtractions) {
                const pluginId = `${model}@${extraction}`;
                const matchingPlugin = PluginList.find(p => p.id === pluginId);
                if (matchingPlugin) {
                    newSelectedPlugins.push(matchingPlugin);
                }
            }
        }

        homeDispatch({
            field: 'pluginKeys', value: newSelectedPlugins.map(sp => ({
                pluginId: sp.id,
                requiredKeys: []
            } as PluginKey))
        });

        if (!arePluginsEqual(newSelectedPlugins, currentPlugins)) {
            onPluginChange(newSelectedPlugins);
            setCurrentPlugins(newSelectedPlugins);
            let message = "Currently Selected:\n";
            newSelectedPlugins.forEach(plugin => message += plugin.id + "\n")
            // toast(message)
        }

    }, [selectedModels, selectedExtractions, onPluginChange, currentPlugins, homeDispatch]);

    const [selectedCountLabel, setSelectedCountLabel] = useState<any>('Select Models');

    useEffect(() => {
        setSelectedCountLabel(
            <span className="flex items-center space-x-2 mr-15">
            <span className="bg-white text-black rounded-full w-6 h-6 flex items-center justify-center">
                {selectedModels.length}x
            </span>
                {selectedModels.length === 1
                    ? <span className='text-white font-bold'>{selectedModels[0]}</span> // Display the name of the single selected model
                    : <span className='text-white font-bold'>Models</span> // Display "Models" when multiple are selected
                }
        </span>
        );
    }, [selectedModels]);

    // JSX for the component
    return (
        <div id="plugin-select" className={`${NEXT_PUBLIC_HIDE_DROPDOWN} flex space-x-5 z-50`}>
            <div className="relative inline-block group">
                <div className={"flex"}>
                    <span className={"flex items-center space-x-2 font-bold whitespace-nowrap mr-2"}>LLM Model</span>
                    <button
                        className="bg-black border-b border-gray-500 text-gray-400 px-6 py-2 text-sm font-medium rounded cursor-pointer hover:bg-gray-500 hover:border-gray-600 focus:outline-none focus:border-blue-600 focus:ring focus:ring-blue-300 focus:ring-opacity-50 flex items-center space-x-2 whitespace-nowrap"
                        onClick={() => setDropdownOpen(!isDropdownOpen)}>
                        {typeof selectedCountLabel === 'string' ?
                            <span>{selectedCountLabel}</span> : selectedCountLabel}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20"
                             fill="white" aria-hidden="true">
                            <path fillRule="evenodd"
                                  d="M6.293 9.293a1 1 0 011.414 0L10 11.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                  clipRule="evenodd"/>
                        </svg>
                    </button>
                </div>
                <div
                    className={`absolute top-full left-0 bg-black shadow-lg w-72 rounded ${isDropdownOpen ? 'block' : 'group-hover:block'} hidden border-t border `}
                    style={{zIndex: 90000}}>
                    <h4 className="text-white text-lg py-2 px-4 shadow-sm font-bold">{t('Select a model ✨')}</h4>
                    {uniqueModels.map(model => (
                        <label
                            className="block text-white font-bold px-4 py-2 cursor-pointer flex items-center space-x-2 hover:bg-gray-500 transition-colors duration-200"
                            key={model}>
                            <input
                                type="checkbox"
                                className="form-checkbox text-blue-500"
                                value={model}
                                checked={selectedModels.includes(model)}
                                onChange={() => {
                                    const updatedModels = selectedModels.includes(model)
                                        ? selectedModels.filter(m => m !== model)
                                        : [...selectedModels, model];
                                    setSelectedModels(updatedModels.length ? updatedModels : [defaultModel]);
                                }}
                            />
                            <span className="pl-10">{model}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="hidden">
                {uniqueExtractions.map(extraction => (
                    <label
                        className="block text-black px-4 py-2 cursor-pointer flex items-center space-x-2 hover:bg-gray-200 transition-colors duration-200"
                        key={extraction}>
                        <input
                            type="checkbox"
                            className="form-checkbox text-blue-500"
                            value={extraction}
                            checked={selectedExtractions.includes(extraction)}
                            onChange={() => {
                                const updatedExtractions = selectedExtractions.includes(extraction)
                                    ? selectedExtractions.filter(e => e !== extraction)
                                    : [...selectedExtractions, extraction];
                                setSelectedExtractions(updatedExtractions.length ? updatedExtractions : [defaultExtraction]);
                            }}
                        />
                        <span className="pl-10">{extraction == 'langchain' ? 'Tesseract + PDFMiner' : 'WDU'}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

export default PluginSelect;
