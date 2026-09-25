import React from 'react';
import {
	DataTable,
	Table,
	TableHead,
	TableRow,
	TableHeader,
	TableBody,
	TableCell,
	TableSelectRow,
} from '@carbon/react';
import { useData } from '../../DataContext';

const DataTableComponent = ({ headers, rows, radio }) => {
	const { selectedRow, setSelectedRow } = useData();
	return (
		<DataTable rows={rows} headers={headers} radio={radio}>
			{({ rows, headers, getSelectionProps }) => (
				<Table>
					<TableHead>
						<TableRow>
							{radio && <TableHeader key="radio-col" />}
							{headers.map((header) => (
								<TableHeader key={header.key}>{header.header}</TableHeader>
							))}
						</TableRow>
					</TableHead>

					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.id}>
								{radio && (
									<TableSelectRow
										key={row.id + "-select"}
										{...getSelectionProps({ row })}
										onChange={() => setSelectedRow(row.id)}
										checked={row.id === selectedRow}
									/>
								)}

								{row.cells.map((cell) => (
									<TableCell key={cell.id}>{cell.value}</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>

				</Table>
			)}
		</DataTable>
	);
};

export default DataTableComponent;
