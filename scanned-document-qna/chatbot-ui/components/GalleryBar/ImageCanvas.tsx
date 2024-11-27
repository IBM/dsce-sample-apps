import React, {FC, useState} from 'react';
import {TransformComponent, TransformWrapper} from 'react-zoom-pan-pinch';
import {useSelectedImage} from './SelectedImageContext';
import {useTranslation} from 'next-i18next';
import {IconPhoto} from "@tabler/icons-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Props {
    onClose: any;
    toggleGallery: any;
}

export const ImageCanvas: FC<Props> = ({onClose, toggleGallery}) => {
    const {t} = useTranslation('sidebar');
    const {selectedImage} = useSelectedImage();
    const [modalIsOpen, setModalIsOpen] = useState(false);

    if (!selectedImage) return null;

    const toggleModal = () => {
        setModalIsOpen(!modalIsOpen);
    };


    return (
        <div
            className="duration-500 animate-showUp-fade  dark:bg-[#343541] fixed top-0 left-0 z-40 flex h-full w-full flex-none flex-col space-y-2 bg-[#202123] p-2 text-[14px] transition-all sm:relative sm:top-0">
            <div className="flex items-center justify-between  p-2">
                <div className="flex items-center">
                    <IconPhoto size={20}/>
                    <h4 className="ml-3 text-lg">{selectedImage}</h4>
                </div>
                <button
                    onClick={toggleGallery}
                    className="ml-1.5 mt-1 px-3 py-1 dark:bg-[#343541] bg-blue-500 text-white border-2 border-white hover:bg-blue-600 transition duration-300 transform hover:scale-105 hover:opacity-110"
                >
                    Select a document
                </button>
            </div>
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                justifyItems: "center",
            }}>

                <TransformWrapper
    wheel={{  smoothStep: 0.005}} >
                    <TransformComponent
                        wrapperStyle={{
                            maxHeight: "calc(100vh - 25vh)",
                            padding: '10px',
                            boxShadow: '0 4px 8px 0 rgba(0, 0, 0, 0.2)',
                            transition: '0.3s',
                        }}
                        wrapperClass="transform-wrapper"
                        contentClass="transform-component"
                    >
                        <img
                            src={API_URL + `/static/images/${selectedImage}`}
                            alt="Selected"
                            className="centered-image"
                            style={{

                                objectFit: 'contain' // Ensures the image is scaled properly
                            }}
                        />
                    </TransformComponent>
                </TransformWrapper>

            </div>

            <style jsx>{`
              .transform-wrapper:hover {
                box-shadow: 0 8px 16px 0 rgba(0, 0, 0, 0.2);
              }

              .transform-component {
                border: 1px solid gray;
                border-radius: 12px;
                overflow: hidden;
                max-height: calc(100vh - 25vh);
              }

              .centered-image {
                display: block; // Changes img from inline-block to block
                //max-width: 50%; // Ensures the image does not overflow the width
                max-height: calc(100vh - 25vh); // Ensures the image does not overflow the height
                object-fit: contain; // Maintains aspect ratio and fits the image within the bounds
              }
            `}</style>
        </div>
    );
};