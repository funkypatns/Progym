import React, { memo, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const toGridWidth = (value) => {
    if (typeof value === 'number') return `${value}px`;
    return value || 'minmax(140px, 1fr)';
};

const VirtualizedRow = memo(({ index, style, data }) => {
    const {
        rows,
        columns,
        gridTemplateColumns,
        getRowKey,
        rowClassName,
        baseRowClassName,
        onRowClick
    } = data;

    const row = rows[index];
    const rowKey = getRowKey ? getRowKey(row, index) : index;
    const extraClassName = typeof rowClassName === 'function' ? rowClassName(row, index) : rowClassName;

    return (
        <div
            role="row"
            key={rowKey}
            style={{ ...style, display: 'grid', gridTemplateColumns }}
            className={`${baseRowClassName} ${extraClassName || ''}`}
            onClick={onRowClick ? () => onRowClick(row, index) : undefined}
        >
            {columns.map((column, colIndex) => {
                const alignClass = column.align === 'right'
                    ? 'text-right'
                    : column.align === 'center'
                        ? 'text-center'
                        : 'text-left';
                const value = column.render ? column.render(row, index) : row?.[column.key];

                return (
                    <div
                        role="cell"
                        key={column.key || colIndex}
                        className={`${column.cellClassName || ''} ${alignClass}`}
                    >
                        {value ?? '-'}
                    </div>
                );
            })}
        </div>
    );
});

const VirtualizedTable = ({
    columns = [],
    rows = [],
    rowHeight = 52,
    maxHeight = 520,
    className = '',
    headerClassName = '',
    headerCellClassName = '',
    baseRowClassName = 'border-b border-gray-100 dark:border-white/5',
    rowClassName = '',
    emptyMessage = 'No data available',
    emptyClassName = 'py-12 text-center text-gray-500 dark:text-gray-400',
    getRowKey,
    onRowClick
}) => {
    const gridTemplateColumns = useMemo(
        () => columns.map((column) => toGridWidth(column.width)).join(' '),
        [columns]
    );

    const listHeight = useMemo(() => {
        const rowsHeight = rows.length * rowHeight;
        if (rowsHeight <= 0) return rowHeight;
        return Math.min(rowsHeight, maxHeight);
    }, [rows.length, rowHeight, maxHeight]);

    const itemData = useMemo(
        () => ({
            rows,
            columns,
            gridTemplateColumns,
            getRowKey,
            rowClassName,
            baseRowClassName,
            onRowClick
        }),
        [rows, columns, gridTemplateColumns, getRowKey, rowClassName, baseRowClassName, onRowClick]
    );

    if (!rows.length) {
        return <div className={emptyClassName}>{emptyMessage}</div>;
    }

    return (
        <div className={`w-full ${className}`}>
            <div role="row" className={`grid ${headerClassName}`} style={{ gridTemplateColumns }}>
                {columns.map((column, colIndex) => {
                    const alignClass = column.align === 'right'
                        ? 'text-right'
                        : column.align === 'center'
                            ? 'text-center'
                            : 'text-left';
                    return (
                        <div
                            role="columnheader"
                            key={column.key || colIndex}
                            className={`${headerCellClassName} ${column.headerClassName || ''} ${alignClass}`}
                        >
                            {column.label}
                        </div>
                    );
                })}
            </div>

            <div style={{ height: listHeight }} className="w-full overflow-y-auto">
                <AutoSizer disableHeight>
                    {({ width }) => (
                        <List
                            height={listHeight}
                            itemCount={rows.length}
                            itemSize={rowHeight}
                            width={width || 1}
                            itemData={itemData}
                            itemKey={(index, data) => {
                                if (data?.getRowKey) {
                                    return data.getRowKey(data.rows[index], index);
                                }
                                return index;
                            }}
                        >
                            {VirtualizedRow}
                        </List>
                    )}
                </AutoSizer>
            </div>
        </div>
    );
};

export default VirtualizedTable;
