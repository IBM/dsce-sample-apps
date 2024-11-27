import {memo, MutableRefObject, useCallback, useContext, useEffect, useRef, useState,} from 'react';
import toast from 'react-hot-toast';

import {useTranslation} from 'next-i18next';

import {getEndpoint} from '@/utils/app/api';
import {throttle} from '@/utils/data/throttle';

import {ChatBody, Conversation, Message} from '@/types/chat';
import {Plugin} from '@/types/plugin';

import HomeContext from '@/pages/api/home/home.context';
import {useSelectedImage} from "@/components/GalleryBar/SelectedImageContext";
import {Settings} from "@/types/settings";
import {getSettings} from "@/utils/app/settings";
import {IconSettings} from "@tabler/icons-react";
import {SettingDialog} from "@/components/Settings/SettingDialog";
import {ChatInput} from "@/components/Chat/ChatInput";
import {MemoizedChatMessage} from "@/components/Chat/MemoizedChatMessage";
import { ChatSuggestion } from './ChatSuggestion';
import { useSuggestion } from '@/hooks/useSuggestion';
import { HeroImage } from './HeroImage';

interface Props {
    stopConversationRef: MutableRefObject<boolean>;
    toggleGallery: any;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL;
const NEXT_PUBLIC_HIDE_DROPDOWN = process.env.NEXT_PUBLIC_HIDE_DROPDOWN || '';
const NEXT_PUBLIC_DISABLE_TESSERACT = process.env.NEXT_PUBLIC_DISABLE_TESSERACT === 'active' || false;
const IS_SUGGESTION_ENABLED = Boolean(process.env.NEXT_PUBLIC_IS_SUGGESTION_ENABLED == "true")

export const Chat = memo(({stopConversationRef, toggleGallery}: Props) => {
    const {t} = useTranslation('chat');
    const {selectedImage} = useSelectedImage();

    const {suggestion} = useSuggestion(selectedImage)

    const {
        state: {
            selectedConversation,
            conversations,
            models,
            apiKey,
            pluginKeys,
            serverSideApiKeyIsSet,
            messageIsStreaming,
            modelError,
            loading,
            prompts
        },
        handleUpdateConversation,
        dispatch: homeDispatch,
    } = useContext(HomeContext);


    const settings: Settings = getSettings();

    const [currentMessage, setCurrentMessage] = useState<Message>();
    const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [showScrollDownButton, setShowScrollDownButton] =
        useState<boolean>(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isSettingDialogOpen, setIsSettingDialog] = useState<boolean>(false);

    const [showPluginSelect, setShowPluginSelect] = useState(false);

    const SettingsButton = () => (
        <>
            {/*<button*/}
            {/*    className="settings-btn"*/}
            {/*    onClick={() => setIsSettingDialog(true)}*/}
            {/*>*/}
            {/*    <IconSettings size={25}/>*/}
            {/*</button>*/}

            <style jsx>{`
              .settings-btn {
                position: absolute;
                top: 1px;
                right: 2px;
                background-color: rgba(255, 255, 255, 0.1); // Semi-transparent background
                border: none;
                border-radius: 50%; // Circular button
                padding: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.3s, box-shadow 0.3s, transform 0.3s; // Smooth transition for background, shadow, and scale
                z-index: 100;
                // Box shadow to give floating effect
                box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
              }

              .settings-btn:hover {
                background-color: rgba(255, 255, 255, 0.2); // Slightly darker on hover
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15); // Enhanced shadow on hover
                transform: scale(1.05); // Slightly enlarge the button on hover
                cursor: pointer;
              }

              .settings-btn:focus {
                outline: none;
              }
            `}</style>
        </>
    );

    const ApiKeyNotification = () => (
        <button onClick={handleButtonEvent}>
            <div
                className="flex flex-col items-center justify-center p-4 border-2 border-red-500 rounded-lg shadow-lg text-red-600 bg-gradient-to-r from-red-100 to-red-200 hover:from-red-200 hover:to-red-300 transition duration-300">
                <IconSettings size={18}/>
                <p className="ml-2">Please set the [API KEY] in the settings.</p>
                <p className="ml-2 text-xs">Click here or on the settings icon in the top right corner to open.</p>
            </div>
        </button>
    );

    const ApiKeyLink = () => (
        <div
            className="flex flex-row items-center justify-center p-4 border-2 border-green-500 rounded-lg shadow-lg text-green-600 bg-gradient-to-r from-green-100 to-green-200 hover:from-green-200 hover:to-green-300 transition duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
            <p>To get an API key, visit <a href="https://bam.res.ibm.com/" className="underline" target="_blank"
                                           rel="noopener noreferrer">this link</a>.
            </p>
        </div>
    );

    const handleButtonEvent = (event: React.MouseEvent) => {
        event.stopPropagation();
        setIsSettingDialog(true);
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleSend = useCallback(
        async (message: Message, deleteCount = 0, plugins: Plugin[] | null = null) => {
            if (!message.id) {
                message.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            }

            if (selectedConversation && plugins && plugins.length) {
                let updatedConversation: Conversation;
                if (deleteCount) {
                    // Assume there is a 'parentId' property on messages to identify children.
                    const messageIdToDelete = message.id;
                    const updatedMessages = selectedConversation.messages.filter(
                        msg => msg?.parent !== messageIdToDelete
                    );

                    updatedConversation = {
                        ...selectedConversation,
                        messages: [...updatedMessages],
                    };
                } else {
                    updatedConversation = {
                        ...selectedConversation,
                        messages: [...selectedConversation.messages, message],
                    };
                }
                homeDispatch({
                    field: 'selectedConversation',
                    value: updatedConversation,
                });


                homeDispatch({field: 'loading', value: true});
                homeDispatch({field: 'messageIsStreaming', value: true});

                if (!selectedImage) {
                    // toast("image not selected");
                    return;  // Skip to next plugin
                }


                const pluginPairs: Record<string, Plugin[]> = {};
                for (const plugin of plugins) {
                    const key = plugin.id.split("@")[0];
                    const engine = plugin.id.split("@")[1];
                    if (NEXT_PUBLIC_DISABLE_TESSERACT && engine.toUpperCase() === 'LANGCHAIN') {
                        continue
                    }
                    if (!pluginPairs[key]) {
                        pluginPairs[key] = [];
                    }
                    pluginPairs[key].push(plugin);
                }

                for (const [key, pluginArray] of Object.entries(pluginPairs)) {
                    const pluginsToProcess = []
                    for (const plugin of pluginArray) {
                        pluginsToProcess.push(async () => {
                            const chatBody: ChatBody = {
                                model: updatedConversation.model,
                                messages: updatedConversation.messages,
                                key: settings.apiKey || '', // Not used, default key is used from server
                                prompt: updatedConversation.prompt,
                                temperature: updatedConversation.temperature,
                            };

                            const uniqueMessageId = `${message.id}-${plugin.id}`;


                            const endpoint = getEndpoint(plugin) + "&selected_image=" + selectedImage;
                            const body = JSON.stringify(chatBody);
                            const controller = new AbortController();
                            const response = await fetch(endpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                signal: controller.signal,
                                body,
                            });

                            if (!response.ok) {
                                homeDispatch({field: 'loading', value: false});
                                homeDispatch({field: 'messageIsStreaming', value: false});
                                toast.error(response.statusText);
                                return;  // Skip to next plugin
                            }
                            const data = response.body;
                            if (!data) {
                                homeDispatch({field: 'loading', value: false});
                                homeDispatch({field: 'messageIsStreaming', value: false});
                                return;  // Skip to next plugin
                            }

                            let text = ''
                            const reader = data.getReader();
                            const decoder = new TextDecoder();
                            let done = false;
                            let isFirst = true;

                            while (!done) {
                                if (stopConversationRef.current === true) {
                                    controller.abort();
                                    done = true;
                                    break;
                                }
                                const {value, done: doneReading} = await reader.read();
                                done = doneReading;
                                const chunkValue = decoder.decode(value);
                                text += chunkValue;
                                if (isFirst) {

                                    isFirst = false;
                                    const title_format = plugin?.id.split("@")
                                    let title = (title_format[1].toUpperCase() === 'LANGCHAIN' ? 'Tesseract + PDFMiner' : 'Text Extraction') + " → " + title_format[0].toUpperCase()
                                    if (NEXT_PUBLIC_HIDE_DROPDOWN === 'hidden') {
                                        title = (title_format[1].toUpperCase() === 'LANGCHAIN' ? 'Tesseract + PDFMiner' : 'Text Extraction') + " → " + 'LLM'

                                    }
                                    const updatedMessages: Message[] = [
                                        ...updatedConversation.messages,
                                        {
                                            role: 'assistant',
                                            content: chunkValue,
                                            title: title,
                                            id: uniqueMessageId,
                                            parent: message.id
                                        },
                                    ];
                                    updatedConversation = {
                                        ...updatedConversation,
                                        messages: updatedMessages,
                                    };
                                    homeDispatch({
                                        field: 'selectedConversation',
                                        value: updatedConversation,
                                    });
                                } else {
                                    const updatedMessages: Message[] =
                                        updatedConversation.messages.map((msg) => {
                                            if (msg.id === uniqueMessageId) {
                                                return {
                                                    ...msg,
                                                    content: text,
                                                };
                                            }
                                            return msg;
                                        });
                                    updatedConversation = {
                                        ...updatedConversation,
                                        messages: updatedMessages,
                                    };
                                    homeDispatch({
                                        field: 'selectedConversation',
                                        value: updatedConversation,
                                    });
                                }
                            }
                            // saveConversation(updatedConversation);
                            const updatedConversations: Conversation[] = conversations.map(
                                (conversation) => {
                                    if (conversation.id === selectedConversation.id) {
                                        return updatedConversation;
                                    }
                                    return conversation;
                                },
                            );
                            if (updatedConversations.length === 0) {
                                updatedConversations.push(updatedConversation);
                            }
                            homeDispatch({field: 'conversations', value: updatedConversations});
                            // saveConversations(updatedConversations);

                        })
                    }
                    const results = await Promise.all(pluginsToProcess.map(plugf => plugf()));
                    homeDispatch({field: 'loading', value: false});
                    homeDispatch({field: 'messageIsStreaming', value: false});
                }


            }
        },
        [conversations, homeDispatch, selectedConversation, selectedImage, settings.apiKey, stopConversationRef]);

    const scrollToBottom = useCallback(() => {
        if (autoScrollEnabled) {
            messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
            textareaRef.current?.focus();
        }
    }, [autoScrollEnabled]);

    const handleScroll = () => {
        if (chatContainerRef.current) {
            const {scrollTop, scrollHeight, clientHeight} =
                chatContainerRef.current;
            const bottomTolerance = 30;

            if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
                setAutoScrollEnabled(false);
                setShowScrollDownButton(true);
            } else {
                setAutoScrollEnabled(true);
                setShowScrollDownButton(false);
            }
        }
    };

    const handleScrollDown = () => {
        chatContainerRef.current?.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth',
        });
    };

    const handleSettings = () => {
        setShowSettings(!showSettings);
    };

    const onClearAll = () => {
        if (
            confirm(t<string>('Are you sure you want to clear all messages?')) &&
            selectedConversation
        ) {
            handleUpdateConversation(selectedConversation, {
                key: 'messages',
                value: [],
            });
        }
    };

    const scrollDown = () => {
        if (autoScrollEnabled) {
            messagesEndRef.current?.scrollIntoView(true);
        }
    };
    const throttledScrollDown = throttle(scrollDown, 250);

    const toggleSettingDialog = () => {
        setIsSettingDialog(prevState => !prevState);
    };

    useEffect(() => {
        throttledScrollDown();
        selectedConversation &&
        setCurrentMessage(
            selectedConversation.messages[selectedConversation.messages.length - 2],
        );
    }, [selectedConversation, throttledScrollDown]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setAutoScrollEnabled(entry.isIntersecting);
                if (entry.isIntersecting) {
                    textareaRef.current?.focus();
                }
            },
            {
                root: null,
                threshold: 0.5,
            },
        );
        const messagesEndElement = messagesEndRef.current;
        if (messagesEndElement) {
            observer.observe(messagesEndElement);
        }
        return () => {
            if (messagesEndElement) {
                observer.unobserve(messagesEndElement);
            }
        };
    }, [messagesEndRef]);


    const userMessages = selectedConversation?.messages.filter(message => !message.parent);

    return (
        <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541] pl-10">
            <SettingsButton/>
            <SettingDialog open={isSettingDialogOpen} onClose={() => setIsSettingDialog(false)}/>
            {!selectedImage && (
                <div className="flex h-full">
                    {/* Your provided div content */}
                    <div className="mx-auto flex h-full w-[300px] flex-col pt-14 space-y-6 sm:w-[600px]">
                        <div className="text-4xl font-bold text-black dark:text-white">
                            Spotlight on the Power of <span style={{"whiteSpace": "nowrap"}}>Content Extraction</span>
                        </div>
                        <div className=" text-gray-500 dark:text-gray-400">
                            <div className="mb-2">
                                {"Explore the nuances of the RAG pipeline by focusing solely on the 'content extraction' phase."}
                            </div>
                            <div className="mb-2">
                                See firsthand how varying extraction methods can influence the final outcome, setting
                                aside
                                other RAG components for this demonstration.
                            </div>
                            <div>Powered by watsonx.ai text extraction technology and LLM.</div>
                            <div className={"mt-20"}>
                                <button
                                    onClick={toggleGallery}
                                    className="bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-white px-6 py-2 transition duration-300 ease-in-out">
                                    Select a document
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Image on the right side */}
                    <div className="flex-shrink-0 relative h-full min-w-[50vw] max-w-[50vw]">
                       <HeroImage />
                    </div>
                </div>

            )}

            {!settings.apiKey &&
                (
                    <div className="flex flex-col space-y-4 max-w-md mx-auto mt-10">
                        <div className="flex flex-col mt-10 p-2 m-2 top-2 space-y-3 align-center justify-center">
                            <ApiKeyNotification/>
                            <ApiKeyLink/>
                        </div>
                    </div>
                )}


            {selectedImage && settings.apiKey && <div
                className={`max-h-full overflow-x-hidden ${selectedConversation && selectedConversation?.messages?.length === 0 && 'overflow-hidden h-[90vh]'}`}
                ref={chatContainerRef}
                onScroll={handleScroll}
            >
                    {/*${selectedConversation && selectedConversation?.messages?.length === 0 ? 'bg-[#3B3E4A] border-gray-500 border-2 min-h-[76vh] mr-2' : ''}*/}
                    {!NEXT_PUBLIC_DISABLE_TESSERACT && <div
                        className={`${NEXT_PUBLIC_HIDE_DROPDOWN} sticky ${'animate-appear-fast'}   top-0 z-10 flex justify-between items-center border border-b-neutral-300 bg-neutral-100 text-sm text-neutral-500 dark:border-none dark:bg-[#3B3E4A] dark:text-neutral-200 overflow-hidden text-ellipsis whitespace-nowrap`}>

                        <div className={`flex w-[50%] dark:bg-[#444654] min-h-[5vh] mr-4`}>
                            <div style={{fontSize: "18px"}}
                                 className="font-bold ml-5 mt-[1.5vh]  min-h-[19px] max-h-[2vh] text-gray-700 dark:text-white text-center px-6 bg-green-500 rounded-full">
                                watsonx.ai Text Extraction
                            </div>
                        </div>

                        <div className="flex w-1/2 dark:bg-[#444654] min-h-[5vh] mr-4">
                            <div style={{fontSize: "18px"}}
                                 className="font-bold mt-[1.5vh] min-h-[19px] max-h-[2vh] ml-5 text-gray-700 dark:text-white text-center px-4 bg-purple-500 rounded-full">
                                Tesseract + PDFMiner
                            </div>
                        </div>
                    </div>}


                    {selectedConversation && selectedConversation?.messages?.length === 0 ?
                        <>
                            { IS_SUGGESTION_ENABLED && (
                                <div className='flex flex-col  bg-[#3B3E4A]'>
                                    {selectedImage && <ChatSuggestion textareaRef={textareaRef} suggestion={suggestion} /> }
                                </div>
                            )}
                            { !IS_SUGGESTION_ENABLED  && (
                                    <div className={"flex flex-row overflow-hidden min-h-[88vh]"}>
                                        <div className={"w-1/2 min-h-[88vh] bg-[#3B3E4A] overflow-hidden"}></div>
                                        <div className={"overflow-hidden  w-1/2 min-h-[88vh] bg-[#3B3E4A]"}></div>
                                    </div>
                            )}
                        </>
                        :
                        <div className={"bg-black mr-[2px]"}>
                            {selectedConversation?.messages &&
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    maxWidth: "100%",
                                }}>
                                    {userMessages && userMessages.map((userMessage, index) => {
                                        const wduChildMessages = (selectedConversation?.messages.filter(message =>
                                                message.parent === userMessage.id && message && message.title && ["WDU", "Text Extraction"].some(k => message.title?.includes(k)))
                                        )

                                        const langchainChildMessages = (selectedConversation?.messages.filter(message =>
                                                message.parent === userMessage.id && message && message.title && message?.title.includes("Tesseract"))
                                        )


                                        const wduChildMessagesLength = pluginKeys.length / 2;
                                        const langchainChildMessagesLength = pluginKeys.length / 2;

                                        return (
                                            <div key={userMessage.id}
                                                 style={{
                                                     display: "flex",
                                                     flexDirection: "column",
                                                     maxHeight: "someValue"
                                                 }}>
                                                {/* User Message */}
                                                <MemoizedChatMessage
                                                    message={userMessage}
                                                    messageIndex={index}
                                                    onEdit={(editedMessage) => {
                                                        setCurrentMessage(editedMessage);
                                                        handleSend(
                                                            editedMessage,
                                                            selectedConversation?.messages.length - index,
                                                        );
                                                    }}
                                                    maxIndex={null}
                                                    currentIndex={null}
                                                />

                                                <div
                                                    className={`bg-[#3B3E4A] ${selectedConversation && selectedConversation?.messages?.length === 0 ? 'bg-[#3B3E4A] border-gray-500 border-2 min-h-[76vh] mr-2' : ''}`}>
                                                    <div className={`flex flex-col overflow-y-scroll justify-around `}>
                                                        {Array(Math.max(wduChildMessages.length, langchainChildMessages.length)).fill(null).map((_, childIndex) => (
                                                            <div
                                                                className={"flex flex-row w-full mb-0 overflow-hidden animate-appear-fast"}
                                                                key={childIndex}>

                                                                {/* WDU Child Messages */}
                                                                <div className={"flex-1 mr-2"}>
                                                                    {wduChildMessages[childIndex] && (
                                                                        <MemoizedChatMessage
                                                                            key={`wdu-${userMessage.id}-${childIndex}`}
                                                                            message={wduChildMessages[childIndex]}
                                                                            messageIndex={childIndex}
                                                                            onEdit={(editedMessage) => {
                                                                                setCurrentMessage(editedMessage);
                                                                                handleSend(
                                                                                    editedMessage,
                                                                                    selectedConversation?.messages.length - (index + childIndex + 1),
                                                                                    null
                                                                                );
                                                                            }}
                                                                            currentIndex={childIndex}
                                                                            maxIndex={wduChildMessagesLength}
                                                                        />
                                                                    )}
                                                                </div>

                                                                {/* LANGCHAIN Child Messages */}
                                                                <div className={`${NEXT_PUBLIC_DISABLE_TESSERACT && 'hidden'} flex-1 ml-2 pr-2`}>
                                                                    {langchainChildMessages[childIndex] && (
                                                                        <MemoizedChatMessage
                                                                            key={`langchain-${userMessage.id}-${childIndex}`}
                                                                            message={langchainChildMessages[childIndex]}
                                                                            messageIndex={childIndex}
                                                                            onEdit={(editedMessage) => {
                                                                                setCurrentMessage(editedMessage);
                                                                                handleSend(
                                                                                    editedMessage,
                                                                                    selectedConversation?.messages.length - (index + childIndex + 1),
                                                                                    null
                                                                                );
                                                                            }}
                                                                            currentIndex={childIndex}
                                                                            maxIndex={langchainChildMessagesLength}
                                                                        />
                                                                    )}
                                                                </div>

                                                            </div>
                                                        ))}
                                                    </div>


                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>}
                        </div>
                    }
                    <div
                        className="h-[160px] bg-white dark:bg-[#343541]"
                        ref={messagesEndRef}
                    />



                <ChatInput
                    stopConversationRef={stopConversationRef}
                    textareaRef={textareaRef}
                    onSend={(message, plugins) => {
                        setCurrentMessage(message);
                        handleSend(message, 0, plugins);
                    }}
                    onScrollDownClick={handleScrollDown}
                    onRegenerate={(plugin) => {
                        if (currentMessage) {
                            handleSend(currentMessage, 2, plugin);
                        }
                    }}
                    showScrollDownButton={showScrollDownButton}
                />
            </div>}
        </div>
    );
});
Chat.displayName = 'Chat';

