"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishExam = exports.updateExam = exports.getExams = exports.createExam = void 0;
const express_1 = require("express");
const Exam_1 = __importStar(require("../models/Exam"));
const createExam = async (req, res, next) => {
    try {
        const examData = req.body;
        // In a real app, apply thorough validation here
        const exam = new Exam_1.default(examData);
        await exam.save();
        res.status(201).json({ success: true, message: 'Exam created successfully', exam });
    }
    catch (err) {
        next(err);
    }
};
exports.createExam = createExam;
const getExams = async (req, res, next) => {
    try {
        const exams = await Exam_1.default.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, exams });
    }
    catch (err) {
        next(err);
    }
};
exports.getExams = getExams;
const updateExam = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const exam = await Exam_1.default.findById(id);
        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }
        if (exam.status !== Exam_1.ExamStatus.DRAFT) {
            return res.status(400).json({ success: false, message: 'Only draft exams can be freely edited' });
        }
        Object.assign(exam, updateData);
        await exam.save();
        res.status(200).json({ success: true, message: 'Exam updated', exam });
    }
    catch (err) {
        next(err);
    }
};
exports.updateExam = updateExam;
const publishExam = async (req, res, next) => {
    try {
        const { id } = req.params;
        const exam = await Exam_1.default.findById(id);
        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }
        if (exam.status !== Exam_1.ExamStatus.DRAFT) {
            return res.status(400).json({ success: false, message: 'Only draft exams can be published' });
        }
        exam.status = Exam_1.ExamStatus.PUBLISHED;
        exam.version += 1;
        await exam.save();
        res.status(200).json({ success: true, message: 'Exam published', exam });
    }
    catch (err) {
        next(err);
    }
};
exports.publishExam = publishExam;
//# sourceMappingURL=examController.js.map