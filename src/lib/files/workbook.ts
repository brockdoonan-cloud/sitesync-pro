import readXlsxFile, { type Sheet } from 'read-excel-file/browser'

const MAX_WORKBOOK_BYTES = 25 * 1024 * 1024
const WORKBOOK_EXTENSIONS = ['.xlsx', '.csv']

export type WorkbookSheet = {
  sheetName: string
  rows: unknown[][]
}

export type ParsedWorkbook = {
  sheets: WorkbookSheet[]
}

export function validateWorkbookFile(file: File) {
  const lowerName = file.name.toLowerCase()
  const hasAllowedExtension = WORKBOOK_EXTENSIONS.some(extension => lowerName.endsWith(extension))

  if (!hasAllowedExtension) {
    throw new Error('Upload an .xlsx or .csv workbook.')
  }

  if (file.size > MAX_WORKBOOK_BYTES) {
    throw new Error('Workbook is too large. Keep imports under 25 MB and split larger onboardings into batches.')
  }
}

export async function readWorkbookRows(file: File): Promise<ParsedWorkbook> {
  validateWorkbookFile(file)
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.csv')) {
    return {
      sheets: [{
        sheetName: 'CSV',
        rows: parseCsvRows(await file.text()),
      }],
    }
  }

  const sheets = await readXlsxFile(file)
  return {
    sheets: (sheets as Sheet[]).map(sheet => ({
      sheetName: sheet.sheet,
      rows: sheet.data.map(row => row.map(cell => cell ?? '')),
    })),
  }
}

function parseCsvRows(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell)
  if (row.length > 1 || row[0]) rows.push(row)
  return rows
}
