

import React, { useEffect,useState } from 'react';
import {
    FileUploaderDropContainer,
    DataTable,
    TableBody,
    TableRow,
    TableCell,
    Table,
    TableHead,
    TableHeader,
  } from '@carbon/react';
  import './issueAnalysisDashboard.scss';
  import Papa from 'papaparse';

const Upload = ({selectedFile,setSelectedFile,headerFile,setHeaderFile,head }) => {
    const [csvData, setCsvData] = useState([]);

      useEffect(() => {
        async function fetchData() {
          try {
            //const response = await axios.get('frontend/src/demo-data.csv'); // Relative path to your CSV file
            const response = await fetch('./test'); // Using fetch API
            const data = await response.data;
            
            const parsedData = await Papa.parse(data, { header: true });

    
            await setCsvData(parsedData);
            // await console.log("This is "+ parsedData)
          } catch (error) {
            console.error('Error fetching CSV file:', error);
          }
        }
    
        fetchData();
      }, []);

    const handleFileChange = (files) => {
        
        const file = files.target.files[0];
  
        // console.log(file)
  
        if (file) {
        const reader = new FileReader();
  
        reader.onload = (e) => {
        const csvText = e.target.result;
  
        let rows = csvText.split('\n').map((row, rowIndex) => {
          const rowCells = row.trim().split(',');
          const rowId = `row_${rowIndex}`;
          return { id: rowId, cells: rowCells }
        })
        head = rows[0].cells.map(cell => cell)
  
        rows = rows.slice(1).map((row, rowIndex) => {
          const rowData = { id: `row_${rowIndex}` };
          row.cells.forEach((cell, cellIndex) => {
            rowData[head[cellIndex]] = cell;
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
      <div className='Upload-File'>
    <FileUploaderDropContainer  
     multiple={false} accept={[".csv"]} disabled={false} onAddFiles={handleFileChange} filenamestatus='complete'  className='File-Upload-Bttn'/>

    <div className="cds--file-container cds--file-container--drop" />
    </div>
    {selectedFile.length > 0 && (
      <div className='CSV'>
        <DataTable
          rows={selectedFile.slice(1,20)} // Skip the header row
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
        </div>
      )}

    </div> );
}
 
export default Upload;