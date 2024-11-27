import { Conversation } from '@/types/chat';

import { ConversationComponent } from './Conversation';

interface Props {
  conversations: Conversation[];
}

export const Conversations = ({ conversations }: Props) => {
  return (
    <div className="flex w-full flex-row gap-1 overflow-x-auto" style={{borderRadius: "2px"}}>
      {conversations
        .filter((conversation) => !conversation.folderId)
        .slice()
        .reverse()
        .map((conversation, index) => (
            <></>
          // <ConversationComponent key={index} conversation={conversation} />
        ))}
    </div>
  );
};
