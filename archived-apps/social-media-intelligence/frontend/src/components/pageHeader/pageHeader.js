import React, { useState } from 'react';
import './pageHeader.scss';

export default function PageHeader(title){
    return (
        <div className='PageTitle'>
                 <h1 style={{fontSize:'34px', fontWeight: "200"}}>{title.value}</h1>


        </div>
    )
}