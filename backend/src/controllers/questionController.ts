import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import Question from '../models/Question';
import Exam from '../models/Exam';
import { QuestionParserService } from '../services/questionParserService';

export const uploadQuestionsMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB limit
}).single('file');

export const getQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const questions = await Question.find({ examId }).sort({ createdAt: 1 });
    res.status(200).json({ success: true, questions });
  } catch (err) {
    next(err);
  }
};

export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const questionData = req.body;
    
    const question = new Question({ ...questionData, examId });
    await question.save();

    res.status(201).json({ success: true, message: 'Question created', question });
  } catch (err) {
    next(err);
  }
};

export const bulkCreateQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'Valid questions array is required' });
    }

    const docs = questions.map((q: any) => ({
      examId,
      text: q.text || 'Question',
      type: q.type || 'SINGLE_CHOICE',
      imageUrl: q.imageUrl || undefined,
      category: q.category || 'General',
      marks: Number(q.marks) || 1,
      negativeMarks: Number(q.negativeMarks) || 0,
      options: Array.isArray(q.options) ? q.options : [
        { id: 'A', text: 'Option A' },
        { id: 'B', text: 'Option B' },
        { id: 'C', text: 'Option C' },
        { id: 'D', text: 'Option D' }
      ],
      correctAnswer: q.correctAnswer || 'A',
      explanation: q.explanation || undefined
    }));

    const created = await Question.insertMany(docs);
    res.status(201).json({ 
      success: true, 
      message: `Successfully imported ${created.length} questions`, 
      count: created.length, 
      questions: created 
    });
  } catch (err) {
    next(err);
  }
};

export const parseQuestionsDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const defaultCategory = (req.body.category as string) || 'General';
    let questions = [];

    if (req.file) {
      questions = await QuestionParserService.parseBuffer(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        defaultCategory
      );
    } else if (req.body.text) {
      questions = QuestionParserService.parseText(req.body.text, defaultCategory);
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'No file or document text was provided for question parsing' 
      });
    }

    if (!questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not extract any standard multiple choice questions from the document. Please ensure questions are numbered (e.g. 1. or Q1) with options (A, B, C, D).'
      });
    }

    res.status(200).json({
      success: true,
      count: questions.length,
      questions
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: err?.message || 'Failed to parse questions from document.'
    });
  }
};

export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const question = await Question.findByIdAndUpdate(id, req.body, { new: true });
    res.status(200).json({ success: true, message: 'Question updated', question });
  } catch (err) {
    next(err);
  }
};

export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await Question.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Question deleted' });
  } catch (err) {
    next(err);
  }
};
