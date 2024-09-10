import React from 'react'
import styles from './Footer.module.scss';

const Footer = () => {
 return(<footer className={styles.container}>
    <p>This app is built using the Granite TTM published by IBM Research on Hugging Face, and may include systems and methods pending patent with the USPTO, protected under US Patent Laws. &#169; Copyright IBM Corporation</p>
  </footer>
 )
}

export default Footer