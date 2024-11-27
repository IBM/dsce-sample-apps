import {IconKey} from '@tabler/icons-react';
import {KeyboardEvent, useContext, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import HomeContext from '@/pages/api/home/home.context';

import {SidebarButton} from '@/components/Sidebar/SidebarButton';

import ChatbarContext from '../Chatbar.context';

export const PluginKeys = () => {
    const {t} = useTranslation('sidebar');

    const {
        state: {pluginKeys},
    } = useContext(HomeContext);

    const {handlePluginKeyChange, handleClearPluginKey} =
        useContext(ChatbarContext);

    const [isChanging, setIsChanging] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);

    const handleEnter = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            setIsChanging(false);
        }
    };

    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                window.addEventListener('mouseup', handleMouseUp);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            window.removeEventListener('mouseup', handleMouseUp);
            setIsChanging(false);
        };

        window.addEventListener('mousedown', handleMouseDown);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);

    return (
        <>
            <SidebarButton
                text={t('Plugin Keys')}
                icon={<IconKey size={18}/>}
                onClick={() => setIsChanging(true)}
            />

            {isChanging && (
                <div
                    className="z-100 fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
                    onKeyDown={handleEnter}
                >
                    <div className="fixed inset-0 z-10 overflow-hidden">
                        <div
                            className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div
                                className="hidden sm:inline-block sm:h-screen sm:align-middle"
                                aria-hidden="true"
                            />

                            <div
                                ref={modalRef}
                                className="dark:border-netural-400 inline-block max-h-[400px] transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
                                role="dialog"
                            >
                                <div className="mb-10 text-4xl">Plugin Keys</div>

                                <div className="mt-6 rounded border p-4">
                                    <div className="text-xl font-bold">Google Search Plugin</div>
                                    <div className="mt-4 italic">
                                        Please enter your Google API Key and Google CSE ID to enable
                                        the Google Search Plugin.
                                    </div>

                                    <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                        Google API Key
                                    </div>

                                    <div className="mt-6 text-sm font-bold text-black dark:text-neutral-200">
                                        Google CSE ID
                                    </div>
                                    <input
                                        className="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                                        type="password"
                                        value={
                                            ''
                                        }
                                        onChange={(e) => {

                                        }}
                                    />

                                    <button
                                        className="mt-6 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                        onClick={() => {
                                        }}
                                    >
                                        Clear Google Search Plugin Keys
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="mt-6 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300"
                                    onClick={() => setIsChanging(false)}
                                >
                                    {t('Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
