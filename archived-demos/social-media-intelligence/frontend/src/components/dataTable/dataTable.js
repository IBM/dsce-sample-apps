import React from 'react';
// import './dataTable.css';

const TableComponent = ({ data }) => {
  const headers = Object.keys(data[0]);
  const rows = data.map(item => Object.values(item));

  return (
    <div className='tableContainer'>
    <table>
      <thead>
        <tr>
          {headers.map(header => <th key={header}>{header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, index) => <td key={index}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
};

export default TableComponent;
