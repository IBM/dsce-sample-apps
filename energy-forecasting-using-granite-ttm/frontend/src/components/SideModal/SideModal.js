import { ComposedModal, ModalBody, ModalHeader, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@carbon/react';
import React from 'react';
import styles from './SideModal.module.scss';

const SideModal = (props) => {
  const { open, setOpenSidePanel, sampleData, title } = props;
  const header = sampleData?.length !==0 ? Object.keys(sampleData[0]) : []
  const rows = sampleData?.map((row)=>Object.values(row)) || []
  return (
    <ComposedModal
      open={open}
      containerClassName={styles.demoModalContainer}
      className={styles.demoModal}
      onClose={() => {
        setOpenSidePanel((prev) => !prev);
      }}
    >
      <ModalHeader className={styles.modalHeader}>
        {title}
        </ModalHeader>
      <ModalBody className={styles.modalBody} hasScrollingContent>
          <div className={styles.homeSidePanel}>
            <div style={{ alignSelf: 'center' }}>
              <Table>
                <TableHead>
                <TableRow>
                  {header?.map((item)=><TableHeader>{item}</TableHeader>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows?.map((row)=><TableRow>{row.map((item)=><TableCell>{item}</TableCell>)}</TableRow>)}
                </TableBody>
              </Table>
              <div className={styles.source}>
                Source: <a href='https://www.kaggle.com/datasets/nicholasjhana/energy-consumption-generation-prices-and-weather' target='_blank'>https://www.kaggle.com/datasets/nicholasjhana/energy-consumption-generation-prices-and-weather</a>
              </div>
            </div>
          </div>
      </ModalBody>
    </ComposedModal>
  );
};

export default SideModal;
