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
  [PluginID.GRANITE_4_H_SMALL_WDU]: {
    model: 'ibm/granite-4-h-small',
    extraction: 'wdu',
  },
  [PluginID.GRANITE_4_H_SMALL_LANGCHAIN]: {
    model: 'ibm/granite-4-h-small',
    extraction: 'langchain',
  },
  [PluginID.LLAMA3_3_70B_WDU]: {
    model: 'meta-llama/llama-3-3-70b-instruct',
    extraction: 'wdu',
  },
  [PluginID.LLAMA3_3_70B_LANGCHAIN]: {
    model: 'meta-llama/llama-3-3-70b-instruct',
    extraction: 'langchain',
  },
  [PluginID.LLAMA4_MAVERICK_17B_128E_INSTRUCT_WDU]: {
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct-fp8',
    extraction: 'wdu',
  },
  [PluginID.LLAMA4_MAVERICK_17B_128E_INSTRUCT_LANGCHAIN]: {
    model: 'meta-llama/llama-4-maverick-17b-128e-instruct-fp8',
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
