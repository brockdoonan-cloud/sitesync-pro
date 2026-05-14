declare module 'pdf-parse' {
  export type PdfParseResult = {
    text: string
    numpages?: number
    numrender?: number
    info?: unknown
    metadata?: unknown
    version?: string
  }

  export default function pdfParse(dataBuffer: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PdfParseResult>
}
