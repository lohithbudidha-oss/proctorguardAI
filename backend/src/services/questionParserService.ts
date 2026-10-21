import { QuestionType } from '../models/Question';
import zlib from 'zlib';

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
 * Intelligent parser that extracts multiple choice questions from Word documents (.docx),
 * PDF documents, plain text, CSV, or JSON.
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
    if (!buffer || buffer.length === 0) {
      throw new Error('The uploaded file is empty.');
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // Check magic bytes for reliable format detection
    const isZipOrDocx = buffer.length >= 4 && 
      buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    const isPdf = buffer.length >= 4 && 
      buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF

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

    // 3. Word Document (.docx or zipped document)
    if (ext === 'docx' || ext === 'doc' || isZipOrDocx || mimeType?.includes('wordprocessingml') || mimeType?.includes('msword')) {
      const extractedText = await this.extractTextFromDOCX(buffer);
      return this.parseText(extractedText, defaultCategory);
    }

    // 4. PDF Document
    if (ext === 'pdf' || isPdf || mimeType?.includes('pdf')) {
      const extractedText = await this.extractTextFromPDF(buffer);
      return this.parseText(extractedText, defaultCategory);
    }

    // 5. Binary file safety check: detect unhandled binary files with null bytes
    const sampleLength = Math.min(buffer.length, 1024);
    let nullBytes = 0;
    for (let i = 0; i < sampleLength; i++) {
      if (buffer[i] === 0) nullBytes++;
    }
    if (nullBytes > 2) {
      throw new Error(
        'The uploaded file is a binary format that cannot be parsed directly. ' +
        'Please upload a Word document (.docx), PDF (.pdf), CSV (.csv), or JSON (.json) file.'
      );
    }

    // 6. Plain text, markdown, or other text documents
    const text = buffer.toString('utf-8');
    return this.parseText(text, defaultCategory);
  }

  /**
   * Extract clean text from DOCX buffer using mammoth with a zlib XML unpacker fallback.
   * Never falls back to raw binary bytes!
   */
  static async extractTextFromDOCX(buffer: Buffer): Promise<string> {
    // 1. Try mammoth (best paragraph, table, list extraction)
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      if (result && typeof result.value === 'string' && result.value.trim().length > 0) {
        return result.value;
      }
    } catch (err: any) {
      console.warn('Mammoth extraction failed, trying built-in zip XML extractor...', err?.message || err);
    }

    // 2. Fallback: Extract and decompress word/document.xml directly from PKZip archive
    try {
      const textFromZip = this.extractDocxFromZipBuffer(buffer);
      if (textFromZip && textFromZip.trim().length > 0) {
        return textFromZip;
      }
    } catch (zipErr: any) {
      console.warn('Zip XML fallback extraction failed:', zipErr?.message || zipErr);
    }

    throw new Error(
      'Could not extract readable text from the Word document. ' +
      'Please ensure the file is a valid .docx document and is not password-protected.'
    );
  }

  /**
   * Decompresses word/document.xml from a .docx (PKZip) buffer and extracts clean text.
   */
  private static extractDocxFromZipBuffer(buf: Buffer): string | null {
    let offset = 0;
    while (offset + 30 < buf.length) {
      // Local file header signature 0x04034b50
      if (buf.readUInt32LE(offset) !== 0x04034b50) break;
      const compMethod = buf.readUInt16LE(offset + 8);
      const compSize = buf.readUInt32LE(offset + 18);
      const nameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;

      if (name === 'word/document.xml') {
        const compData = buf.subarray(dataStart, dataStart + compSize);
        let xml = '';
        if (compMethod === 8) {
          xml = zlib.inflateRawSync(compData).toString('utf8');
        } else if (compMethod === 0) {
          xml = compData.toString('utf8');
        } else {
          return null;
        }

        // Convert Word XML to clean plain text
        return xml
          .replace(/<w:p[^>]*>/gi, '\n')
          .replace(/<w:br[^>]*>/gi, '\n')
          .replace(/<w:tab[^>]*>/gi, ' ')
          .replace(/<w:t[^>]*>([^<]+)<\/w:t>/gi, '$1')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();
      }
      offset = dataStart + compSize;
    }
    return null;
  }

  /**
   * Extract text from PDF buffer using pdf-parse.
   * Throws a descriptive error if PDF has no selectable text, rather than returning binary junk.
   */
  static async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const pdfModule = require('pdf-parse');
      let text = '';

      if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        const res = await parser.getText();
        await parser.destroy();
        text = res?.text || '';
      } else if (typeof pdfModule === 'function') {
        const res = await pdfModule(buffer);
        text = res?.text || '';
      }

      if (text && text.trim().length > 10) {
        // Clean up common PDF artifacts (form feed, repeated blank lines)
        return text.replace(/\f/g, '\n\n').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
      }
    } catch (err: any) {
      console.error('Error extracting text from PDF:', err);
      throw new Error(`Failed to read PDF file: ${err?.message || 'Unsupported PDF structure or encrypted file.'}`);
    }

    throw new Error(
      'Could not extract text from the PDF file. ' +
      'The PDF might be scanned or image-only without selectable text, or password-protected.'
    );
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
          : Array.isArray(parsed.data)
            ? parsed.data
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
        } else if (item.options && typeof item.options === 'object') {
          // Object format e.g. { "A": "Berlin", "B": "Paris", ... }
          const keys = Object.keys(item.options);
          opts = keys.map(k => ({
            id: k.toUpperCase(),
            text: String(item.options[k])
          }));
        }

        // Fill standard 4 options if fewer provided
        while (opts.length < 4) {
          const letter = String.fromCharCode(65 + opts.length);
          opts.push({ id: letter, text: `Option ${letter}` });
        }

        // Determine correct answer
        let correctAnswer = 'A';
        const rawAns = (item.correctAnswer || item.answer || item.correctOption || item.key || '').toString().trim();
        if (rawAns) {
          const upper = rawAns.toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(upper)) {
            correctAnswer = upper;
          } else if (['1', '2', '3', '4'].includes(upper)) {
            correctAnswer = String.fromCharCode(64 + parseInt(upper, 10));
          } else {
            // Check if matches text of any option
            const found = opts.find(o => o.text.toLowerCase().trim() === rawAns.toLowerCase().trim());
            if (found) {
              correctAnswer = found.id;
            }
          }
        }

        return {
          text: item.text || item.question || item.prompt || `Question ${idx + 1}`,
          type: item.type || QuestionType.SINGLE_CHOICE,
          category: item.category || defaultCategory,
          marks: Number(item.marks) || 1,
          negativeMarks: Number(item.negativeMarks) || 0,
          options: opts.slice(0, 6),
          correctAnswer,
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
   * Parse CSV content with header detection and quoting support
   */
  static parseCSV(csvText: string, defaultCategory = 'General'): ParsedQuestion[] {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const questions: ParsedQuestion[] = [];
    let startIdx = 0;

    // Detect header columns dynamically
    const headerRow = this.parseCSVLine(lines[0]).map(h => h.toLowerCase());
    const hasHeader = headerRow.some(h => 
      h.includes('question') || h.includes('prompt') || h.includes('option')
    );

    let qCol = 0;
    let optACol = 1;
    let optBCol = 2;
    let optCCol = 3;
    let optDCol = 4;
    let ansCol = 5;
    let marksCol = 6;
    let catCol = 7;
    let imgCol = 8;

    if (hasHeader) {
      startIdx = 1;
      headerRow.forEach((col, idx) => {
        if (col.includes('question') || col.includes('prompt')) qCol = idx;
        else if (col.includes('option a') || col === 'a') optACol = idx;
        else if (col.includes('option b') || col === 'b') optBCol = idx;
        else if (col.includes('option c') || col === 'c') optCCol = idx;
        else if (col.includes('option d') || col === 'd') optDCol = idx;
        else if (col.includes('answer') || col.includes('correct') || col === 'key') ansCol = idx;
        else if (col.includes('mark')) marksCol = idx;
        else if (col.includes('category') || col.includes('topic')) catCol = idx;
        else if (col.includes('image') || col.includes('diagram')) imgCol = idx;
      });
    }

    for (let i = startIdx; i < lines.length; i++) {
      const row = this.parseCSVLine(lines[i]);
      if (row.length < 2) continue;

      const questionText = row[qCol] || `Question ${i}`;
      const optA = row[optACol] || 'Option A';
      const optB = row[optBCol] || 'Option B';
      const optC = row[optCCol] || 'Option C';
      const optD = row[optDCol] || 'Option D';
      const rawAns = (row[ansCol] || 'A').trim();
      const marks = Number(row[marksCol]) || 1;
      const category = row[catCol] || defaultCategory;
      const imageUrl = row[imgCol] || undefined;

      let correctAnswer = 'A';
      const upperAns = rawAns.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(upperAns)) {
        correctAnswer = upperAns;
      } else if (['1', '2', '3', '4'].includes(upperAns)) {
        correctAnswer = String.fromCharCode(64 + parseInt(upperAns, 10));
      } else {
        const match = [
          { id: 'A', text: optA },
          { id: 'B', text: optB },
          { id: 'C', text: optC },
          { id: 'D', text: optD }
        ].find(o => o.text.toLowerCase().trim() === rawAns.toLowerCase().trim());
        if (match) correctAnswer = match.id;
      }

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
        correctAnswer,
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
   * Parse plain text containing multiple multiple-choice questions.
   */
  static parseText(rawText: string, defaultCategory = 'General'): ParsedQuestion[] {
    if (!rawText || !rawText.trim()) return [];

    // Preprocessing and normalization
    const normalized = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/^\uFEFF/, '') // Strip BOM
      .replace(/[\u2018\u2019]/g, "'") // Normalize smart single quotes
      .replace(/[\u201C\u201D]/g, '"') // Normalize smart double quotes
      .replace(/[\u00A0\u2002\u2003]/g, ' ') // Normalize non-breaking spaces
      .replace(/^[=\-_*]{3,}\s*$/gm, '') // Remove horizontal rule separator lines
      .trim();

    // 1. Split into question blocks using question headers:
    // Matches "1.", "1)", "(1)", "Q1.", "Q1:", "Question 1:", "Q.1", "Question #1", etc.
    const questionRegex = /(?:^|\n)\s*(?:(?:Question|Q)\s*(?:#|no\.?|num\.?)?\s*(\d+)[\.:\)\-]?|(?:\(?\s*(\d+)\s*\)[\.:\)\-]?)|(\d+)[\.:\)])\s+/gi;
    
    const splits: { index: number; qNum: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = questionRegex.exec(normalized)) !== null) {
      splits.push({
        index: match.index,
        qNum: match[1] || match[2] || match[3] || String(splits.length + 1)
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
    // Clean initial question numbering (e.g. "Q1. ", "1) ", "Question 1: ", "(1) ")
    let cleanBlock = block
      .replace(/^(?:(?:Question|Q)\s*(?:#|no\.?|num\.?)?\s*\d+[\.:\)\-]?|(?:\(?\s*\d+\s*\)[\.:\)\-]?|\d+[\.:\)]))\s*/i, '')
      .trim();

    if (!cleanBlock) return null;

    // Detect image / diagram link or base64 in question
    let imageUrl: string | undefined = undefined;
    const imgMatch = cleanBlock.match(
      /(?:\[(?:Image|Diagram|Graphic|Figure):\s*([^\s\]]+)\])|(?:(?:Image|Diagram|Figure):\s*(https?:\/\/[^\s\n]+))/i
    );
    if (imgMatch) {
      imageUrl = imgMatch[1] || imgMatch[2];
      cleanBlock = cleanBlock.replace(imgMatch[0], '').trim();
    }

    // Detect marks e.g. "[2 Marks]", "(1 Mark)", "Marks: 2"
    let marks = 1;
    const markMatch = cleanBlock.match(/(?:\[|\()?(\d+)\s*Marks?(?:\]|\))?|(?:Marks?\s*[:\-]\s*(\d+))/i);
    if (markMatch) {
      marks = Math.max(1, parseInt(markMatch[1] || markMatch[2], 10) || 1);
      cleanBlock = cleanBlock.replace(markMatch[0], '').trim();
    }

    // Detect explanation / solution
    let explanation: string | undefined = undefined;
    const expMatch = cleanBlock.match(/(?:Explanation|Solution|Notes?)\s*[:\-]\s*([\s\S]+)$/i);
    if (expMatch) {
      explanation = expMatch[1].trim();
      cleanBlock = cleanBlock.replace(expMatch[0], '').trim();
    }

    // Detect correct answer e.g. "Answer: B", "Ans: (c)", "Key: Option A", "Correct Answer: Paris"
    let rawAnswer = '';
    const ansMatch = cleanBlock.match(
      /(?:(?:Correct\s*(?:Answer|Option))|Answer|Ans|Key|Right\s*Option)\s*[:\-=]?\s*(?:Option\s*)?\(?\s*([A-Da-d1-4]|[^\n]+)\s*\)?/i
    );
    if (ansMatch) {
      rawAnswer = ansMatch[1].trim();
      cleanBlock = cleanBlock.replace(ansMatch[0], '').trim();
    }

    // Extract options: A), B), C), D) or A., B., C., D. or A - or (A), (B), (C), (D)
    // Strategy 1: Look for letter options A, B, C, D
    const letterOptRegex = /(?:^|\n|[\t ]{2,}|\s)(?:\(?([A-Da-d])\)|\b([A-Da-d])\s*[\.:\)\-])\s+/g;
    const optionMatches: { id: string; index: number; fullMatch: string }[] = [];
    let optMatch: RegExpExecArray | null;

    while ((optMatch = letterOptRegex.exec(cleanBlock)) !== null) {
      const letter = (optMatch[1] || optMatch[2]).toUpperCase();
      // Only keep the first occurrence of each letter to avoid matching letters inside option text
      if (!optionMatches.some(m => m.id === letter)) {
        optionMatches.push({
          id: letter,
          index: optMatch.index,
          fullMatch: optMatch[0]
        });
      }
    }

    // Strategy 2: If fewer than 2 letter options found, try numeric options 1, 2, 3, 4 at start of lines
    if (optionMatches.length < 2) {
      optionMatches.length = 0;
      const numOptRegex = /(?:^|\n)\s*(?:\(?([1-4])\)|\b([1-4])\s*[\.:\)\-])\s+/g;
      let nMatch: RegExpExecArray | null;
      while ((nMatch = numOptRegex.exec(cleanBlock)) !== null) {
        const num = nMatch[1] || nMatch[2];
        const letter = String.fromCharCode(64 + parseInt(num, 10)); // 1->A, 2->B...
        if (!optionMatches.some(m => m.id === letter)) {
          optionMatches.push({
            id: letter,
            index: nMatch.index,
            fullMatch: nMatch[0]
          });
        }
      }
    }

    let questionText = cleanBlock;
    const options: ParsedOption[] = [];

    if (optionMatches.length >= 2) {
      // Sort matches by their appearance order in the block
      optionMatches.sort((a, b) => a.index - b.index);

      // Question text is everything before the first option match
      questionText = cleanBlock.substring(0, optionMatches[0].index).trim();

      for (let i = 0; i < optionMatches.length; i++) {
        const cur = optionMatches[i];
        const next = i + 1 < optionMatches.length ? optionMatches[i + 1].index : cleanBlock.length;
        const optStart = cur.index + cur.fullMatch.length;
        let optText = cleanBlock.substring(optStart, next).trim();

        // Check if option contains an image URL or tag
        let optImg: string | undefined = undefined;
        const optImgMatch = optText.match(
          /(?:\[(?:Image|Diagram|Graphic):\s*([^\s\]]+)\])|(?:(?:Image|Diagram):\s*(https?:\/\/[^\s\n]+))/i
        );
        if (optImgMatch) {
          optImg = optImgMatch[1] || optImgMatch[2];
          optText = optText.replace(optImgMatch[0], '').trim();
        }

        options.push({
          id: cur.id,
          text: optText || `Option ${cur.id}`,
          imageUrl: optImg
        });
      }
    } else {
      // Fallback: check if lines can be options
      const lines = cleanBlock.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length >= 5) {
        questionText = lines[0];
        const letters = ['A', 'B', 'C', 'D'];
        for (let i = 0; i < 4; i++) {
          const cleanLine = lines[i + 1]
            .replace(/^(?:[A-D1-4]\s*[\.:\)\-]|\([A-D1-4]\))\s*/i, '')
            .trim();
          options.push({
            id: letters[i],
            text: cleanLine || `Option ${letters[i]}`
          });
        }
      }
    }

    // Ensure we have 4 standard options A, B, C, D
    const optionLetters = ['A', 'B', 'C', 'D'];
    const finalOptions: ParsedOption[] = [];

    for (let i = 0; i < 4; i++) {
      const letter = optionLetters[i];
      const existing = options.find(o => o.id === letter);
      if (existing) {
        finalOptions.push(existing);
      } else if (options[i]) {
        finalOptions.push({ 
          id: letter, 
          text: options[i].text, 
          imageUrl: options[i].imageUrl 
        });
      } else {
        finalOptions.push({ id: letter, text: `Option ${letter}` });
      }
    }

    // Resolve correct answer letter
    let correctAnswer = 'A';
    if (rawAnswer) {
      const upper = rawAnswer.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(upper)) {
        correctAnswer = upper;
      } else if (['1', '2', '3', '4'].includes(upper)) {
        correctAnswer = String.fromCharCode(64 + parseInt(upper, 10));
      } else {
        // If rawAnswer was given as full option text (e.g. "Paris"), find the matching option
        const matchingOpt = finalOptions.find(o => 
          o.text.toLowerCase().trim() === rawAnswer.toLowerCase().trim() ||
          rawAnswer.toLowerCase().includes(o.text.toLowerCase().trim())
        );
        if (matchingOpt) {
          correctAnswer = matchingOpt.id;
        }
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
      correctAnswer,
      imageUrl,
      explanation
    };
  }
}
