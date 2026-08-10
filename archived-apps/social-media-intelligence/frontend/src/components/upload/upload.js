import React, { useState } from 'react';
import {
    FileUploaderDropContainer,
    DataTable,
    TableBody,
    TableRow,
    TableCell,
    Table,
    TableHead,
    TableHeader
  } from '@carbon/react';
import "./Upload.scss"


const Upload = ({selectedFile,setSelectedFile,headerFile,setHeaderFile,rows_str,setRowStr,head }) => {
    
    const handleFileChange = (files) => {

        const file = files.target.files[0];
  
        // console.log(file)
  
        if (file) {
        const reader = new FileReader();
  
        reader.onload = (e) => {
        const csvText = e.target.result;

        let rows = csvText.split('\n').map((row, rowIndex) => {
          // const rowCells = row.trim().split(',');
          let rowCells = row.trim().split(',');
          rowCells = rowCells.map((item) => (item === '' || item === ' ' ? 'SPACE' : item));
          const rowId = `row_${rowIndex}`;
          return { id: rowId, cells: rowCells }
        })

        let rows_str1 = csvText.split('\n').slice(1,6).map((arr)=> arr.trim().split(',').map((item) => (item === '' || item === ' ' ? 'SPACE' : item)));
        
        setRowStr(rows_str1);

        head = rows[0].cells.map(cell => cell.toLowerCase())
  
        rows = rows.slice(1).map((row, rowIndex) => {
          const rowData = { id: `row_${rowIndex}` };
          row.cells.forEach((cell, cellIndex) => {
            rowData[head[cellIndex].toLowerCase()] = cell;
          })
          return rowData  
        })
  
        setSelectedFile(rows);
        setHeaderFile(head);
        // console.log(rows)
        // console.log(head)
        // console.log(Object.keys(rows[0]))
  
        };
      reader.readAsText(file);
    
      }
      
      };
    return ( 
    <div className="Upload">

    <p className="cds--file--label">
    Upload files
    </p>
    <p className="cds--label-description">
    Max file size is 500kb. Supported file types are .jpg and .png.
    </p>
    <FileUploaderDropContainer  
    labelText="Drag and drop files here or click to upload" multiple={false} accept={[".csv"]} disabled={false} onAddFiles={handleFileChange} filenamestatus='complete'  />

    <div className="cds--file-container cds--file-container--drop" />
    
    {selectedFile.length > 0 && (
        <DataTable
          rows={selectedFile.slice(1,5)} // Skip the header row
          headers={
              headerFile.map((header) => ({
              key: header,
              header: header.toUpperCase(),
            }))}>
          {({ rows, headers, getHeaderProps }) => (
            <Table>
              <TableHead>
                <TableRow>
                  {headers.map((header) => ( 
                  <TableHeader key={header.key} {...getHeaderProps({ header })}>
                      {header.header} 
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.cells.map(cell => (
                    <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                  </TableRow>
                ))}

                
              </TableBody>
            </Table>
          )}
        </DataTable>
      )}

    </div> );
}
 
export default Upload;