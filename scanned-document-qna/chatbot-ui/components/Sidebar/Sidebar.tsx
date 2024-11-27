import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Plugin } from '@/types/plugin';

import PluginSelect from '@/components/Chat/PluginSelect';
import { useSelectedImage } from '@/components/GalleryBar/SelectedImageContext';
import ExtractionOptionsModal from '@/components/Popup/GetTextPopup';

interface Props<T> {
  isOpen: boolean;
  addItemButtonTitle: string;
  side: 'left' | 'right';
  items: T[];
  itemComponent: ReactNode;
  folderComponent: ReactNode;
  footerComponent?: ReactNode;
  searchTerm: string;
  handleSearchTerm: (searchTerm: string) => void;
  toggleOpen: () => void;
  handleCreateItem: () => void;
  handleCreateFolder: () => void;
  handleDrop: (e: any) => void;
}

const Navbar = <T,>({
  isOpen,
  addItemButtonTitle,
  items,
  itemComponent,
  folderComponent,
  footerComponent,
  searchTerm,
  handleSearchTerm,
  toggleOpen,
  handleCreateItem,
  handleCreateFolder,
  handleDrop,
}: Props<T>) => {
  const { t } = useTranslation('promptbar');
  const { selectedImage } = useSelectedImage();
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const toggleModal = () => {
    setModalIsOpen(!modalIsOpen);
  };

  useEffect(() => {
    handleCreateItem();
  }, [selectedImage]);

  const allowDrop = (e: any) => {
    e.preventDefault();
  };

  const [showPluginSelect, setShowPluginSelect] = useState(false);

  const highlightDrop = (e: any) => {
    e.target.style.background = '#343541';
  };

  const removeHighlight = (e: any) => {
    e.target.style.background = 'none';
  };

  const onClosePlugin = useCallback(() => setShowPluginSelect(false), []);

  const onPluginChange = useCallback((plugins: Plugin[]) => {
    // Implement logic to handle plugin selection
    // setPlugins(plugins); // Update your state with the selected plugins
    setShowPluginSelect(false);
  }, []);

  return (
    <div className="fixed top-0 z-40 flex items-center justify-between bg-[#161616] p-2 text-[14px] transition-all w-full h-[60px] max-h-[60px]">
      <div className="flex items-center space-x-1 mr-2 rounded-md">
        <div className="flex ml-5">
          <span className="font-normal text-xl w-full ml-1.5">Scanned</span>
          <span className="font-normal text-xl w-full ml-1.5">Document</span>
          <span className="font-normal text-xl w-full ml-1.5">Q&A</span>
        </div>
        {/* Uncomment these if needed */}
        {/*
        <button className="...">
            {addItemButtonTitle}
        </button>
        <button className="...">
            <IconFolderPlus size={16} />
        </button>
        <Search ... />
        */}
      </div>

      {selectedImage && (
        <ExtractionOptionsModal
          isOpen={modalIsOpen}
          onRequestClose={toggleModal}
        />
      )}

      {/* Additional navbar elements */}

      {itemComponent}
      <div
        className={`flex  space-x-4 mr-72 ${
          !selectedImage ? 'hidden' : 'animate-appear-fast'
        }`}
      >
        <PluginSelect onClose={onClosePlugin} onPluginChange={onPluginChange} />
        <div className="flex justify-items-start align-left content-start space-x-40">
          <div className={'flex flex-row ml-10'}>
            <span
              className={
                'text-white  flex items-center space-x-2 pb-1 font-bold whitespace-nowrap mr-2'
              }
            >
              View
            </span>
            <div className="relative inline-flex items-center bg-black p-1 min-w-[300px] h-10 rounded border-b border-gray-500">
              <button
                onClick={toggleModal}
                className={`w-1/2 px-4 py-2 font-bold  rounded transition duration-200 transform hover:scale-105 ${
                  !modalIsOpen
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 hover:bg-gray-500'
                }`}
                style={{
                  background: '#343541',
                  opacity: modalIsOpen ? '38%' : '100%',
                  color: 'white',
                }}
              >
                Chat
              </button>
              <button
                onClick={toggleModal}
                className={`w-1/2 px-4 py-2 font-bold rounded transition duration-200 transform focus:bg-white hover:scale-105 hover:opacity-100  ${
                  modalIsOpen
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 hover:bg-gray-500'
                }`}
                style={{
                  background: '#343541',
                  opacity: !modalIsOpen ? '38%' : '100%',
                  color: 'white',
                }}
              >
                Extracted Text
              </button>
            </div>
          </div>
        </div>
      </div>
      {footerComponent}
    </div>
  );
};

export default Navbar;
