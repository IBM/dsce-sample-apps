import data from './csvjson.json';
import TableComponent from './dataTable';

const jsonData = data;

export default function JsonTable(){

    return (
        <div>
            <h6>Data Preview</h6>

          <TableComponent data={jsonData}/>

          </div>
      )
}
