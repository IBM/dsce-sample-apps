import {FC, useContext, useEffect, useRef, useState} from 'react';

import {useTranslation} from 'next-i18next';

import {useCreateReducer} from '@/hooks/useCreateReducer';

import {getSettings, saveSettings} from '@/utils/app/settings';

import {Settings} from '@/types/settings';

import HomeContext from '@/pages/api/home/home.context';
import {IconCircleCheck, IconCircleKey, IconKey, IconLoader, IconXboxX} from "@tabler/icons-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Props {
    open: boolean;
    onClose: () => void;
}

export const SettingDialog: FC<Props> = ({open, onClose}) => {
    const {t} = useTranslation('settings');
    const settings: Settings = getSettings();
    const {state, dispatch} = useCreateReducer<Settings>({
        initialState: settings,
    });


    const {dispatch: homeDispatch} = useContext(HomeContext);
    const modalRef = useRef<HTMLDivElement>(null);
    const [apiKeyInput, setApiKeyInput] = useState(state.apiKey || '');
    const [saveFlag, setSaveFlag] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    const verifyApiKey = async (apiKey: string) => {
        setIsVerifying(true);
        try {
            const apiKeyParam = JSON.stringify({"apiKey": apiKey})
            const response = await fetch(API_URL + '/api/verify_key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: apiKeyParam,
            });
            const data = await response.json();
            setIsVerified(data.verified);
        } catch (error) {
            console.error('Error verifying API key:', error);
            setIsVerified(false);
        } finally {
            setIsVerifying(false);
        }
    };

    useEffect(() => {
        if (apiKeyInput) {
            verifyApiKey(apiKeyInput);
        }
    }, [apiKeyInput]);


    useEffect(() => {
        if (isVerified) {
            handleSave()
        }
    }, [isVerified])


    const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setIsVerified(false); // Reset verification status on input change
        setApiKeyInput(event.target.value);
    };


    const handleSave = () => {
        dispatch({field: 'apiKey', value: apiKeyInput});
        setSaveFlag(true); // Set flag to indicate a save is required
    };

    useEffect(() => {
        if (saveFlag && isVerified) {
            saveSettings(state); // Save settings when flag is set and state is updated
            setSaveFlag(false); // Reset the flag
            setTimeout(() => {
                onClose();
            }, 450)
        }
    }, [saveFlag, isVerified, state]); // Depend on saveFlag, isVerified, and state


    let mousedownTarget: EventTarget | null = null;

    const handleMousedown = (event: MouseEvent) => {
        mousedownTarget = event.target;
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(mousedownTarget as Node) && !modalRef.current.contains(event.target as Node)) {
            onClose();
        }
    };

    useEffect(() => {
        if (open) {
            document.addEventListener('mousedown', handleMousedown);
            document.addEventListener('mouseup', handleClickOutside);

            return () => {
                document.removeEventListener('mousedown', handleMousedown);
                document.removeEventListener('mouseup', handleClickOutside);
            };
        } else {
            setApiKeyInput(state.apiKey || '')
        }
    }, [open]);
    // Render nothing if the dialog is not open.
    if (!open) {
        return <></>;
    }

    // Render the dialog.
    return (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black bg-opacity-50">
            <div className="fixed inset-0 z-10 overflow-hidden">
                <div
                    className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0 animate-showUp-fade">
                    <div
                        className="hidden sm:inline-block sm:h-screen sm:align-middle"
                        aria-hidden="true"
                    />

                    <div
                        ref={modalRef}
                        className="dark:border-netural-400 inline-block max-h-[400px] transform overflow-y-auto rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
                        role="dialog"
                    >
                        <div className="flex flex-col items-start">
                            {/* Title */}
                            <div className="text-lg pb-4 font-bold text-black dark:text-neutral-200">
                                {t('Settings')}
                            </div>

                            <div className="text-sm font-bold mt-4 mb-2 text-black dark:text-neutral-200">
                                {t('Key Status')}
                            </div>

                            {/* API Key Verification Status */}
                            <div className="mt-2 border p-2 rounded dark:bg-gray-800">
                                {/* Verification Status and Message */}
                                <div className="flex items-center ">
                                    {isVerifying ? (
                                        <>
                                            <p className="font-bold dark:text-neutral-200 mr-4">
                                                Verifying...
                                            </p>
                                            <IconLoader size={35} speed={20} className="animate-spin-slow"/>
                                        </>
                                    ) : isVerified ? (
                                        <>
                                            <p className="font-bold text-green-500 mr-4">
                                                Valid API Key
                                            </p>
                                            <IconCircleCheck size={35} color={'green'}
                                                             className={'animate-appear-fast'}/>
                                        </>
                                    ) : (
                                        <>
                                            <p className={`font-bold ${apiKeyInput === '' ? 'dark:text-neutral-200' : "text-red-500"} mr-4`}>
                                                {apiKeyInput === '' ? "Enter A Valid API Key" : "Bad API Key - Please enter a valid key"}
                                            </p>
                                            {apiKeyInput === '' ? <IconCircleKey size={25}/> :<IconXboxX size={35} color={'red'} className={'animate-appear-fast'}/>}
                                        </>
                                    )}
                                </div>
                            </div>

                        </div>


                        <div className="text-sm font-bold mt-4 mb-2 text-black dark:text-neutral-200">
                            {t('API Key')}
                        </div>

                        <input
                            type="text"
                            className="w-full p-2 border rounded dark:bg-gray-800 text-sm font-bold mb-2 text-black dark:text-neutral-200"
                            placeholder={'Enter your API key'}
                            value={apiKeyInput}
                            onChange={handleApiKeyChange}
                        />


                        {/*<div className="text-sm font-bold mb-2 text-black dark:text-neutral-200">*/}
                        {/*    {t('Theme')}*/}
                        {/*</div>*/}
                        {/**/}
                        {/*<select*/}
                        {/*    className="w-full cursor-pointer bg-transparent p-2 text-neutral-700 dark:text-neutral-200"*/}
                        {/*    value={state.theme}*/}
                        {/*    onChange={(event) =>*/}
                        {/*        dispatch({field: 'theme', value: event.target.value})*/}
                        {/*    }*/}
                        {/*>*/}
                        {/*    <option value="dark">{t('Dark mode')}</option>*/}
                        {/*    <option value="light">{t('Light mode')}</option>*/}
                        {/*</select>*/}

                        <button
                            disabled={!isVerified}
                            type="button"
                            className={`w-full ${!isVerified && "cursor-not-allowed"} px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300`}
                            onClick={(event) => {
                                event.stopPropagation();
                                handleSave();
                                onClose();
                            }}
                        >
                            {t('Save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
