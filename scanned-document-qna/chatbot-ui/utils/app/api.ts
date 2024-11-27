import { Plugin, PluginID } from '@/types/plugin';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Create the mapping
const MODEL_MAPPING = {
  [PluginID.GRANITE_13b_chat_v2_wdu]: {
    model: 'ibm/granite-13b-chat-v2',
    extraction: 'wdu',
  },
  [PluginID.GRANITE_13b_chat_v2_langchain]: {
    model: 'ibm/granite-13b-chat-v2',
    extraction: 'langchain',
  },
  [PluginID.GRANITE_3_2B_WDU]: {
    model: 'ibm/granite-3-2b-instruct',
    extraction: 'wdu',
  },
  [PluginID.GRANITE_3_2B_LANGCHAIN]: {
    model: 'ibm/granite-3-2b-instruct',
    extraction: 'langchain',
  },
  [PluginID.GRANITE_3_8B_WDU]: {
    model: 'ibm/granite-3-8b-instruct',
    extraction: 'wdu',
  },
  [PluginID.GRANITE_3_8B_LANGCHAIN]: {
    model: 'ibm/granite-3-8b-instruct',
    extraction: 'langchain',
  },
  [PluginID.LLAMA3_1_70B_WDU]: {
    model: 'meta-llama/llama-3-1-70b-instruct',
    extraction: 'wdu',
  },
  [PluginID.LLAMA3_1_70B_LANGCHAIN]: {
    model: 'meta-llama/llama-3-1-70b-instruct',
    extraction: 'langchain',
  },
  [PluginID.LLAMA3_2_1B_WDU]: {
    model: 'meta-llama/llama-3-2-1b-instruct',
    extraction: 'wdu',
  },
  [PluginID.LLAMA3_2_1B_LANGCHAIN]: {
    model: 'meta-llama/llama-3-2-1b-instruct',
    extraction: 'langchain',
  },
};

export const getEndpoint = (plugin: Plugin) => {
  const mapping = MODEL_MAPPING[plugin.id];
  if (mapping) {
    return `${API_URL}/api/send_to_llm?model_name=${mapping.model}&extraction=${mapping.extraction}`;
  }

  return `${API_URL}/api/chat`;
};
