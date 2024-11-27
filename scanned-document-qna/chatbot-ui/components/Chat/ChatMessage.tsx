import {IconCheck, IconCopy, IconRobot, IconUser,} from '@tabler/icons-react';
import {FC, memo, useContext, useEffect, useRef, useState} from 'react';

import {useTranslation} from 'next-i18next';

import {updateConversation} from '@/utils/app/conversation';

import {Message} from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

import {CodeBlock} from '../Markdown/CodeBlock';
import {MemoizedReactMarkdown} from '../Markdown/MemoizedReactMarkdown';

import rehypeMathjax from 'rehype-mathjax';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

export interface Props {
    message: Message;
    messageIndex: number;
    onEdit?: (editedMessage: Message) => void
    currentIndex: number | null;
    maxIndex: number | null;
}

const NEXT_PUBLIC_DISABLE_TESSERACT = process.env.NEXT_PUBLIC_DISABLE_TESSERACT === 'active' || false;
export const ChatMessage: FC<Props> = memo(({message, messageIndex, onEdit, currentIndex, maxIndex}) => {
    const {t} = useTranslation('chat');

    const {
        state: {selectedConversation, conversations, currentMessage, messageIsStreaming},
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [messageContent, setMessageContent] = useState(message.content);
    const [messagedCopied, setMessageCopied] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const toggleEditing = () => {
        setIsEditing(!isEditing);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessageContent(event.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handleEditMessage = () => {
        if (message.content != messageContent) {
            if (selectedConversation && onEdit) {
                onEdit({...message, content: messageContent});
            }
        }
        setIsEditing(false);
    };

    const handleDeleteMessage = () => {
        if (!selectedConversation) return;

        const {messages} = selectedConversation;
        const findIndex = messages.findIndex((elm) => elm === message);

        if (findIndex < 0) return;

        if (
            findIndex < messages.length - 1 &&
            messages[findIndex + 1].role === 'assistant'
        ) {
            messages.splice(findIndex, 2);
        } else {
            messages.splice(findIndex, 1);
        }
        const updatedConversation = {
            ...selectedConversation,
            messages,
        };

        const {single, all} = updateConversation(
            updatedConversation,
            conversations,
        );
        homeDispatch({field: 'selectedConversation', value: single});
        homeDispatch({field: 'conversations', value: all});
    };

    const handlePressEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !isTyping && !e.shiftKey) {
            e.preventDefault();
            handleEditMessage();
        }
    };

    const copyOnClick = () => {
        if (!navigator.clipboard) return;

        navigator.clipboard.writeText(message.content).then(() => {
            setMessageCopied(true);
            setTimeout(() => {
                setMessageCopied(false);
            }, 2000);
        });
    };

    useEffect(() => {
        setMessageContent(message.content);
    }, [message.content]);


    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing]);

    return (
        <div
            className={`group md:px-4 ${
                message.role === 'assistant'
                    ? 'border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100'
                    : 'border-b border-black/10 bg-white text-gray-800 dark:border-gray-900/50 dark:bg-gray-800 dark:text-gray-100'
            }`}
            style={{overflowWrap: 'anywhere'}}
        >
            <div
                className={`relative mt-auto mb-auto flex ${message.role === 'assistant' ? "flex-col" : "flex-row"} p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl`}>
                {/* Conditional rendering of message title */}

                {message.role === 'assistant' && <div className={`flex flex-row align-center bg-blend-hue opacity-90`}>

                    <div className={"flex justify-between"}>
                        <>
                            {message.title && <IconRobot size={20}/>}
                            {message.title && (
                                <div
                                    className={`ml-4 rounded-full ${["WDU", "Text Extraction"].some(k => message.title?.includes(k)) ? "bg-green-500" : "bg-purple-500"}`} // Conditional coloring based on "WDU"
                                >
                                    <h6 className="text-sm font-semibold text-gray-700 dark:text-white text-center px-4"> {/* Added padding for spacing */}
                                        {message.title}
                                    </h6>
                                </div>
                            )}
                        </>

                        <div className={"ml-2 text-sm"}>
                            {currentIndex !== null && maxIndex !== null ? ((currentIndex + 1) + " / " + maxIndex) : ''}
                        </div>
                    </div>
                </div>}

                {message.role === 'user' && <div
                    className="flex justify-start min-w-[50vw] mr-20"> {/* Changed from justify-between to justify-start */}
                    <div className="min-w-[40px]">
                        <IconUser size={20}/>
                    </div>
                    <div className="text-left"> {/* Added text-left for left-aligned text */}
                        <h6 className="text-sm font-semibold text-gray-700 dark:text-white px-4">
                            {message.content}
                        </h6>
                    </div>
                </div>}


                <div className="prose mt-[-2px] w-full dark:prose-invert">
                    {message.role === 'user' ? (
                        <></>

                    ) : (
                        <div
                            className={`prose dark:prose-invert flex-1  ${NEXT_PUBLIC_DISABLE_TESSERACT ? "container mx-auto px-4 py-2" : "max-w-md text-sm whitespace-normal break-words"} `}>
                            <MemoizedReactMarkdown
                                className={`prose  dark:prose-invert flex-1 ${NEXT_PUBLIC_DISABLE_TESSERACT ? "ml-5 max-w-full lg:max-w-4xl" : "max-w-md text-sm whitespace-normal break-words"} `}
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeMathjax]}
                                components={{
                                    code({node, inline, className, children, ...props}) {
                                        if (children.length) {
                                            if (children[0] == '▍') {
                                                return <span className="animate-pulse cursor-default mt-1">▍</span>
                                            }

                                            children[0] = (children[0] as string).replace("`▍`", "▍")
                                        }

                                        const match = /language-(\w+)/.exec(className || '');

                                        return !inline ? (
                                            <CodeBlock
                                                key={Math.random()}
                                                language={(match && match[1]) || ''}
                                                value={String(children).replace(/\n$/, '')}
                                                {...props}
                                            />
                                        ) : (
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        );
                                    },
                                    table({children}) {
                                        return (
                                            <table
                                                className="border-collapse border border-black px-3 py-1 dark:border-white">
                                                {children}
                                            </table>
                                        );
                                    },
                                    th({children}) {
                                        return (
                                            <th className="break-words border border-black bg-gray-500 px-3 py-1 text-white dark:border-white">
                                                {children}
                                            </th>
                                        );
                                    },
                                    td({children}) {
                                        return (
                                            <td className="break-words border border-black px-3 py-1 dark:border-white">
                                                {children}
                                            </td>
                                        );
                                    },
                                }}
                            >
                                {`${message.content}${
                                    messageIsStreaming && messageIndex == (selectedConversation?.messages.length ?? 0) - 1 ? '`▍`' : ''
                                }`}
                            </MemoizedReactMarkdown>

                            <div
                                className="md:-mr-8 ml-1 md:ml-0 flex flex-col md:flex-row gap-4 md:gap-1 items-center md:items-start justify-end md:justify-start">
                                {messagedCopied ? (
                                    <IconCheck
                                        size={20}
                                        className="text-green-500 dark:text-green-400"
                                    />
                                ) : (
                                    <button
                                        className="focus:visible mt-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        onClick={copyOnClick}
                                    >
                                        <IconCopy size={20}/>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
ChatMessage.displayName = 'ChatMessage';



