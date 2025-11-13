import * as fs from 'fs';
import pdf from 'pdf-parse';

export class PDFProcessor {
    async extractText(filePath: string): Promise<string> {
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            return data.text.trim();
        } catch (error) {
            console.error('PDF extraction failed:', error);
            throw new Error('Failed to extract text from PDF');
        }
    }
}