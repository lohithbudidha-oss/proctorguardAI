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
exports.AttemptStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var AttemptStatus;
(function (AttemptStatus) {
    AttemptStatus["IN_PROGRESS"] = "IN_PROGRESS";
    AttemptStatus["SUBMITTED"] = "SUBMITTED";
    AttemptStatus["LOCKED"] = "LOCKED";
    AttemptStatus["EVALUATED"] = "EVALUATED";
    AttemptStatus["TERMINATED"] = "TERMINATED"; // e.g. for cheating
})(AttemptStatus || (exports.AttemptStatus = AttemptStatus = {}));
const AttemptSchema = new mongoose_1.Schema({
    examId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Exam', required: true },
    candidateId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    assignmentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    examVersion: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    submittedAt: { type: Date },
    status: { type: String, enum: Object.values(AttemptStatus), default: AttemptStatus.IN_PROGRESS },
    score: { type: Number },
    percentage: { type: Number },
    resultStatus: { type: String, enum: ['PASS', 'FAIL'] }
}, { timestamps: true });
exports.default = mongoose_1.default.model('Attempt', AttemptSchema);
//# sourceMappingURL=Attempt.js.map