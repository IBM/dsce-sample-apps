import CustomTable from "../customTable/customTable";



export default function TableList({ rows, headers }) {

  return (
    
        <CustomTable
          
          tableHead={headers}
          tableData={rows}
        />
      
  );
}
