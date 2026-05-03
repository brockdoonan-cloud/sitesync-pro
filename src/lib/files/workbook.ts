const MAX_WORKBOOK_BYTES = 25 * 1024 * 1024
const WORKBOOK_EXTENSIONS = ['.xlsx', '.xls', '.csv']

export function validateWorkbookFile(file: File) {
  const lowerName = file.name.toLowerCase()
  const hasAllowedExtension = WORKBOOK_EXTENSIONS.some(extension => lowerName.endsWith(extension))

  if (!hasAllowedExtension) {
    throw new Error('Upload an .xlsx, .xls, or .csv workbook.')
  }

  if (file.size > MAX_WORKBOOK_BYTES) {
    throw new Error('Workbook is too large. Keep imports under 25 MB and split larger onboardings into batches.')
  }
}
