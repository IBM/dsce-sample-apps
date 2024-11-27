import React, {useEffect, useState} from 'react';
import {useSelectedImage} from "@/components/GalleryBar/SelectedImageContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const NEXT_PUBLIC_DISABLE_TESSERACT = process.env.NEXT_PUBLIC_DISABLE_TESSERACT === 'active' || false;
const ExtractionOptionsModal = ({isOpen, onRequestClose}) => {
    const [textWDU, setTextWDU] = useState('');
    const [textPDFMiner, setTextPDFMiner] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const {selectedImage} = useSelectedImage();

    useEffect(() => {
        fetchText('WDU', setTextWDU);
        fetchText('LangChain', setTextPDFMiner);
    }, [selectedImage]);

    useEffect(() => {
        setIsClosing(!isOpen)
    }, [isOpen])

    const fetchText = async (option, setText) => {
        try {
            const response = await fetch(`${API_URL}/extraction_model?selectedImage=${selectedImage}&extraction=${option}`);
            if (response.ok) {
                const text = await response.text();
                setText(text);
            } else {
                console.error('Error fetching text.');
            }
        } catch (error) {
            console.error('Error fetching text:', error);
        }
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onRequestClose, 500);
    };

    if (!isOpen && !isClosing) {
        return null
    }

    return (<div
        className={`fixed pr-[6px] ${!isOpen && 'hidden'} pl-10 inset-y-0 right-0 z-1 top-12 mt-4 w-2/3 max-h-screen bg-[#343541] ${isClosing ? 'hidden' : 'animate-appear-fast'}`}
    >
        <div
            className={`sticky ${'animate-appear-fast'}   top-0 z-10 flex justify-between items-center border border-b-neutral-300 bg-neutral-100 text-sm text-neutral-500 dark:border-none dark:bg-[#3B3E4A] dark:text-neutral-200 overflow-hidden text-ellipsis whitespace-nowrap`}>

            <div
                className={`flex ${NEXT_PUBLIC_DISABLE_TESSERACT ? "w-full" : "w-[50%]"} dark:bg-[#444654] min-h-[5vh] mr-4`}>
                <div style={{fontSize: "18px"}}
                     className="font-bold min-h-[19px] ml-5 mt-[1.5vh] max-h-[2vh] text-gray-700 dark:text-white text-center px-6 bg-green-500 rounded-full">
                    watsonx.ai Text Extraction
                </div>
            </div>

            {!NEXT_PUBLIC_DISABLE_TESSERACT && <div className="flex w-1/2 dark:bg-[#444654] min-h-[5vh] mr-4">
                <div style={{fontSize: "18px"}}
                     className="font-bold min-h-[19px] mt-[1.5vh] max-h-[2vh] ml-5 text-gray-700 dark:text-white text-center px-4 bg-purple-500 rounded-full">
                    Tesseract + PDFMiner
                </div>
            </div>}
        </div>


        {/*<button*/}
        {/*    onClick={handleClose}*/}
        {/*    className="absolute top-0 right-0 m-2.5 p-2 bg-gray-200 text-black rounded-full hover:bg-blue-600 transition duration-300 transform hover:scale-105 dark:bg-none"*/}
        {/*    aria-label="Close modal"*/}
        {/*>*/}
        {/*    <IconX color={"white"} size={35}/>*/}
        {/*</button>*/}
        <div className="flex flex-col w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-row w-full space-x-1">
                  <textarea
                      value={textWDU}
                      readOnly
                      className={`${NEXT_PUBLIC_DISABLE_TESSERACT ? "w-full" : "w-1/2"} h-[80vh] mt-4 p-2 text-sm text-[#9ca3af] bg-[#3B3E4A]`}
                      placeholder="WDU text will appear here"
                  />
                {!NEXT_PUBLIC_DISABLE_TESSERACT && <textarea
                    value={textPDFMiner}
                    readOnly
                    className={`${"w-1/2"} h-[80vh] mt-4 p-2 text-sm text-[#9ca3af] bg-[#3B3E4A]`}
                    placeholder="Tesseract + PDFMiner text will appear here"
                />}
            </div>
        </div>
    </div>);
};

export default ExtractionOptionsModal;
