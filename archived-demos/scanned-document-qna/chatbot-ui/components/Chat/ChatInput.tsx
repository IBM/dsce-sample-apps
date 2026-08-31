import {IconArrowDown, IconBolt, IconPlayerStop, IconRepeat, IconSend, IconWorld,} from '@tabler/icons-react';
import {KeyboardEvent, MutableRefObject, useCallback, useContext, useEffect, useRef, useState,} from 'react';

import {useTranslation} from 'next-i18next';

import {Message} from '@/types/chat';
import {getPluginFromKey, Plugin, PluginList} from '@/types/plugin';
import {Prompt} from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import {PromptList} from './PromptList';
import {VariableModal} from './VariableModal';
import toast from "react-hot-toast";
import PluginSelect from "@/components/Chat/PluginSelect";
import {hidden} from "kleur/colors";

interface Props {
    onSend: (message: Message, plugins: Plugin[] | null) => void;
    onRegenerate: (plugins: Plugin[] | null) => void;
    onScrollDownClick: () => void;
    stopConversationRef: MutableRefObject<boolean>;
    textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
    showScrollDownButton: boolean;
}

export const ChatInput = ({
                              onSend,
                              onRegenerate,
                              onScrollDownClick,
                              stopConversationRef,
                              textareaRef,
                              showScrollDownButton,
                          }: Props) => {
    const {t} = useTranslation('chat');

    const {
        state: {selectedConversation, messageIsStreaming, prompts, pluginKeys},

        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const [content, setContent] = useState<string>();
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [showPromptList, setShowPromptList] = useState(false);
    const [activePromptIndex, setActivePromptIndex] = useState(0);
    const [promptInputValue, setPromptInputValue] = useState('');
    const [variables, setVariables] = useState<string[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [showPluginSelect, setShowPluginSelect] = useState(false);
    // const [plugins, setPlugins] = useState<Plugin[]>([PluginList[0]] as Plugin[]);
    const [messageHistoryIndex, setMessageHistoryIndex] = useState(-1); // -1 will indicate that the user is typing a new message.

    const promptListRef = useRef<HTMLUListElement | null>(null);

    useEffect(() => {
        const savedMessages = JSON.parse(localStorage.getItem('messageHistory') || '[]');
        if (savedMessages.length) {
            // Optionally set up your component's state with this data if needed for other functionalities.
        }
    }, []);

    const handlePluginSelectClose = () => {
        setShowPluginSelect(false);
    };
    const filteredPrompts = prompts.filter((prompt) =>
        prompt.name.toLowerCase().includes(promptInputValue.toLowerCase()),
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const maxLength = selectedConversation?.model.maxLength;

        if (maxLength && value.length > maxLength) {
            alert(
                t(
                    `Message limit is {{maxLength}} characters. You have entered {{valueLength}} characters.`,
                    {maxLength, valueLength: value.length},
                ),
            );
            return;
        }

        setContent(value);
        updatePromptListVisibility(value);
    };

    const handleSend = () => {
        if (messageIsStreaming) {
            return;
        }

        if (!content) {
            toast(t('Please enter a message'));
            return;
        }

        let messageHistory = JSON.parse(localStorage.getItem('messageHistory') || '[]');
        messageHistory.push(content);
        localStorage.setItem('messageHistory', JSON.stringify(messageHistory));


        onSend({role: 'user', content, title: null, parent: null, id: null}, pluginKeys.map(pk => getPluginFromKey(pk)));
        setContent('');

        if (window.innerWidth < 640 && textareaRef && textareaRef.current) {
            textareaRef.current.blur();
        }
    };

    const handleStopConversation = () => {
        stopConversationRef.current = true;
        setTimeout(() => {
            stopConversationRef.current = false;
        }, 1000);
    };

    const isMobile = () => {
        const userAgent =
            typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
        const mobileRegex =
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
        return mobileRegex.test(userAgent);
    };

    const handleInitModal = () => {
        const selectedPrompt = filteredPrompts[activePromptIndex];
        if (selectedPrompt) {
            setContent((prevContent) => {
                const newContent = prevContent?.replace(
                    /\/\w*$/,
                    selectedPrompt.content,
                );
                return newContent;
            });
            handlePromptSelect(selectedPrompt);
        }
        setShowPromptList(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        const messageHistory = JSON.parse(localStorage.getItem('messageHistory') || '[]');

        if (e.key === 'ArrowUp') {
            e.preventDefault();

            // Navigate up the history list.
            setMessageHistoryIndex((prevIndex) => {
                const newIndex = Math.min(prevIndex + 1, messageHistory.length - 1);
                setContent(messageHistory[messageHistory.length - 1 - newIndex]); // Get the message from history.
                return newIndex;
            });

        } else if (e.key === 'ArrowDown') {
            e.preventDefault();

            // Navigate down the history list, or go back to typing a new message if we reach the bottom.
            setMessageHistoryIndex((prevIndex) => {
                const newIndex = Math.max(prevIndex - 1, -1); // We use -1 to indicate typing a new message.
                setContent(newIndex === -1 ? '' : messageHistory[messageHistory.length - 1 - newIndex]);
                return newIndex;
            });
        }

        if (showPromptList) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();

                setActivePromptIndex((prevIndex) =>
                    prevIndex < prompts.length - 1 ? prevIndex + 1 : prevIndex,
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActivePromptIndex((prevIndex) =>
                    prevIndex > 0 ? prevIndex - 1 : prevIndex,
                );
            } else if (e.key === 'Tab') {
                e.preventDefault();
                setActivePromptIndex((prevIndex) =>
                    prevIndex < prompts.length - 1 ? prevIndex + 1 : 0,
                );
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleInitModal();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setShowPromptList(false);
            } else {
                setActivePromptIndex(0);
            }
        } else if (e.key === 'Enter' && !isTyping && !isMobile() && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        } else if (e.key === '/' && e.metaKey) {
            e.preventDefault();
            setShowPluginSelect(!showPluginSelect);
        }
    };

    const parseVariables = (content: string) => {
        const regex = /{{(.*?)}}/g;
        const foundVariables = [];
        let match;

        while ((match = regex.exec(content)) !== null) {
            foundVariables.push(match[1]);
        }

        return foundVariables;
    };

    const updatePromptListVisibility = useCallback((text: string) => {
        const match = text.match(/\/\w*$/);

        if (match) {
            setShowPromptList(true);
            setPromptInputValue(match[0].slice(1));
        } else {
            setShowPromptList(false);
            setPromptInputValue('');
        }
    }, []);

    const handlePromptSelect = (prompt: Prompt) => {
        const parsedVariables = parseVariables(prompt.content);
        setVariables(parsedVariables);

        if (parsedVariables.length > 0) {
            setIsModalVisible(true);
        } else {
            setContent((prevContent) => {
                const updatedContent = prevContent?.replace(/\/\w*$/, prompt.content);
                return updatedContent;
            });
            updatePromptListVisibility(prompt.content);
        }
    };

    const handleSubmit = (updatedVariables: string[]) => {
        const newContent = content?.replace(/{{(.*?)}}/g, (match, variable) => {
            const index = variables.indexOf(variable);
            return updatedVariables[index];
        });

        setContent(newContent);

        if (textareaRef && textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    useEffect(() => {
        if (promptListRef.current) {
            promptListRef.current.scrollTop = activePromptIndex * 30;
        }
    }, [activePromptIndex]);

    useEffect(() => {
        if (textareaRef && textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current?.scrollHeight}px`;
            textareaRef.current.style.overflow = `${
                textareaRef?.current?.scrollHeight > 400 ? 'auto' : 'hidden'
            }`;
        }
    }, [content]);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (
                promptListRef.current &&
                !promptListRef.current.contains(e.target as Node)
            ) {
                setShowPromptList(false);
            }
        };

        window.addEventListener('click', handleOutsideClick);

        return () => {
            window.removeEventListener('click', handleOutsideClick);
        };
    }, []);

    return (
        <div
            className="absolute bottom-0 left-0 w-full  pt-6 dark:border-white/20 dark:via-[#343541] dark:to-[#343541] md:pt-2">
            <div
                className="stretch mx-2 mt-4 flex flex-row gap-3 last:mb-2 md:mx-4 md:mt-[52px]  lg:mx-auto lg:max-w-3xl">
                {messageIsStreaming && (
                    <button
                        className="absolute top-0 left-0 right-0 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2"
                        onClick={handleStopConversation}
                    >
                        <IconPlayerStop size={16}/> {t('Stop Generating')}
                    </button>
                )}

                {/*{!messageIsStreaming &&*/}
                {/*    selectedConversation &&*/}
                {/*    selectedConversation.messages.length > 0 && (*/}
                {/*        <button*/}
                {/*            className="absolute top-0 left-0 right-0 mx-auto mb-3 flex w-fit items-center gap-3 rounded border border-neutral-200 bg-white py-2 px-4 text-black hover:opacity-50 dark:border-neutral-600 dark:bg-[#343541] dark:text-white md:mb-0 md:mt-2"*/}
                {/*            onClick={() => onRegenerate(pluginKeys.map(pk => getPluginFromKey(pk)))}*/}
                {/*        >*/}
                {/*            <IconRepeat size={16}/> {t('Regenerate response')}*/}
                {/*        </button>*/}
                {/*    )}*/}

                <div
                    className="relative  mx-2 flex w-full flex-grow flex-col rounded-md border border-black/10 bg-white shadow-[0_0_10px_rgba(0,0,0,0.10)] dark:border-gray-900/50 dark:bg-[#40414F] dark:text-white dark:shadow-[0_0_15px_rgba(0,0,0,0.10)] sm:mx-4">
                    {/*<div*/}
                    {/*    onMouseEnter={() => setShowPluginSelect(true)}*/}
                    {/*    // onMouseLeave={() => setShowPluginSelect(false)}*/}
                    {/*>*/}
                    {/*    <button*/}
                    {/*        className="absolute  left-2 top-2 rounded-sm p-1 text-neutral-800 opacity-60  hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"*/}
                    {/*        onClick={() => setShowPluginSelect(!showPluginSelect)}*/}
                    {/*        onKeyDown={(e) => {*/}
                    {/*        }}*/}
                    {/*    >*/}
                    {/*        {plugins ? <IconWorld size={20}/> : <IconBolt size={20}/>}*/}
                    {/*    </button>*/}

                    {/*    {(*/}
                    {/*        <div className={`absolute left-0 bottom-14 rounded bg-white dark:bg-[#343541]  animate-slideUp-fade ${showPluginSelect ? "" : "hidden"}`}>*/}
                    {/*            <PluginSelect*/}
                    {/*                plugins={plugins}*/}
                    {/*                onClose={handlePluginSelectClose}*/}
                    {/*                onPluginChange={(plugins: Plugin[]) => {*/}
                    {/*                    setPlugins(plugins);*/}
                    {/*                    setShowPluginSelect(false);*/}
                    {/*                }}*/}
                    {/*            />*/}
                    {/*        </div>*/}
                    {/*    )}*/}
                    {/*</div>*/}

                    <textarea
                        ref={textareaRef}
                        className="m-0 w-full resize-none border-0 bg-transparent p-0 py-2 pr-8 pl-10 text-black dark:bg-transparent dark:text-white md:py-3 md:pl-10"
                        style={{
                            resize: 'none',
                            bottom: `${textareaRef?.current?.scrollHeight}px`,
                            maxHeight: '400px',
                            overflow: `${
                                textareaRef.current && textareaRef.current.scrollHeight > 400
                                    ? 'auto'
                                    : 'hidden'
                            }`,
                        }}
                        placeholder={
                            t('Ask a question, request a summary, or learn more about the image.') || ''
                        }
                        value={content}
                        rows={1}
                        onCompositionStart={() => setIsTyping(true)}
                        onCompositionEnd={() => setIsTyping(false)}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                    />

                    <button
                        className="absolute right-2 top-2 rounded-sm p-1 text-neutral-800 opacity-60 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-opacity-50 dark:text-neutral-100 dark:hover:text-neutral-200"
                        onClick={handleSend}
                    >
                        {messageIsStreaming ? (
                            <div
                                className="h-4 w-4 animate-spin rounded-full border-t-2 border-neutral-800 opacity-60 dark:border-neutral-100"></div>
                        ) : (
                            <IconSend size={18}/>
                        )}
                    </button>

                    {showScrollDownButton && (
                        <div className="absolute bottom-12 right-0 lg:bottom-0 lg:-right-10">
                            <button
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-300 text-gray-800 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-neutral-200"
                                onClick={onScrollDownClick}
                            >
                                <IconArrowDown size={18}/>
                            </button>
                        </div>
                    )}

                    {showPromptList && filteredPrompts.length > 0 && (
                        <div className="absolute bottom-12 w-full">
                            <PromptList
                                activePromptIndex={activePromptIndex}
                                prompts={filteredPrompts}
                                onSelect={handleInitModal}
                                onMouseOver={setActivePromptIndex}
                                promptListRef={promptListRef}
                            />
                        </div>
                    )}

                    {isModalVisible && (
                        <VariableModal
                            prompt={filteredPrompts[activePromptIndex]}
                            variables={variables}
                            onSubmit={handleSubmit}
                            onClose={() => setIsModalVisible(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
