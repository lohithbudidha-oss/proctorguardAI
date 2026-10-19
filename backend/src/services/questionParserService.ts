import { QuestionType } from '../models/Question';

export interface ParsedOption {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface ParsedQuestion {
  text: string;
  type: QuestionType;
  category: string;
  marks: number;
  negativeMarks?: number;
  options: ParsedOption[];
  correctAnswer: string;
  imageUrl?: string;
  explanation?: string;
}

/**
 * Intelligent parser that extracts multiple choice questions from plain text,
 * PDF content, DOCX text, CSV, or JSON.
 */
export class QuestionParserService {

  /**
   * Main entry point to parse a file buffer into structured questions.
   */
  static async parseBuffer(
    buffer: Buffer, 
    filename: string, 
    mimeType?: string, 
    defaultCategory = 'General'
  ): Promise<ParsedQuestion[]> {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // 1. JSON file
    if (ext === 'json' || mimeType?.includes('json')) {
      const text = buffer.toString('utf-8');
      return this.parseJSON(text, defaultCategory);
    }

    // 2. CSV file
    if (ext === 'csv' || mimeType?.includes('csv')) {
      const text = buffer.toString('utf-8');
      return this.parseCSV(text, defaultCategory);
    }

    // 3. PDF Document
    if (ext === 'pdf' || mimeType?.includes('pdf')) {
      const extractedText = await this.extractTextFromPDF(buffer);
      return this.parseText(extractedText, defaultCategory);
    }

    // 4. DOCX Document (extract text from word/document.xml if zipped, or utf8)
    if (ext === 'docx') {
      const extractedText = this.extractTextFromDOCX(buffer);
      return this.parseText(extractedText, defaultCategory);
    }

    // 5. Plain text, markdown, or other document formats
    const text = buffer.toString('utf-8');
    return this.parseText(text, defaultCategory);
  }

  /**
   * Extract text from PDF buffer using pdf-parse
   */
  static async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const pdfModule = require('pdf-parse');
      if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        const res = await parser.getText();
        await parser.destroy();
        return res?.text || '';
      } else if (typeof pdfModule === 'function') {
        const res = await pdfModule(buffer);
        return res?.text || '';
      }
    } catch (err) {
      console.error('Error extracting text from PDF:', err);
    }
    // Fallback: simple string decoding if unencrypted text streams exist
    return buffer.toString('utf-8');
  }

  /**
   * Simple extraction for DOCX by parsing XML text runs (<w:t>)
   */
  static extractTextFromDOCX(buffer: Buffer): string {
    try {
      const content = buffer.toString('binary');
      // Look for XML text nodes <w:t ...>text</w:t> or <w:t>text</w:t>
      const matches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (matches && matches.length > 0) {
        return matches
          .map(m => m.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
          .join(' ')
          .replace(/\s+/g, ' ');
      }
    } catch (err) {
      console.warn('DOCX XML extraction failed, falling back to utf-8 text', err);
    }
    return buffer.toString('utf-8');
  }

  /**
   * Parse structured JSON content
   */
  static parseJSON(jsonText: string, defaultCategory = 'General'): ParsedQuestion[] {
    try {
      const parsed = JSON.parse(jsonText);
      const rawList: any[] = Array.isArray(parsed) 
        ? parsed 
        : Array.isArray(parsed.questions) 
          ? parsed.questions 
          : [];

      return rawList.map((item, idx) => {
        let opts: ParsedOption[] = [];
        if (Array.isArray(item.options)) {
          opts = item.options.map((opt: any, oIdx: number) => {
            const letter = String.fromCharCode(65 + oIdx);
            if (typeof opt === 'string') {
              return { id: letter, text: opt };
            }
            return {
              id: opt.id || letter,
              text: opt.text || String(opt),
              imageUrl: opt.imageUrl
            };
          });
        }

        // Fill standard 4 options if fewer provided
        while (opts.length < 4) {
          const letter = String.fromCharCode(65 + opts.length);
          opts.push({ id: letter, text: `Option ${letter}` });
        }

        return {
          text: item.text || item.question || `Question ${idx + 1}`,
          type: item.type || QuestionType.SINGLE_CHOICE,
          category: item.category || defaultCategory,
          marks: Number(item.marks) || 1,
          negativeMarks: Number(item.negativeMarks) || 0,
          options: opts.slice(0, 6),
          correctAnswer: (item.correctAnswer || item.answer || 'A').toString().toUpperCase().trim().charAt(0),
          imageUrl: item.imageUrl || item.diagramUrl || item.image || undefined,
          explanation: item.explanation || undefined
        };
      });
    } catch (err) {
      console.error('Failed to parse JSON questions:', err);
      return [];
    }
  }

  /**
   * Parse CSV content (with or without headers)
   */
  static parseCSV(csvText: string, defaultCategory = 'General'): ParsedQuestion[] {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const questions: ParsedQuestion[] = [];
    let startIdx = 0;

    // Check if line 0 is a header row
    const firstLineLower = lines[0].toLowerCase();
    if (firstLineLower.includes('question') || firstLineLower.includes('option') || firstLineLower.includes('prompt')) {
      startIdx = 1;
    }

    for (let i = startIdx; i < lines.length; i++) {
      // Basic CSV field parser supporting quotes
      const row = this.parseCSVLine(lines[i]);
      if (row.length < 2) continue;

      const questionText = row[0] || `Question ${i}`;
      const optA = row[1] || 'Option A';
      const optB = row[2] || 'Option B';
      const optC = row[3] || 'Option C';
      const optD = row[4] || 'Option D';
      const answer = (row[5] || 'A').toUpperCase().trim().charAt(0);
      const marks = Number(row[6]) || 1;
      const category = row[7] || defaultCategory;
      const imageUrl = row[8] || undefined;

      questions.push({
        text: questionText,
        type: QuestionType.SINGLE_CHOICE,
        category,
        marks,
        negativeMarks: 0,
        options: [
          { id: 'A', text: optA },
          { id: 'B', text: optB },
          { id: 'C', text: optC },
          { id: 'D', text: optD }
        ],
        correctAnswer: ['A', 'B', 'C', 'D'].includes(answer) ? answer : 'A',
        imageUrl
      });
    }

    return questions;
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }

  /**
   * Parse plain text containing multiple questions
   */
  static parseText(rawText: string, defaultCategory = 'General'): ParsedQuestion[] {
    if (!rawText || !rawText.trim()) return [];

    const normalized = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    // 1. Split into question blocks
    // Matches question markers at the beginning of a line:
    // e.g., "1.", "1)", "Q1.", "Q1:", "Question 1:", "Q.1", etc.
    const questionRegex = /(?:^|\n)\s*(?:(?:Question|Q\.?|Q)\s*(\d+)[\.\:\-\)]|(\d+)[\.\)])\s+/gi;
    
    const splits: { index: number; qNum: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = questionRegex.exec(normalized)) !== null) {
      splits.push({
        index: match.index,
        qNum: match[1] || match[2] || String(splits.length + 1)
      });
    }

    const blocks: string[] = [];
    if (splits.length > 0) {
      for (let i = 0; i < splits.length; i++) {
        const start = splits[i].index;
        const end = i + 1 < splits.length ? splits[i + 1].index : normalized.length;
        blocks.push(normalized.substring(start, end).trim());
      }
    } else {
      // Fallback: split by double newlines if no standard numbering found
      const paragraphs = normalized.split(/\n\s*\n/).filter(p => p.trim().length > 10);
      blocks.push(...paragraphs);
    }

    const questions: ParsedQuestion[] = [];

    for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
      const block = blocks[bIdx];
      const parsed = this.parseSingleQuestionBlock(block, bIdx + 1, defaultCategory);
      if (parsed) {
        questions.push(parsed);
      }
    }

    return questions;
  }

  /**
   * Parse an individual block into a single question
   */
  private static parseSingleQuestionBlock(
    block: string, 
    fallbackNumber: number, 
    defaultCategory: string
  ): ParsedQuestion | null {
    // Clean header numbering: e.g. "Q1. ", "1) ", "Question 1: "
    let cleanBlock = block.replace(/^(?:(?:Question|Q\.?|Q)\s*\d+[\.\:\-\)]|\d+[\.\)])\s*/i, '').trim();

    if (!cleanBlock) return null;

    // Detect image / diagram link or base64 inside block
    let imageUrl: string | undefined = undefined;
    const imgMatch = cleanBlock.match(/(?:\[(?:Image|Diagram|Graphic):\s*([^\s\]]+)\])|(?:(?:Image|Diagram):\s*(https?:\/\/[^\s]+))/i);
    if (imgMatch) {
      imageUrl = imgMatch[1] || imgMatch[2];
      cleanBlock = cleanBlock.replace(imgMatch[0], '').trim();
    }

    // Detect correct answer
    // e.g. "Answer: B", "Ans: (c)", "Key: Option A", "Correct Answer: B"
    let correctAnswer = 'A';
    const ansMatch = cleanBlock.match(/(?:Answer|Ans|Correct\s*Answer|Key|Right\s*Option)\s*[:\-]?\s*(?:Option\s*)?\(?([A-Da-d1-4])\)?/i);
    if (ansMatch) {
      const rawAns = ansMatch[1].toUpperCase();
      if (['1', '2', '3', '4'].includes(rawAns)) {
        correctAnswer = String.fromCharCode(64 + parseInt(rawAns, 10)); // 1->A, 2->B...
      } else {
        correctAnswer = rawAns;
      }
      cleanBlock = cleanBlock.replace(ansMatch[0], '').trim();
    }

    // Detect marks
    // e.g. "[2 Marks]", "(1 Mark)", "Marks: 2"
    let marks = 1;
    const markMatch = cleanBlock.match(/(?:\[|\()?(\d+)\s*Marks?(?:\]|\))?|(?:Marks?\s*[:\-]\s*(\d+))/i);
    if (markMatch) {
      marks = Math.max(1, parseInt(markMatch[1] || markMatch[2], 10) || 1);
      cleanBlock = cleanBlock.replace(markMatch[0], '').trim();
    }

    // Detect explanation
    let explanation: string | undefined = undefined;
    const expMatch = cleanBlock.match(/(?:Explanation|Solution)\s*[:\-]\s*([\s\S]+)$/i);
    if (expMatch) {
      explanation = expMatch[1].trim();
      cleanBlock = cleanBlock.replace(expMatch[0], '').trim();
    }

    // Extract options: A), B), C), D) or (A), (B), (C), (D) or A., B., C., D.
    // We look for all option occurrences
    const optionMatches: { id: string; index: number; fullMatch: string }[] = [];
    const optRegex = /(?:^|\n|\s)\(?([A-Da-d1-4])\)?[\.\:\-\)]\s+/g;
    let optMatch: RegExpExecArray | null;

    while ((optMatch = optRegex.exec(cleanBlock)) !== null) {
      let letter = optMatch[1].toUpperCase();
      if (['1', '2', '3', '4'].includes(letter)) {
        letter = String.fromCharCode(64 + parseInt(letter, 10));
      }
      optionMatches.push({
        id: letter,
        index: optMatch.index,
        fullMatch: optMatch[0]
      });
    }

    let questionText = cleanBlock;
    const options: ParsedOption[] = [];

    if (optionMatches.length >= 2) {
      // First option index marks the end of the question text
      questionText = cleanBlock.substring(0, optionMatches[0].index).trim();

      for (let i = 0; i < optionMatches.length; i++) {
        const cur = optionMatches[i];
        const next = i + 1 < optionMatches.length ? optionMatches[i + 1].index : cleanBlock.length;
        const optStart = cur.index + cur.fullMatch.length;
        const optText = cleanBlock.substring(optStart, next).trim();

        options.push({
          id: cur.id,
          text: optText || `Option ${cur.id}`
        });
      }
    } else {
      // Fallback: check if lines after line 0 can be options
      const lines = cleanBlock.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length >= 5) {
        questionText = lines[0];
        options.push(
          { id: 'A', text: lines[1] },
          { id: 'B', text: lines[2] },
          { id: 'C', text: lines[3] },
          { id: 'D', text: lines[4] }
        );
      }
    }

    // Ensure we have at least 4 options A, B, C, D
    const optionLetters = ['A', 'B', 'C', 'D'];
    const finalOptions: ParsedOption[] = [];

    for (let i = 0; i < 4; i++) {
      const letter = optionLetters[i];
      const existing = options.find(o => o.id === letter);
      if (existing) {
        finalOptions.push(existing);
      } else if (options[i]) {
        finalOptions.push({ id: letter, text: options[i].text });
      } else {
        finalOptions.push({ id: letter, text: `Option ${letter}` });
      }
    }

    if (!questionText) {
      questionText = imageUrl 
        ? `Refer to the attached diagram/figure to answer the question.`
        : `Question ${fallbackNumber}`;
    }

    return {
      text: questionText,
      type: QuestionType.SINGLE_CHOICE,
      category: defaultCategory,
      marks,
      negativeMarks: 0,
      options: finalOptions,
      correctAnswer: ['A', 'B', 'C', 'D'].includes(correctAnswer) ? correctAnswer : 'A',
      imageUrl,
      explanation
    };
  }
}
