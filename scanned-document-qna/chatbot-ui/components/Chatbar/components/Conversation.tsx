import {IconCheck, IconMessage, IconPencil, IconTrash, IconX,} from '@tabler/icons-react';
import {DragEvent, KeyboardEvent, MouseEventHandler, useContext, useEffect, useState,} from 'react';

import {Conversation} from '@/types/chat';

import HomeContext from '@/pages/api/home/home.context';

import SidebarActionButton from '@/components/Buttons/SidebarActionButton';
import ChatbarContext from '@/components/Chatbar/Chatbar.context';

interface Props {
    conversation: Conversation;
}

export const ConversationComponent = ({conversation}: Props) => {
    const {
        state: {selectedConversation, messageIsStreaming},
        handleSelectConversation,
        handleUpdateConversation,
    } = useContext(HomeContext);

    const {handleDeleteConversation} = useContext(ChatbarContext);

    const [isDeleting, setIsDeleting] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');

    const handleEnterDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            selectedConversation && handleRename(selectedConversation);
        }
    };

    const handleDragStart = (
        e: DragEvent<HTMLButtonElement>,
        conversation: Conversation,
    ) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('conversation', JSON.stringify(conversation));
        }
    };

    const handleRename = (conversation: Conversation) => {
        if (renameValue.trim().length > 0) {
            handleUpdateConversation(conversation, {
                key: 'name',
                value: renameValue,
            });
            setRenameValue('');
            setIsRenaming(false);
        }
    };

    const handleConfirm: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();
        if (isDeleting) {
            handleDeleteConversation(conversation);
        } else if (isRenaming) {
            handleRename(conversation);
        }
        setIsDeleting(false);
        setIsRenaming(false);
    };

    const handleCancel: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();
        setIsDeleting(false);
        setIsRenaming(false);
    };

    const handleOpenRenameModal: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();
        setIsRenaming(true);
        selectedConversation && setRenameValue(selectedConversation.name);
    };
    const handleOpenDeleteModal: MouseEventHandler<HTMLButtonElement> = (e) => {
        e.stopPropagation();
        setIsDeleting(true);
    };

    useEffect(() => {
        if (isRenaming) {
            setIsDeleting(false);
        } else if (isDeleting) {
            setIsRenaming(false);
        }
    }, [isRenaming, isDeleting]);

    return (
        <div className="flex items-center space-x-4 bg-[#202123] p-2">

            {isRenaming && selectedConversation?.id === conversation.id ? (
                <div className="flex items-center gap-2 rounded-lg bg-[#343541]/90 p-2">
                    <IconMessage size={14}/>
                    <input
                        className="mr-3 flex-1 overflow-hidden overflow-ellipsis border-neutral-400 bg-transparent text-sm leading-4 text-white outline-none focus:border-neutral-100"
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleEnterDown}
                        autoFocus
                    />
                </div>
            ) : (
                <button
                    className={`flex items-center gap-2 rounded-lg p-2 text-sm transition-colors duration-200 hover:bg-[#343541]/90 ${
                        messageIsStreaming ? 'disabled:cursor-not-allowed' : ''
                    } ${
                        selectedConversation?.id === conversation.id
                            ? 'bg-[#343541]/90'
                            : ''
                    }`}
                    onClick={() => handleSelectConversation(conversation)}
                    disabled={messageIsStreaming}
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, conversation)}
                >
                    <IconMessage size={14}/>
                    <div
                        className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-4 ${
                            selectedConversation?.id === conversation.id ? 'pr-3' : 'pr-1'
                        }`}
                    >
                        {conversation.name}
                    </div>
                </button>
            )}

            {(isDeleting || isRenaming) &&
                selectedConversation?.id === conversation.id && (
                    <div className="flex space-x-2 text-gray-300">
                        <SidebarActionButton handleClick={handleConfirm}>
                            <IconCheck size={14}/>
                        </SidebarActionButton>
                        <SidebarActionButton handleClick={handleCancel}>
                            <IconX size={14}/>
                        </SidebarActionButton>
                    </div>
                )}

            {selectedConversation?.id === conversation.id &&
                !isDeleting &&
                !isRenaming && (
                    <div className="flex space-x-2 text-gray-300">
                        <SidebarActionButton handleClick={handleOpenRenameModal}>
                            <IconPencil size={14}/>
                        </SidebarActionButton>
                        <SidebarActionButton handleClick={handleOpenDeleteModal}>
                            <IconTrash size={14}/>
                        </SidebarActionButton>
                    </div>
                )}
        </div>
    );

};
