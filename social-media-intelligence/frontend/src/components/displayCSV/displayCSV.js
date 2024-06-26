import React, { useState } from "react";
import telData from "./telco-table-data.json";
import "./displayCSV.scss";
import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from "carbon-components-react";

import { ChevronDown } from "@carbon/icons-react";

const DropdownButton = ({ showTable, setShowTable }) => {
  const [jsonData, setJsonData] = useState(telData);

  const toggleTable = () => {
    setShowTable(!showTable);
  };

  const getTableHeaders = () => {
    if (jsonData.length === 0) {
      return null;
    }

    const keys = Object.keys(jsonData[0]);
    return keys.map((key) => <th key={key}>{key}</th>);
  };

  return (
    <div style={{ width: "75%" }}>
      <button
        onClick={toggleTable}
        className="dataButton"
        style={{ fontFamily: "Helvetica Neue" }}
      >
        Data preview <ChevronDown />
      </button>
      <br />
      <br />
      {showTable && (
        <div className="tableDiv">
          <Table
            border="1"
            size="xl"
            useZebraStyles={false}
            aria-label="sample table"
          >
            <TableHead>
              <TableRow>{getTableHeaders()}</TableRow>
            </TableHead>
            <TableBody>
              {jsonData.map((data, index) => (
                <TableRow key={index}>
                  {Object.values(data).map((value, innerIndex) => (
                    <TableCell key={innerIndex}>{value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default DropdownButton;
