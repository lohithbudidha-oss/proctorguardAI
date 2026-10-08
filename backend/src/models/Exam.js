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
exports.ResultVisibility = exports.ExamStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ExamStatus;
(function (ExamStatus) {
    ExamStatus["DRAFT"] = "DRAFT";
    ExamStatus["PUBLISHED"] = "PUBLISHED";
    ExamStatus["SCHEDULED"] = "SCHEDULED";
    ExamStatus["ACTIVE"] = "ACTIVE";
    ExamStatus["CLOSED"] = "CLOSED";
    ExamStatus["ARCHIVED"] = "ARCHIVED";
})(ExamStatus || (exports.ExamStatus = ExamStatus = {}));
var ResultVisibility;
(function (ResultVisibility) {
    ResultVisibility["IMMEDIATE"] = "IMMEDIATE";
    ResultVisibility["DELAYED"] = "DELAYED";
    ResultVisibility["HIDDEN"] = "HIDDEN";
})(ResultVisibility || (exports.ResultVisibility = ResultVisibility = {}));
const ExamSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: { type: String },
    instructions: { type: String },
    duration: { type: Number, required: true },
    startAt: { type: Date },
    endAt: { type: Date },
    attemptLimit: { type: Number, default: 1 },
    scoringRules: {
        positiveMarks: { type: Number, default: 1 },
        negativeMarks: { type: Number, default: 0 }
    },
    resultVisibility: { type: String, enum: Object.values(ResultVisibility), default: ResultVisibility.HIDDEN },
    proctoringConfig: {
        cameraRequired: { type: Boolean, default: false },
        screenShareRequired: { type: Boolean, default: false },
        fullscreenRequired: { type: Boolean, default: false },
        tabSwitchPolicy: { type: String, default: 'STRICT' },
        networkGracePeriod: { type: Number, default: 300 },
        recordingRetentionPeriod: { type: Number, default: 30 }
    },
    status: { type: String, enum: Object.values(ExamStatus), default: ExamStatus.DRAFT },
    version: { type: Number, default: 1 }
}, { timestamps: true });
exports.default = mongoose_1.default.model('Exam', ExamSchema);
//# sourceMappingURL=Exam.js.map