"use client";

import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Button,
  Modal
} from '@carbon/react';




const GeneratedResponseModal = ({ fileUrl }) => {
  const button = useRef();

  const ModalStateManager = ({
    renderLauncher: LauncherContent,
    children: ModalContent
  }) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        {!ModalContent || typeof document === 'undefined'
          ? null
          : ReactDOM.createPortal(
              <ModalContent open={open} setOpen={setOpen} />,
              document.body
            )}
        {LauncherContent && <LauncherContent open={open} setOpen={setOpen} />}
      </>
    );
  };

  return (
    <ModalStateManager
      renderLauncher={({ setOpen }) => (
        <Button ref={button}
        kind="danger--tertiary"
         onClick={() => setOpen(true)}>
          View Generated Response
        </Button>
      )}
    >
      {({ open, setOpen }) => (
        <>
        <Modal
          modalHeading="Generated RFP Response"
          // modalLabel="Download Ready"
          primaryButtonText="View PDF"
          secondaryButtonText="Close"
          open={open}
          onRequestClose={() => setOpen(false)}
          onRequestSubmit={() => {
            window.open(fileUrl, '_blank');
            setOpen(false);
          }}
        >
          <p>
            Your response has been generated successfully. Click the button
            below to view the PDF.
          </p>
          {/* <p style={{ fontWeight: 'bold' }}>
            📎{' '}
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              Download Link
            </a>
          </p> */}
        </Modal>
        <style>
            {`
              .cds--modal-close {
                display: none !important;
              }
            `}
          </style>
          </>
      )}
    </ModalStateManager>
  );
};

export default GeneratedResponseModal;
