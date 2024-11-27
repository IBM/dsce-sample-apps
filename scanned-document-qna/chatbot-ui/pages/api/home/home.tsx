import {useCallback, useEffect, useRef, useState} from 'react';
import Head from 'next/head';

import {useCreateReducer} from '@/hooks/useCreateReducer';

import useErrorService from '@/services/errorService';
import useApiService from '@/services/useApiService';

import {cleanConversationHistory, cleanSelectedConversation,} from '@/utils/app/clean';
import {DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE} from '@/utils/app/const';
import {saveConversation, saveConversations, updateConversation,} from '@/utils/app/conversation';
import {saveFolders} from '@/utils/app/folders';
import {savePrompts} from '@/utils/app/prompts';
import {getSettings} from '@/utils/app/settings';

import {Conversation} from '@/types/chat';
import {KeyValuePair} from '@/types/data';
import {FolderInterface, FolderType} from '@/types/folder';
import {fallbackModelID, OpenAIModelID, OpenAIModels} from '@/types/openai';
import {Prompt} from '@/types/prompt';

import {Chat} from '@/components/Chat/Chat';

import HomeContext from './home.context';
import {HomeInitialState, initialState} from './home.state';

import {v4 as uuidv4} from 'uuid';
import {ImageGallery} from "@/components/GalleryBar/ImageGallery";
import {useSelectedImage} from '@/components/GalleryBar/SelectedImageContext';
import {ImageCanvas} from "@/components/GalleryBar/ImageCanvas";
import {PluginProvider} from "@/components/Chat/PluginProvider";
import {Chatbar} from "@/components/Chatbar/Chatbar";
import {IconX} from "@tabler/icons-react";

interface Props {
    serverSideApiKeyIsSet: boolean;
    serverSidePluginKeysSet: boolean;
    defaultModelId: OpenAIModelID;
}

const Home = ({
                  serverSideApiKeyIsSet,
                  serverSidePluginKeysSet,
                  defaultModelId,
              }: Props) => {
    const t = (s: string) => s
    const {getModels} = useApiService();
    const {getModelsError} = useErrorService();
    const [initialRender, setInitialRender] = useState<boolean>(true);
    const [isGalleryVisible, setIsGalleryVisible] = useState(false);
    const contextValue = useCreateReducer<HomeInitialState>({
        initialState,
    });
    const [isButtonVisible, setIsButtonVisible] = useState(true);
    const {selectedImage} = useSelectedImage();

    defaultModelId =
        (process.env.DEFAULT_MODEL &&
            Object.values(OpenAIModelID).includes(
                process.env.DEFAULT_MODEL as OpenAIModelID,
            ) &&
            process.env.DEFAULT_MODEL as OpenAIModelID) ||
        fallbackModelID;

    serverSidePluginKeysSet = false;

    const {
        state: {
            apiKey,
            lightMode,
            folders,
            conversations,
            selectedConversation,
            prompts,
            temperature,
        },
        dispatch,
    } = contextValue;

    const stopConversationRef = useRef<boolean>(false);

    const toggleGallery = useCallback(() => {
        setIsGalleryVisible(!isGalleryVisible);
    },[isGalleryVisible]);

    const handleButtonClick = () => {
        setIsButtonVisible(false);
    };

    useEffect(() => {
        setInitialRender(false)
    }, [])

    // FETCH MODELS ----------------------------------------------

    const handleSelectConversation = (conversation: Conversation) => {
        dispatch({
            field: 'selectedConversation',
            value: conversation,
        });

        saveConversation(conversation);
    };

    // FOLDER OPERATIONS  --------------------------------------------

    const handleCreateFolder = (name: string, type: FolderType) => {
        const newFolder: FolderInterface = {
            id: uuidv4(),
            name,
            type,
        };

        const updatedFolders = [...folders, newFolder];

        dispatch({field: 'folders', value: updatedFolders});
        saveFolders(updatedFolders);
    };

    const handleDeleteFolder = (folderId: string) => {
        const updatedFolders = folders.filter((f) => f.id !== folderId);
        dispatch({field: 'folders', value: updatedFolders});
        saveFolders(updatedFolders);

        const updatedConversations: Conversation[] = conversations.map((c) => {
            if (c.folderId === folderId) {
                return {
                    ...c,
                    folderId: null,
                };
            }

            return c;
        });

        dispatch({field: 'conversations', value: updatedConversations});
        saveConversations(updatedConversations);

        const updatedPrompts: Prompt[] = prompts.map((p) => {
            if (p.folderId === folderId) {
                return {
                    ...p,
                    folderId: null,
                };
            }

            return p;
        });

        dispatch({field: 'prompts', value: updatedPrompts});
        savePrompts(updatedPrompts);
    };

    const handleUpdateFolder = (folderId: string, name: string) => {
        const updatedFolders = folders.map((f) => {
            if (f.id === folderId) {
                return {
                    ...f,
                    name,
                };
            }

            return f;
        });

        dispatch({field: 'folders', value: updatedFolders});

        saveFolders(updatedFolders);
    };

    // CONVERSATION OPERATIONS  --------------------------------------------

    const handleNewConversation = () => {
        const lastConversation = conversations[conversations.length - 1];

        const newConversation: Conversation = {
            id: uuidv4(),
            name: t('New Conversation'),
            messages: [],
            model: lastConversation?.model || {
                id: OpenAIModels[defaultModelId].id,
                name: OpenAIModels[defaultModelId].name,
                maxLength: OpenAIModels[defaultModelId].maxLength,
                tokenLimit: OpenAIModels[defaultModelId].tokenLimit,
            },
            prompt: DEFAULT_SYSTEM_PROMPT,
            temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
            folderId: null,
        };

        const updatedConversations = [...conversations, newConversation];

        dispatch({field: 'selectedConversation', value: newConversation});
        dispatch({field: 'conversations', value: updatedConversations});

        saveConversation(newConversation);
        saveConversations(updatedConversations);

        dispatch({field: 'loading', value: false});
    };

    const handleNewConversationWithName = (name: string) => {
        const lastConversation = conversations[conversations.length - 1];

        const newConversation: Conversation = {
            id: uuidv4(),
            name: t(name),
            messages: [],
            model: lastConversation?.model || {
                id: OpenAIModels[defaultModelId].id,
                name: OpenAIModels[defaultModelId].name,
                maxLength: OpenAIModels[defaultModelId].maxLength,
                tokenLimit: OpenAIModels[defaultModelId].tokenLimit,
            },
            prompt: DEFAULT_SYSTEM_PROMPT,
            temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
            folderId: null,
        };

        const updatedConversations = [...conversations, newConversation];

        dispatch({field: 'selectedConversation', value: newConversation});
        dispatch({field: 'conversations', value: updatedConversations});

        saveConversation(newConversation);
        saveConversations(updatedConversations);

        dispatch({field: 'loading', value: false});
    };


    const handleUpdateConversation = (
        conversation: Conversation,
        data: KeyValuePair,
    ) => {
        const updatedConversation = {
            ...conversation,
            [data.key]: data.value,
        };

        const {single, all} = updateConversation(
            updatedConversation,
            conversations,
        );

        dispatch({field: 'selectedConversation', value: single});
        dispatch({field: 'conversations', value: all});
    };

    // EFFECTS  --------------------------------------------

    useEffect(() => {
        if (window.innerWidth < 640) {
            dispatch({field: 'showChatbar', value: false});
        }
    }, [dispatch, selectedConversation]);

    useEffect(() => {
        defaultModelId &&
        dispatch({field: 'defaultModelId', value: defaultModelId});
        serverSideApiKeyIsSet &&
        dispatch({
            field: 'serverSideApiKeyIsSet',
            value: serverSideApiKeyIsSet,
        });
        serverSidePluginKeysSet &&
        dispatch({
            field: 'serverSidePluginKeysSet',
            value: serverSidePluginKeysSet,
        });
    }, [defaultModelId, dispatch, serverSideApiKeyIsSet, serverSidePluginKeysSet]);

    // ON LOAD --------------------------------------------

    useEffect(() => {
        const settings = getSettings();
        if (settings.theme) {
            dispatch({
                field: 'lightMode',
                value: settings.theme,
            });
        }

        const apiKey = localStorage.getItem('apiKey');
        if (serverSideApiKeyIsSet) {
            dispatch({field: 'apiKey', value: ''});
            localStorage.removeItem('apiKey');
        } else if (apiKey) {
            dispatch({field: 'apiKey', value: apiKey});
        }

        const pluginKeys = localStorage.getItem('pluginKeys');
        if (serverSidePluginKeysSet) {
            dispatch({field: 'pluginKeys', value: []});
            localStorage.removeItem('pluginKeys');
        } else if (pluginKeys) {
            dispatch({field: 'pluginKeys', value: pluginKeys});
        }

        if (window.innerWidth < 640) {
            dispatch({field: 'showChatbar', value: false});
            dispatch({field: 'showPromptbar', value: false});
        }

        const showChatbar = localStorage.getItem('showChatbar');
        if (showChatbar) {
            // dispatch({field: 'showChatbar', value: showChatbar === 'true'});
        }

        const showPromptbar = localStorage.getItem('showPromptbar');
        if (showPromptbar) {
            dispatch({field: 'showPromptbar', value: showPromptbar === 'true'});
        }

        const folders = localStorage.getItem('folders');
        if (folders) {
            dispatch({field: 'folders', value: JSON.parse(folders)});
        }

        const prompts = localStorage.getItem('prompts');
        if (prompts) {
            dispatch({field: 'prompts', value: JSON.parse(prompts)});
        }

        // For the conversationHistory, compare before dispatching
        const conversationHistory = localStorage.getItem('conversationHistory');
        if (conversationHistory) {
            const parsedConversationHistory: Conversation[] = JSON.parse(conversationHistory);
            const cleanedConversationHistory = cleanConversationHistory(parsedConversationHistory);

            if (JSON.stringify(cleanedConversationHistory) !== JSON.stringify(conversations)) {
                dispatch({field: 'conversations', value: cleanedConversationHistory});
            }
        }
    }, []);

    useEffect(() => {
        const selectedConversation = localStorage.getItem('selectedConversation');
        if (selectedConversation) {
            const parsedSelectedConversation: Conversation =
                JSON.parse(selectedConversation);
            const cleanedSelectedConversation = cleanSelectedConversation(parsedSelectedConversation);

            dispatch({
                field: 'selectedConversation',
                value: cleanedSelectedConversation,
            });
        } else {
            const lastConversation = conversations[conversations.length - 1];
            dispatch({
                field: 'selectedConversation',
                value: {
                    id: uuidv4(),
                    name: t('New Conversation'),
                    messages: [],
                    model: OpenAIModels[defaultModelId],
                    prompt: DEFAULT_SYSTEM_PROMPT,
                    temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
                    folderId: null,
                },
            });
        }
    }, [defaultModelId]);

    const galleryStyle = `flex transition-all duration-500 ease-in-out overflow-hidden ${isGalleryVisible ? 'w-1/6' : 'w-0'} max-h-90vh`;


    useEffect(() => {
        if (selectedImage) {
            toggleGallery()
        }
    }, [selectedImage])


    return (
        <HomeContext.Provider
            value={{
                ...contextValue,
                handleNewConversation,
                handleCreateFolder,
                handleDeleteFolder,
                handleUpdateFolder,
                handleSelectConversation,
                handleUpdateConversation,
            }}
        >
            <PluginProvider>
                <Head>
                    <title>Scanned document Q&A</title>
                    <meta name="description" content="ChatGPT but better."/>
                    <meta
                        name="viewport"
                        content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
                    />
                    <link rel="icon" href="/favicon.ico"/>
                </Head>
                {selectedConversation && (
                    <main
                        className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
                    >
                        <div className="h-full w-full bg-[#343541]">

                            {/* Navbar div */}
                            <Chatbar/>

                            <div
                                className={`flex flex-1 w-full transition-all duration-500 ${isGalleryVisible ? '' : 'expanded'}`}
                                style={{
                                    marginTop: "67px",
                                    minHeight: "calc(100vh - 67px - 72px)",
                                    maxHeight: "calc(100vh - 67px - 72px)"
                                }}>


                                {
                                    <div
                                        className={`fixed inset-0 z-10 flex ${selectedImage ? 'w-[35.5vw]' : 'w-1/2'} h-full ${!isGalleryVisible ? 'animate-slideOut-fade' : 'animate-slideIn-fade'}`}
                                        style={{
                                            maxHeight: "83vh",
                                            backgroundColor: "#343541",
                                            top: "75px",
                                            zIndex: 20,
                                            left: "0%",
                                            padding: '20px'
                                        }}
                                    ><ImageGallery onClose={<div style={{zIndex: 0}}>
                                        <button
                                            className={`${isGalleryVisible ? '' : 'hidden'}  transition-transform duration-500 transform hover:scale-110 hover:opacity-110  animate-showUp-fade`}
                                            onClick={toggleGallery}
                                            style={{
                                                position: 'relative', // The button is absolutely positioned.
                                                top: '5px', // For example, 10px from the top of the nearest relative parent.
                                                left: '10px', // For example, 10px from the right of the nearest relative parent.
                                                zIndex: 2, // Ensure it floats above other items.
                                            }}
                                        >
                                            <IconX
                                                className={"transition-transform duration-500 transform hover:scale-110 hover:opacity-110"}
                                                size={30}/>
                                        </button>
                                    </div>} onImageChange={handleNewConversationWithName}/>
                                    </div>
                                }


                                <div className={`z-0 ${selectedImage ? "w-1/3" : "w-0"}`} style={{cursor: 'move'}}>
                                    <ImageCanvas onClose={<></>} toggleGallery={toggleGallery}/>
                                </div>

                                <div
                                    className={`flex flex-1 transition-all duration-500 ease-in-out ${isGalleryVisible ? (selectedImage ? "w-2/3" : 'w-full') : 'w-[66vw]'} `}>
                                    <Chat stopConversationRef={stopConversationRef} toggleGallery={toggleGallery}/>
                                </div>
                            </div>

                            <footer className='bg-[#262626] text-[16px] text-[#c6c6c6] px-4' style={{maxHeight:"72px", overflow:"auto"}}>
                                <div className='p-4'>
                                Do not input personal data, or data that is sensitive or confidential into demo app. This app is built using the watsonx.ai SDK and may include systems and methods pending patent with the USPTO, protected under US Patent Laws. &#169; Copyright IBM Corporation
                                </div>
                            </footer>

                        </div>

                    </main>
                )}
            </PluginProvider>
        </HomeContext.Provider>
    );
};
export default Home;