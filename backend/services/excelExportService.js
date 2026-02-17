const ExcelJS = require('exceljs');

const DEFAULT_HEADER_FILL = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' }
};

const DEFAULT_HEADER_FONT = {
    bold: true,
    color: { argb: 'FFFFFFFF' }
};

const DEFAULT_BORDER = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
};

const CURRENCY_NUM_FMT = '#,##0.00';
const DATE_TIME_NUM_FMT = 'yyyy-mm-dd hh:mm';
const DATE_NUM_FMT = 'yyyy-mm-dd';

function normalizeSheetName(name = 'Report') {
    const safe = String(name || 'Report').replace(/[\\/?*\[\]:]/g, ' ').trim();
    const shortened = safe.slice(0, 31).trim();
    return shortened || 'Report';
}

function toDateStamp(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function prettifyHeader(key) {
    return String(key || '')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function inferColumnType(value) {
    if (value instanceof Date) return 'date';
    if (typeof value === 'number' && Number.isFinite(value)) return 'number';
    if (typeof value === 'string') {
        const asDate = new Date(value);
        if (!Number.isNaN(asDate.getTime()) && value.includes('-')) {
            return 'date';
        }
    }
    return 'text';
}

function inferColumnTypeFromKey(key, sampleValue) {
    const normalizedKey = String(key || '').toLowerCase();
    if (normalizedKey.includes('difference') || normalizedKey.includes('diff')) return 'difference';
    if (
        normalizedKey.includes('amount')
        || normalizedKey.includes('total')
        || normalizedKey.includes('revenue')
        || normalizedKey.includes('price')
        || normalizedKey.includes('cash')
        || normalizedKey.includes('commission')
        || normalizedKey.includes('income')
        || normalizedKey.includes('paid')
        || normalizedKey.includes('refund')
    ) {
        return 'currency';
    }
    if (
        normalizedKey.includes('date')
        || normalizedKey.endsWith('at')
        || normalizedKey.includes('time')
        || normalizedKey.includes('start')
        || normalizedKey.includes('end')
    ) {
        return 'date';
    }
    if (
        normalizedKey.endsWith('count')
        || normalizedKey.includes('qty')
        || normalizedKey.includes('quantity')
        || normalizedKey.includes('sessions')
        || normalizedKey.includes('units')
    ) {
        return 'integer';
    }
    return inferColumnType(sampleValue);
}

function buildColumnsFromRows(rows = []) {
    const keys = [];
    rows.forEach((row) => {
        Object.keys(row || {}).forEach((key) => {
            if (!keys.includes(key)) keys.push(key);
        });
    });
    return keys.map((key) => {
        let sampleValue = null;
        for (const row of rows) {
            if (row && row[key] !== null && typeof row[key] !== 'undefined' && row[key] !== '') {
                sampleValue = row[key];
                break;
            }
        }
        return {
            key,
            header: prettifyHeader(key),
            type: inferColumnTypeFromKey(key, sampleValue)
        };
    });
}

function setCellByType(cell, value, type = 'text') {
    if (value === null || typeof value === 'undefined') {
        cell.value = '';
        return;
    }

    if (type === 'currency' || type === 'difference') {
        const numericValue = Number(value);
        cell.value = Number.isFinite(numericValue) ? numericValue : 0;
        cell.numFmt = CURRENCY_NUM_FMT;
        cell.alignment = { horizontal: 'right' };
        if (type === 'difference') {
            if (numericValue > 0) {
                cell.font = { color: { argb: 'FF166534' }, bold: true };
            } else if (numericValue < 0) {
                cell.font = { color: { argb: 'FFB91C1C' }, bold: true };
            }
        }
        return;
    }

    if (type === 'number' || type === 'integer') {
        const numericValue = Number(value);
        cell.value = Number.isFinite(numericValue) ? numericValue : 0;
        if (type === 'integer') cell.numFmt = '0';
        cell.alignment = { horizontal: 'right' };
        return;
    }

    if (type === 'date') {
        const dateValue = value instanceof Date ? value : new Date(value);
        if (!Number.isNaN(dateValue.getTime())) {
            cell.value = dateValue;
            const isDateOnly = value instanceof Date
                ? dateValue.getHours() === 0 && dateValue.getMinutes() === 0 && dateValue.getSeconds() === 0
                : typeof value === 'string' && value.length <= 10;
            cell.numFmt = isDateOnly ? DATE_NUM_FMT : DATE_TIME_NUM_FMT;
            cell.alignment = { horizontal: 'center' };
        } else {
            cell.value = String(value);
        }
        return;
    }

    if (typeof value === 'boolean') {
        cell.value = value ? 'Yes' : 'No';
        return;
    }

    cell.value = String(value);
}

function styleHeaderRow(row, options = {}) {
    row.eachCell((cell) => {
        cell.font = options.font || DEFAULT_HEADER_FONT;
        cell.fill = options.fill || DEFAULT_HEADER_FILL;
        cell.border = options.border || DEFAULT_BORDER;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    row.height = 20;
}

function applyTableBorders(worksheet, fromRow, toRow, fromCol, toCol) {
    for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
        for (let colIndex = fromCol; colIndex <= toCol; colIndex += 1) {
            const cell = worksheet.getCell(rowIndex, colIndex);
            cell.border = DEFAULT_BORDER;
        }
    }
}

function autoFitWorksheetColumns(worksheet, options = {}) {
    const minWidth = options.minWidth || 12;
    const maxWidth = options.maxWidth || 48;
    const padding = options.padding || 2;

    worksheet.columns.forEach((column) => {
        let maxLength = minWidth;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const rawValue = cell.value;
            let text = '';
            if (rawValue === null || typeof rawValue === 'undefined') {
                text = '';
            } else if (rawValue instanceof Date) {
                text = rawValue.toISOString();
            } else if (typeof rawValue === 'object' && rawValue.text) {
                text = String(rawValue.text);
            } else {
                text = String(rawValue);
            }
            maxLength = Math.max(maxLength, Math.min(maxWidth, text.length + padding));
        });
        column.width = Math.min(maxWidth, Math.max(minWidth, maxLength));
    });
}

function createWorkbook() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gym Management System';
    workbook.created = new Date();
    workbook.modified = new Date();
    return workbook;
}

function addTableSheet(workbook, config = {}) {
    const {
        name = 'Report',
        title = null,
        subtitle = null,
        columns = [],
        rows = [],
        headerFill = DEFAULT_HEADER_FILL
    } = config;

    const worksheet = workbook.addWorksheet(normalizeSheetName(name));
    let currentRow = 1;

    if (title) {
        const titleCell = worksheet.getCell(currentRow, 1);
        titleCell.value = String(title);
        titleCell.font = { bold: true, size: 14, color: { argb: 'FF111827' } };
        currentRow += 1;
    }

    if (subtitle) {
        const subtitleCell = worksheet.getCell(currentRow, 1);
        subtitleCell.value = String(subtitle);
        subtitleCell.font = { italic: true, color: { argb: 'FF4B5563' } };
        currentRow += 1;
    }

    if (title || subtitle) {
        currentRow += 1;
    }

    const effectiveColumns = columns.length
        ? columns
        : buildColumnsFromRows(rows);
    const headers = effectiveColumns.map((col) => col.header || prettifyHeader(col.key));
    const headerRow = worksheet.getRow(currentRow);
    headers.forEach((header, index) => {
        headerRow.getCell(index + 1).value = header;
    });
    styleHeaderRow(headerRow, { fill: headerFill });

    let writeRow = currentRow + 1;
    rows.forEach((row) => {
        const worksheetRow = worksheet.getRow(writeRow);
        effectiveColumns.forEach((column, index) => {
            const cell = worksheetRow.getCell(index + 1);
            setCellByType(cell, row?.[column.key], column.type || 'text');
        });
        writeRow += 1;
    });

    if (rows.length > 0) {
        applyTableBorders(worksheet, currentRow + 1, writeRow - 1, 1, effectiveColumns.length);
    }
    applyTableBorders(worksheet, currentRow, currentRow, 1, effectiveColumns.length);
    worksheet.views = [{ state: 'frozen', ySplit: currentRow }];
    autoFitWorksheetColumns(worksheet);
    return worksheet;
}

async function sendWorkbook(res, workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
}

module.exports = {
    CURRENCY_NUM_FMT,
    DATE_NUM_FMT,
    DATE_TIME_NUM_FMT,
    DEFAULT_BORDER,
    DEFAULT_HEADER_FILL,
    addTableSheet,
    autoFitWorksheetColumns,
    buildColumnsFromRows,
    createWorkbook,
    normalizeSheetName,
    prettifyHeader,
    sendWorkbook,
    setCellByType,
    styleHeaderRow,
    toDateStamp
};
