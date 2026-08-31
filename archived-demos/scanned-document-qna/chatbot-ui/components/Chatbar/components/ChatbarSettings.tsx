import {IconSettings} from '@tabler/icons-react';
import React, {useContext, useState} from 'react';

import {useTranslation} from 'next-i18next';

import HomeContext from '@/pages/api/home/home.context';

import {SettingDialog} from '@/components/Settings/SettingDialog';

import {Import} from '../../Settings/Import';
import ChatbarContext from '../Chatbar.context';
import {ClearConversations} from './ClearConversations';
import ExtractionOptionsModal from "@/components/Popup/GetTextPopup";

export const ChatbarSettings = () => {
    const {t} = useTranslation('sidebar');
    const [isSettingDialogOpen, setIsSettingDialog] = useState<boolean>(false);


    const {
        state: {
            apiKey,
            lightMode,
            serverSideApiKeyIsSet,
            serverSidePluginKeysSet,
            conversations,
        },
        dispatch: homeDispatch,
    } = useContext(HomeContext);

    const {
        handleClearConversations,
        handleImportConversations,
        handleExportData,
        handleApiKeyChange,
    } = useContext(ChatbarContext);


    return (
        <div className="flex items-center text-sm z-10 p-2" style={{borderRadius: "5px"}}>

            {conversations.length > 0 ? (
                <ClearConversations onClearConversations={handleClearConversations}/>
            ) : null}

            <Import onImport={handleImportConversations}/>

            {/*<button*/}
            {/*    className="flex items-center space-x-1 p-2 hover:bg-gray-500/10 transition-colors duration-200 rounded-md"*/}
            {/*    onClick={() => handleExportData()}*/}
            {/*>*/}
            {/*    <IconFileExport size={18}/>*/}
            {/*    <span>{t('Export')}</span>*/}
            {/*</button>*/}
            
            {/* Commented by Ankit -- to hide the settings icon */}
            {/* <button
                className="flex items-center p-2 hover:bg-gray-500/10 transition-colors duration-200 rounded-md"
                onClick={() => setIsSettingDialog(true)}
            >
                <IconSettings size={30}/>
                <span>{t('')}</span>
            </button> */}

            {/* Uncomment below when needed */}
            {/*{!serverSideApiKeyIsSet ? (
      <Key apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
    ) : null}

    {!serverSidePluginKeysSet ? <PluginKeys /> : null}*/}
            <SettingDialog
                open={isSettingDialogOpen}
                onClose={() => {
                    setIsSettingDialog(false);
                }}
            />


        </div>
    );

};
