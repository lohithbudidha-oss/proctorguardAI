import { Request, Response, NextFunction } from 'express';
import Question from '../models/Question';
import Exam from '../models/Exam';

export const getQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const questions = await Question.find({ examId });
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
