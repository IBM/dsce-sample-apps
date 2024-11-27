import { IconRobot } from '@tabler/icons-react';
import { MutableRefObject, useEffect, useState } from 'react';

import { useSelectedImage } from '../GalleryBar/SelectedImageContext';

interface ChatSuggestionProps {
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  suggestion: string[]
}



export const ChatSuggestion = (p: ChatSuggestionProps) => {
 
  const setNativeValue = (
    inputElement: HTMLTextAreaElement | HTMLInputElement,
    newValue: string,
  ) => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      inputElement,
      'value',
    )?.set;

    const prototype = Object.getPrototypeOf(inputElement);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(
      prototype,
      'value',
    )?.set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter?.call(inputElement, newValue);
    } else {
      valueSetter?.call(inputElement, newValue);
    }
  };

  const onClick = (label: string) => {
    if (p.textareaRef.current) {
      p.textareaRef.current.focus();

      setNativeValue(p.textareaRef.current, label);
      //Trigger on change event
      p.textareaRef.current.dispatchEvent(
        new Event('input', { bubbles: true }),
      );
    }
  };
  return (
    <div className="group md:px-4 w-full" style={{ overflowWrap: 'anywhere' }}>
      <div className="relative mt-auto mb-auto flex flex-col p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
        <div className="flex flex-col">
        <div className="flex flex-row align-center bg-blend-hue opacity-90">
          <div className="flex justify-between">
            <IconRobot size={20} />
            <div className="ml-4 rounded-full bg-green-500">
              <h6 className="text-sm font-semibold text-gray-700 dark:text-white text-center px-4">
                Document QA Assistant
              </h6>
            </div>
          </div>
        </div>
        </div>
        
        <div className="mt-[-2px] w-full ">
          <div className="w-full text-sm whitespace-normal break-words">
            <div className="w-full  bg-[#3B3E4A]  overflow-hidden">
              <div className="max-w-[90%] md:max-w-2xl w-full space-y-3 p-4">
                <div className="space-y-3">
                  <h2 className="font-medium text-white">
                    Hi, this is IBM Research Document QA Assistant.
                  </h2>
                  <div className="space-y-1.5">
                    <p className="mb-1.5 text-sm text-white">
                      You can ask me question about the document like:
                    </p>
                  </div>
                </div>
                <div>{p.suggestion.map((suggestion) => 
                  <button
                    key={suggestion}
                    type="button"
                    className="mr-2 mb-2.5 me-1.5 py-2 px-3 inline-flex justify-center items-center gap-x-2 rounded-lg border align-middle 
                            enabled:hover:bg-blue-50 text-sm bg-blue-600 text-white border-blue-500 
                            enabled:hover:text-blue-400 
                            enabled:hover:border-blue-400 
                            enabled:focus:outline-none 
                            enabled:focus:ring-1 
                            enabled:focus:ring-gray-600"
                    onClick={() => onClick(suggestion)}
                  >
                    {suggestion}
                  </button>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
