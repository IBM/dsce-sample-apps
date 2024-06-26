import React from "react";
import PropTypes from "prop-types";

import {Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow} from '@carbon/react';

export default function CustomTable(props) {
    const { tableHead, tableData, tableHeaderColor } = props;
    return (
      <div>
        <Table >
          {tableHead !== undefined ? (
            <TableHead>
              <TableRow >
                {tableHead.map((prop, key) => {
                  return (
                    <TableCell
                      
                      key={key}
                    >
                      {prop}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
          ) : null}
          <TableBody>
            {tableData.map((prop, key) => {
              return (
                <TableRow key={key} >
                  {prop.map((prop, key) => {
                    return (
                      <TableCell key={key}>
                        {prop}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }
  
  CustomTable.defaultProps = {
    tableHeaderColor: "gray"
  };
  
  CustomTable.propTypes = {
    tableHeaderColor: PropTypes.oneOf([
      "warning",
      "primary",
      "danger",
      "success",
      "info",
      "rose",
      "gray"
    ]),
    tableHead: PropTypes.arrayOf(PropTypes.string),
    tableData: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string))
  };
  