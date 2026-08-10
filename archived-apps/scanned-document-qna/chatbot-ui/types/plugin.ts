import { KeyValuePair } from './data';

const NEXT_PUBLIC_GRANITE_ONLY = process.env.NEXT_PUBLIC_GRANITE_ONLY || false;

export interface Plugin {
  id: PluginID;
  name: PluginName;
  extractionEngine: ExtractionEngine;
  requiredKeys: KeyValuePair[];
}

export interface PluginKey {
  pluginId: PluginID;
  requiredKeys: KeyValuePair[];
}

export function getPluginFromKey(pluginKey: PluginKey): Plugin {
  const plugin = Plugins[pluginKey.pluginId];
  if (!plugin) {
    throw new Error(`Plugin not found for PluginID: ${pluginKey.pluginId}`);
  }
  return {
    ...plugin,
    requiredKeys: pluginKey.requiredKeys,
  };
}

export type PluginMappings = {
  [key: string]: Plugin;
};

const myExtractionEngine: ExtractionEngine = 'WDU';

export enum PluginID {
 LLAMA3_3_70B_WDU = 'llama-3-3-70b-instruct@wdu',
  LLAMA3_3_70B_LANGCHAIN = 'llama-3-3-70b-instruct@langchain',
  LLAMA4_MAVERICK_17B_128E_INSTRUCT_WDU = 'llama-4-maverick-17b-128e-instruct-fp8@wdu',
  LLAMA4_MAVERICK_17B_128E_INSTRUCT_LANGCHAIN = 'llama-4-maverick-17b-128e-instruct-fp8@langchain',
  GRANITE_13b_chat_v2_wdu = 'granite-13b-chat-v2@wdu',
  GRANITE_13b_chat_v2_langchain = 'granite-13b-chat-v2@langchain',
  GRANITE_4_H_SMALL_WDU = 'granite-4-h-small@wdu',
  GRANITE_4_H_SMALL_LANGCHAIN = 'granite-4-h-small@langchain',
}

export enum PluginName {
   LLAMA3_3_70B_WDU = 'llama-3-3-70b-instruct@wdu',
  LLAMA3_3_70B_LANGCHAIN = 'llama-3-3-70b-instruct@langchain',
  LLAMA4_MAVERICK_17B_128E_INSTRUCT_WDU = 'llama-4-maverick-17b-128e-instruct-fp8@wdu',
  LLAMA4_MAVERICK_17B_128E_INSTRUCT_LANGCHAIN = 'llama-4-maverick-17b-128e-instruct-fp8@langchain',
  GRANITE_13b_chat_v2_wdu = 'ibm/granite-13b-chat-v2@wdu',
  GRANITE_13b_chat_v2_langchain = 'ibm/granite-13b-chat-v2@langchain',
  GRANITE_4_H_SMALL_WDU = 'granite-4-h-small@wdu',
  GRANITE_4_H_SMALL_LANGCHAIN = 'granite-4-h-small@langchain',
}

const PluginsGranite: PluginMappings = {
  // [PluginID['ibm/granite-13b-chat-v1']]: {
  //   id: PluginID['ibm/granite-13b-chat-v1'],
  //   name: PluginName['ibm/granite-13b-chat-v1'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['ibm/granite-13b-instruct-v1']]: {
  //   id: PluginID['ibm/granite-13b-instruct-v1'],
  //   name: PluginName['ibm/granite-13b-instruct-v1'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['ibm/granite-20b-code-instruct-v1']]: {
  //   id: PluginID['ibm/granite-20b-code-instruct-v1'],
  //   name: PluginName['ibm/granite-20b-code-instruct-v1'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['ibm/granite-3b-code-plus-v1']]: {
  //   id: PluginID['ibm/granite-3b-code-plus-v1'],
  //   name: PluginName['ibm/granite-3b-code-plus-v1'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['meta-llama/llama-2-13b']]: {
  //   id: PluginID['meta-llama/llama-2-13b'],
  //   name: PluginName['meta-llama/llama-2-13b'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['meta-llama/llama-2-13b-chat']]: {
  //   id: PluginID['meta-llama/llama-2-13b-chat'],
  //   name: PluginName['meta-llama/llama-2-13b-chat'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['meta-llama/llama-2-70b']]: {
  //   id: PluginID['meta-llama/llama-2-70b'],
  //   name: PluginName['meta-llama/llama-2-70b'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['meta-llama/llama-2-70b-chat']]: {
  //   id: PluginID['meta-llama/llama-2-70b-chat'],
  //   name: PluginName['meta-llama/llama-2-70b-chat'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['meta-llama/llama-2-7b']]: {
  //   id: PluginID['meta-llama/llama-2-7b'],
  //   name: PluginName['meta-llama/llama-2-7b'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['meta-llama/llama-2-7b-chat']]: {
  //   id: PluginID['meta-llama/llama-2-7b-chat'],
  //   name: PluginName['meta-llama/llama-2-7b-chat'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
  // [PluginID['ibm/falcon-40b-8lang-instruct']]: {
  //   id: PluginID['ibm/falcon-40b-8lang-instruct'],
  //   name: PluginName['ibm/falcon-40b-8lang-instruct'],
  //   extractionEngine: myExtractionEngine,
  //   requiredKeys: [],
  // },
};

const NormalPlugins: PluginMappings = {
  [PluginID.GRANITE_4_H_SMALL_WDU]: {
    id: PluginID.GRANITE_4_H_SMALL_WDU,
    name: PluginName.GRANITE_4_H_SMALL_WDU,
    extractionEngine: 'WDU',
    requiredKeys: [],
  },
  [PluginID.GRANITE_4_H_SMALL_LANGCHAIN]: {
    id: PluginID.GRANITE_4_H_SMALL_LANGCHAIN,
    name: PluginName.GRANITE_4_H_SMALL_LANGCHAIN,
    extractionEngine: 'LangChain',
    requiredKeys: [],
  },
  [PluginID.LLAMA3_3_70B_WDU]: {
    id: PluginID.LLAMA3_3_70B_WDU,
    name: PluginName.LLAMA3_3_70B_WDU,
    extractionEngine: 'WDU',
    requiredKeys: [],
  },
  [PluginID.LLAMA3_3_70B_LANGCHAIN]: {
    id: PluginID.LLAMA3_3_70B_LANGCHAIN,
    name: PluginName.LLAMA3_3_70B_LANGCHAIN,
    extractionEngine: 'LangChain',
    requiredKeys: [],
  },
  [PluginID.LLAMA4_MAVERICK_17B_128E_INSTRUCT_WDU]: {
    id: PluginID.LLAMA4_MAVERICK_17B_128E_INSTRUCT_WDU,
    name: PluginName.LLAMA4_MAVERICK_17B_128E_INSTRUCT_WDU,
    extractionEngine: 'WDU',
    requiredKeys: [],
  },
  [PluginID.LLAMA4_MAVERICK_17B_128E_INSTRUCT_LANGCHAIN]: {
    id: PluginID.LLAMA4_MAVERICK_17B_128E_INSTRUCT_LANGCHAIN,
    name: PluginName.LLAMA4_MAVERICK_17B_128E_INSTRUCT_LANGCHAIN,
    extractionEngine: 'LangChain',
    requiredKeys: [],
  },
};

export type ExtractionEngine = 'WDU' | 'LangChain';
export const Plugins =
  NEXT_PUBLIC_GRANITE_ONLY === 'ACTIVE' ? PluginsGranite : NormalPlugins;
export const PluginList =
  NEXT_PUBLIC_GRANITE_ONLY === 'ACTIVE'
    ? Object.values(PluginsGranite)
    : Object.values(NormalPlugins);
