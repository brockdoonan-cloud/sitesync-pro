import JSZip from 'jszip'

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

  const sheets = await readXlsxRows(file)
  return {
    sheets,
  }
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function textBlocks(xml: string) {
  return Array.from(xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
    .map(match => decodeXml(match[1] || '').trim())
    .filter(Boolean)
}

async function sharedStrings(zip: JSZip) {
  const file = zip.files['xl/sharedStrings.xml']
  if (!file) return []
  const xml = await file.async('text')
  return Array.from(xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g))
    .map(match => textBlocks(match[1] || '').join(''))
}

function cellValue(cellXml: string, shared: string[]) {
  const inline = textBlocks(cellXml)
  if (inline.length) return inline.join('')
  const value = cellXml.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1]
  if (value === undefined) return ''
  if (/\bt="s"/.test(cellXml)) return shared[Number(value)] || ''
  return decodeXml(value).trim()
}

async function workbookSheetNames(zip: JSZip) {
  const file = zip.files['xl/workbook.xml']
  if (!file) return new Map<string, string>()
  const xml = await file.async('text')
  const names = new Map<string, string>()
  Array.from(xml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*sheetId="(\d+)"/g)).forEach(match => {
    names.set(`xl/worksheets/sheet${match[2]}.xml`, decodeXml(match[1] || `Sheet ${match[2]}`))
  })
  return names
}

async function readXlsxRows(file: File): Promise<WorkbookSheet[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const shared = await sharedStrings(zip)
  const names = await workbookSheetNames(zip)
  const worksheetNames = Object.keys(zip.files)
    .filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  return Promise.all(worksheetNames.map(async name => {
    const xml = await zip.files[name].async('text')
    const rows = Array.from(xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)).map(rowMatch => (
      Array.from((rowMatch[1] || '').matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g))
        .map(cellMatch => cellValue(cellMatch[0], shared))
    ))
    return {
      sheetName: names.get(name) || name.replace(/^xl\/worksheets\//, '').replace(/\.xml$/i, ''),
      rows,
    }
  }))
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
